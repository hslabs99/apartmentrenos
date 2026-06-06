import {
  FieldValue,
  type DocumentReference,
  type Firestore,
  type QuerySnapshot,
} from "firebase-admin/firestore";
import { ensureDataObjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_OBJECTS_COLLECTION,
  isDataObjectsMetaDocument,
} from "@/lib/firestore/data-objects-collection";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import {
  buildDataObjectKey,
  isDataObjectKeyUsable,
  type DataObjectKeyFields,
} from "@/lib/data-object-key";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";
import {
  canonicalDataObjectFields,
  dataObjectKeyFromFields,
  dataObjectToFirestore,
} from "@/lib/server/data-object-doc";
import {
  isBlindsQuoteObject,
  quoteObjectSkuPipelineKey,
} from "@/lib/server/quote-object-sku-pipeline";
import { syncObjectCategoryLookupsFromQuoteObjects } from "@/lib/server/sync-object-category-lookups-from-quote-objects";
import { syncQuoteObjectFromDataObject } from "@/lib/server/sync-quote-object-from-data-object";

const DELETE_BATCH_SIZE = 500;

export type PrepareDataObjectsOptions = {
  /** Delete `data_objects` whose category + product type are not in current `data_skus`. */
  removeDataObjectsNotInSkus?: boolean;
  /** Delete SKU-pipeline `quote_objects` with no matching `data_objects` row (skips blinds). */
  removeQuoteObjectsNotInDataObjects?: boolean;
};

export function parsePrepareDataObjectsOptions(body: unknown): PrepareDataObjectsOptions {
  if (!body || typeof body !== "object") return {};
  const o = body as Record<string, unknown>;
  return {
    removeDataObjectsNotInSkus: o.removeDataObjectsNotInSkus === true,
    removeQuoteObjectsNotInDataObjects: o.removeQuoteObjectsNotInDataObjects === true,
  };
}

export type PrepareDataObjectsResult = {
  distinctFromSkus: number;
  created: number;
  skippedExisting: number;
  skippedIncomplete: number;
  removedDataObjects: number;
  quoteObjectsCreated: number;
  quoteObjectsUpdated: number;
  removedQuoteObjects: number;
  objectCategoryLookupsCreated: number;
  objectCategoryLookupsAlreadyPresent: number;
};

type DistinctRow = DataObjectKeyFields & { uom: string };

