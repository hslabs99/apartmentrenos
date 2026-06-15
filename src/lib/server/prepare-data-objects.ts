import {
  FieldValue,
  type DocumentData,
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
  DATA_LABOURRATES_COLLECTION,
  isDataLabourratesMetaDocument,
} from "@/lib/firestore/data-labourrates-collection";
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
import { LABOUR_PREPARE_OBJECT_PRODUCT_TYPE } from "@/lib/labour-silo";
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
import {
  loadExistingProductKeyMap,
  resolveSkuImportIds,
} from "@/lib/server/resolve-sku-import-ids";
import { syncObjectCategoryLookupsFromQuoteObjects } from "@/lib/server/sync-object-category-lookups-from-quote-objects";
import { syncQuoteObjectFromDataObject } from "@/lib/server/sync-quote-object-from-data-object";
import type { DataSku } from "@/types/data-sku";

const DELETE_BATCH_SIZE = 500;
const WRITE_BATCH_SIZE = 400;

export type PrepareDataObjectsOptions = {
  /** Delete `data_objects` whose keys are not in current `data_skus` or `data_labourrates`. */
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
  distinctFromLabourRates: number;
  created: number;
  mergedExisting: number;
  skippedIncomplete: number;
  labourSkusCreated: number;
  labourSkusUpdated: number;
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

function collectDistinctRowsFromLabourRates(
  labourSnap: QuerySnapshot,
): { distinctByKey: Map<string, DistinctRow>; unusableCount: number } {
  const distinctByKey = new Map<string, DistinctRow>();
  let unusableCount = 0;

  for (const doc of labourSnap.docs) {
    if (isDataLabourratesMetaDocument(doc.id)) continue;
    const data = doc.data();
    const fields: DataObjectKeyFields = {
      category: String(data.category ?? ""),
      productType: String(data.product ?? ""),
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

function mergeDistinctRows(
  skuRows: Map<string, DistinctRow>,
  labourRows: Map<string, DistinctRow>,
): Map<string, DistinctRow> {
  const merged = new Map(skuRows);
  for (const [key, row] of labourRows) {
    if (!merged.has(key)) merged.set(key, row);
  }
  return merged;
}

function collectDataObjectIdsByKey(snap: QuerySnapshot): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const doc of snap.docs) {
    if (isDataObjectsMetaDocument(doc.id)) continue;
    const data = doc.data();
    const key = dataObjectKeyFromFields({
      category: String(data.category ?? ""),
      productType: String(data.productType ?? ""),
      product: String(data.product ?? ""),
    });
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, doc.id);
  }
  return byKey;
}

async function removeDataObjectsNotInAllowedKeys(
  db: Firestore,
  allowedKeys: Set<string>,
): Promise<number> {
  const existingSnap = await db.collection(DATA_OBJECTS_COLLECTION).get();
  const toDelete = existingSnap.docs.filter((d) => {
    if (isDataObjectsMetaDocument(d.id)) return false;
    const key = dataObjectKeyFromFields({
      category: String(d.data().category ?? ""),
      productType: String(d.data().productType ?? ""),
      product: String(d.data().product ?? ""),
    });
    return !key || !allowedKeys.has(key);
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
      product: String(doc.data().product ?? ""),
    });
    if (key) keys.add(key);
  }
  return keys;
}

function labourRateToDataSku(data: DocumentData): DataSku | null {
  const category = String(data.category ?? "").trim();
  const product = String(data.product ?? "").trim();
  if (!category || !product) return null;
  return {
    skuId: "TEMP",
    category,
    productType: LABOUR_PREPARE_OBJECT_PRODUCT_TYPE,
    product,
    elevateLevel: "All",
    style: "All",
    colourOptions: "All",
    uom: String(data.uom ?? "").trim(),
    append1Type: "",
    append1Spec: "",
    append2Type: "",
    append2Spec: "",
    append3Type: "",
    append3Spec: "",
    sheetWidth: "",
    stockAvailable: "",
    leadTime: "",
    location: "",
    comments: "",
    sourceSheetRows: [],
    isCurrent: true,
    calcM2: false,
    calculatedM2: null,
  };
}

