import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import {
  DATA_SKU_SUPPLIERS_COLLECTION,
  isDataSkuSuppliersMetaDocument,
} from "@/lib/firestore/data-sku-suppliers-collection";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";

const BATCH_SIZE = 500;
const SKU_ID_IN_QUERY_CHUNK = 30;

async function deleteDocRefs(
  db: Firestore,
  refs: DocumentReference[],
  onChunk?: (deleted: number, total: number) => void,
): Promise<number> {
  const deleteTotal = refs.length;
  let deleted = 0;

  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const chunk = refs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
    deleted += chunk.length;
    onChunk?.(deleted, deleteTotal);
  }

  return deleted;
}

/** Remove supplier rows for the given skuIds (replaced on each import for touched products). */
export async function deleteSuppliersForSkuIds(
  db: Firestore,
  skuIds: string[],
  onChunk?: (deleted: number, total: number) => void,
): Promise<number> {
  const unique = [...new Set(skuIds.filter(Boolean))];
  if (unique.length === 0) return 0;

  const refsToDelete: DocumentReference[] = [];

  for (let i = 0; i < unique.length; i += SKU_ID_IN_QUERY_CHUNK) {
    const chunk = unique.slice(i, i + SKU_ID_IN_QUERY_CHUNK);
    const snap = await db
      .collection(DATA_SKU_SUPPLIERS_COLLECTION)
      .where("skuId", "in", chunk)
      .get();
    for (const doc of snap.docs) {
      if (!isDataSkuSuppliersMetaDocument(doc.id)) {
        refsToDelete.push(doc.ref);
      }
    }
  }

  return deleteDocRefs(db, refsToDelete, onChunk);
}

/** Set isCurrent=false on every product (start of import — sheet will re-flag matches). */
export async function markAllProductsNotCurrent(
  db: Firestore,
  onChunk?: (done: number, total: number) => void,
): Promise<number> {
  const snap = await db.collection(DATA_SKUS_COLLECTION).get();
  const refs = snap.docs.filter((d) => !isDataSkusMetaDocument(d.id)).map((d) => d.ref);
  const total = refs.length;
  let done = 0;

  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const chunk = refs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.update(ref, { isCurrent: false });
    }
    await batch.commit();
    done += chunk.length;
    onChunk?.(done, total);
  }

  return done;
}

/** Remove supplier docs whose skuId has no parent in data_skus. */
export async function deleteOrphanSuppliers(
  db: Firestore,
  onChunk?: (deleted: number, total: number) => void,
): Promise<number> {
  const skuSnap = await db.collection(DATA_SKUS_COLLECTION).get();
  const validSkuIds = new Set(
    skuSnap.docs.filter((d) => !isDataSkusMetaDocument(d.id)).map((d) => d.id),
  );

  const supplierSnap = await db.collection(DATA_SKU_SUPPLIERS_COLLECTION).get();
  const refsToDelete: DocumentReference[] = [];

  for (const doc of supplierSnap.docs) {
    if (isDataSkuSuppliersMetaDocument(doc.id)) continue;
    const skuId = String(doc.data().skuId ?? "").trim();
    if (!skuId || !validSkuIds.has(skuId)) {
      refsToDelete.push(doc.ref);
    }
  }

  return deleteDocRefs(db, refsToDelete, onChunk);
}

/**
 * After a full-catalog import (all products marked not-current, sheet rows re-flagged):
 * delete `data_skus` with isCurrent=false and their supplier rows.
 */
export async function deleteProductsNotInSheet(
  db: Firestore,
  onProgress?: (event: {
    phase: "suppliers" | "products";
    deleted: number;
    total: number;
  }) => void,
): Promise<{ productsDeleted: number; suppliersDeleted: number }> {
  const snap = await db
    .collection(DATA_SKUS_COLLECTION)
    .where("isCurrent", "==", false)
    .get();
  const productRefs = snap.docs
    .filter((d) => !isDataSkusMetaDocument(d.id))
    .map((d) => d.ref);
  const skuIds = productRefs.map((r) => r.id);

  const suppliersDeleted = await deleteSuppliersForSkuIds(db, skuIds, (deleted, total) => {
    onProgress?.({ phase: "suppliers", deleted, total });
  });

  const productsDeleted = await deleteDocRefs(db, productRefs, (deleted, total) => {
    onProgress?.({ phase: "products", deleted, total });
  });

  return { productsDeleted, suppliersDeleted };
}