async function deleteRefsInBatches(
  db: Firestore,
  refs: DocumentReference[],
): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += DELETE_BATCH_SIZE) {
    const chunk = refs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

function collectDistinctRowsFromSkus(
  skuSnap: QuerySnapshot,
): { distinctByKey: Map<string, DistinctRow>; unusableCount: number } {
  const distinctByKey = new Map<string, DistinctRow>();
  let unusableCount = 0;

  for (const doc of skuSnap.docs) {
    if (isDataSkusMetaDocument(doc.id)) continue;
    const data = doc.data();
    const fields: DataObjectKeyFields = {
      category: String(data.category ?? ""),
      productType: String(data.productType ?? ""),
    };
    if (!isDataObjectKeyUsable(fields)) {
      unusableCount++;
      continue;
    }
    const canon = canonicalDataObjectFields(fields);
    const key = buildDataObjectKey(canon);
    if (distinctByKey.has(key)) continue;
    distinctByKey.set(key, {
      ...canon,
      uom: mapSkuUomToQuoteUom(String(data.uom ?? "")),
    });
  }

  return { distinctByKey, unusableCount };
}

async function removeDataObjectsNotInSkuKeys(
  db: Firestore,
  skuKeys: Set<string>,
): Promise<number> {
  const existingSnap = await db.collection(DATA_OBJECTS_COLLECTION).get();
  const toDelete = existingSnap.docs.filter((d) => {
    if (isDataObjectsMetaDocument(d.id)) return false;
    const key = dataObjectKeyFromFields({
      category: String(d.data().category ?? ""),
      productType: String(d.data().productType ?? ""),
    });
    return !key || !skuKeys.has(key);
  });
  return deleteRefsInBatches(
    db,
    toDelete.map((d) => d.ref),
  );
}

async function removeQuoteObjectsNotInDataObjectKeys(
  db: Firestore,
  dataObjectKeys: Set<string>,
): Promise<number> {
  const qoSnap = await db.collection("quote_objects").get();
  const toDelete = qoSnap.docs.filter((d) => {
    if (isQuoteObjectsMetaDocument(d.id)) return false;
    if (isBlindsQuoteObject(d.id, d.data())) return false;
    const key = quoteObjectSkuPipelineKey(d.data());
    return !dataObjectKeys.has(key);
  });
  return deleteRefsInBatches(
    db,
    toDelete.map((d) => d.ref),
  );
}

function collectDataObjectKeysFromSnap(snap: QuerySnapshot): Set<string> {
  const keys = new Set<string>();
  for (const doc of snap.docs) {
    if (isDataObjectsMetaDocument(doc.id)) continue;
    const key = dataObjectKeyFromFields({
      category: String(doc.data().category ?? ""),
      productType: String(doc.data().productType ?? ""),
    });
    if (key) keys.add(key);
  }
  return keys;
}

export async function runPrepareDataObjects(
  db: Firestore,
  options: PrepareDataObjectsOptions = {},
): Promise<PrepareDataObjectsResult> {
  await ensureDataObjectsBootstrap(db);

  const skuSnap = await db.collection(DATA_SKUS_COLLECTION).get();
  const { distinctByKey, unusableCount } = collectDistinctRowsFromSkus(skuSnap);
  const skuKeys = new Set(distinctByKey.keys());

  let removedDataObjects = 0;
  if (options.removeDataObjectsNotInSkus) {
    removedDataObjects = await removeDataObjectsNotInSkuKeys(db, skuKeys);
  }

  const existingSnap = await db.collection(DATA_OBJECTS_COLLECTION).get();
  const existingKeys = collectDataObjectKeysFromSnap(existingSnap);

  let created = 0;
  let skippedExisting = 0;

  for (const row of distinctByKey.values()) {
    const key = buildDataObjectKey(row);
    if (existingKeys.has(key)) {
      skippedExisting++;
      continue;
    }
    const ref = db.collection(DATA_OBJECTS_COLLECTION).doc();
    await ref.set({
      ...dataObjectToFirestore(row, row.uom),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    existingKeys.add(key);
    created++;
  }

  let quoteObjectsCreated = 0;
  let quoteObjectsUpdated = 0;
  const afterDataObjectsSnap = await db.collection(DATA_OBJECTS_COLLECTION).get();
  for (const doc of afterDataObjectsSnap.docs) {
    if (isDataObjectsMetaDocument(doc.id)) continue;
    const result = await syncQuoteObjectFromDataObject(db, doc.id);
    if (result.action === "created") quoteObjectsCreated++;
    else quoteObjectsUpdated++;
  }

  let removedQuoteObjects = 0;
  if (options.removeQuoteObjectsNotInDataObjects) {
    const afterSnap = await db.collection(DATA_OBJECTS_COLLECTION).get();
    const dataObjectKeys = collectDataObjectKeysFromSnap(afterSnap);
    removedQuoteObjects = await removeQuoteObjectsNotInDataObjectKeys(db, dataObjectKeys);
  }

  const objectCategoryLookups = await syncObjectCategoryLookupsFromQuoteObjects(db);

  return {
    distinctFromSkus: distinctByKey.size,
    created,
    skippedExisting,
    skippedIncomplete: unusableCount,
    removedDataObjects,
    quoteObjectsCreated,
    quoteObjectsUpdated,
    removedQuoteObjects,
    objectCategoryLookupsCreated: objectCategoryLookups.lookupsCreated,
    objectCategoryLookupsAlreadyPresent: objectCategoryLookups.lookupsAlreadyPresent,
  };
}