async function upsertLabourSkusFromRates(
  db: Firestore,
  labourSnap: QuerySnapshot,
): Promise<{ created: number; updated: number }> {
  const products: DataSku[] = [];
  for (const doc of labourSnap.docs) {
    if (isDataLabourratesMetaDocument(doc.id)) continue;
    const row = labourRateToDataSku(doc.data());
    if (row) products.push(row);
  }
  if (products.length === 0) return { created: 0, updated: 0 };

  const skuSnap = await db.collection(DATA_SKUS_COLLECTION).get();
  const existingByKey = loadExistingProductKeyMap(
    skuSnap.docs
      .filter((d) => !isDataSkusMetaDocument(d.id))
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          data: {
            category: String(data.category ?? ""),
            productType: String(data.productType ?? ""),
            product: String(data.product ?? data.description ?? ""),
            elevateLevel: String(data.elevateLevel ?? ""),
            style: String(data.style ?? ""),
            colourOptions: String(data.colourOptions ?? ""),
          },
        };
      }),
  );

  const resolved = resolveSkuImportIds(products, [], existingByKey);
  const importRunId = `prepare-labour-${Date.now()}`;
  const now = FieldValue.serverTimestamp();

  for (let i = 0; i < resolved.products.length; i += WRITE_BATCH_SIZE) {
    const chunk = resolved.products.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      const ref = db.collection(DATA_SKUS_COLLECTION).doc(row.skuId);
      batch.set(ref, {
        skuId: row.skuId,
        category: row.category,
        productType: row.productType,
        product: row.product,
        elevateLevel: row.elevateLevel,
        style: row.style,
        colourOptions: row.colourOptions,
        uom: row.uom,
        append1Type: row.append1Type,
        append1Spec: row.append1Spec,
        append2Type: row.append2Type,
        append2Spec: row.append2Spec,
        append3Type: row.append3Type,
        append3Spec: row.append3Spec,
        stockAvailable: row.stockAvailable,
        leadTime: row.leadTime,
        location: row.location,
        comments: row.comments,
        sourceSheetRows: row.sourceSheetRows,
        isCurrent: true,
        importRunId,
        importedAt: now,
        updatedAt: now,
      }, { merge: true });
    }
    await batch.commit();
  }

  return {
    created: resolved.productsCreated,
    updated: resolved.productsUpdated,
  };
}

export async function runPrepareDataObjects(
  db: Firestore,
  options: PrepareDataObjectsOptions = {},
): Promise<PrepareDataObjectsResult> {
  await ensureDataObjectsBootstrap(db);

  const skuSnap = await db.collection(DATA_SKUS_COLLECTION).get();
  const labourSnap = await db.collection(DATA_LABOURRATES_COLLECTION).get();
  const { distinctByKey: skuDistinct, unusableCount: skuUnusable } =
    collectDistinctRowsFromSkus(skuSnap);
  const { distinctByKey: labourDistinct, unusableCount: labourUnusable } =
    collectDistinctRowsFromLabourRates(labourSnap);
  const distinctByKey = mergeDistinctRows(skuDistinct, labourDistinct);
  const allowedKeys = new Set(distinctByKey.keys());

  let removedDataObjects = 0;
  if (options.removeDataObjectsNotInSkus) {
    removedDataObjects = await removeDataObjectsNotInAllowedKeys(db, allowedKeys);
  }

  const existingSnap = await db.collection(DATA_OBJECTS_COLLECTION).get();
  const existingByKey = collectDataObjectIdsByKey(existingSnap);

  let created = 0;
  let mergedExisting = 0;
  const now = FieldValue.serverTimestamp();

  for (const row of distinctByKey.values()) {
    const key = buildDataObjectKey(row);
    const existingId = existingByKey.get(key);
    const payload = dataObjectToFirestore(row, row.uom);
    if (existingId) {
      await db.collection(DATA_OBJECTS_COLLECTION).doc(existingId).update({
        ...payload,
        updatedAt: now,
      });
      mergedExisting++;
      continue;
    }
    const ref = db.collection(DATA_OBJECTS_COLLECTION).doc();
    await ref.set({
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
    existingByKey.set(key, ref.id);
    created++;
  }

  const { created: labourSkusCreated, updated: labourSkusUpdated } =
    await upsertLabourSkusFromRates(db, labourSnap);

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
    distinctFromSkus: skuDistinct.size,
    distinctFromLabourRates: labourDistinct.size,
    created,
    mergedExisting,
    skippedIncomplete: skuUnusable + labourUnusable,
    labourSkusCreated,
    labourSkusUpdated,
    removedDataObjects,
    quoteObjectsCreated,
    quoteObjectsUpdated,
    removedQuoteObjects,
    objectCategoryLookupsCreated: objectCategoryLookups.lookupsCreated,
    objectCategoryLookupsAlreadyPresent: objectCategoryLookups.lookupsAlreadyPresent,
  };
}
