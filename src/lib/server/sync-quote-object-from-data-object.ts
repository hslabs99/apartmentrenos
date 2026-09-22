import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { buildDataObjectKey, type DataObjectKeyFields } from "@/lib/data-object-key";
import { quoteObjectSkuPipelineKey } from "@/lib/server/quote-object-sku-pipeline";
import { mapSkuUomToQuoteUom, resolveExistingObjectUomFromPriceList } from "@/lib/map-sku-uom-to-quote-uom";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import {
  ensureObjectCategoryLookup,
  loadObjectCategoryLookupCache,
} from "@/lib/server/ensure-object-category-lookup";
import {
  canonicalDataObjectFields,
  dataObjectDocToPublic,
} from "@/lib/server/data-object-doc";
import {
  docToQuoteObjectPublic,
  LM_RUNS_UOM,
  priceRowsAndLegacyTopLevel,
} from "@/lib/server/quote-object-doc";
import { nextAppendSortOrder } from "@/lib/server/template-sort-order";
import type { DataObjectPublic } from "@/types/data-object-public";
import type { QuoteObjectPublic } from "@/types/quote-object";

const DEFAULT_OBJECT_TYPE = "Unit";
/** Default qty / measure on quote objects created from Import → Data Objects. */
const DEFAULT_MEASUREMENT_FROM_DATA_OBJECT = 1;

export type SyncQuoteObjectFromDataObjectResult = {
  action: "created" | "updated";
  dataObject: DataObjectPublic;
  quoteObject: QuoteObjectPublic;
};

export type PrepareQuoteObjectAction = "created" | "updated" | "skipped";

export type PrepareQuoteObjectCache = {
  qoDocs: { id: string; data: DocumentData }[];
  nextSortOrder: number;
  categoryByNorm: Map<string, string>;
};

function quoteObjectMatchKey(data: DocumentData): string {
  return quoteObjectSkuPipelineKey(data);
}

function findMatchingQuoteObjectDoc(
  docs: { id: string; data: DocumentData }[],
  objectKey: string,
): { id: string; data: DocumentData } | null {
  const matches = docs.filter((d) => quoteObjectMatchKey(d.data) === objectKey);
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const ao = Number(a.data.objectid);
    const bo = Number(b.data.objectid);
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
  return matches[0] ?? null;
}

function quoteObjectPayloadFromDataObject(
  objectname: string,
  categoryForLookup: string,
  uom: string,
  objectid: number,
  sortOrder: number,
) {
  const measurement =
    uom === LM_RUNS_UOM ? null : DEFAULT_MEASUREMENT_FROM_DATA_OBJECT;
  const { firestorePatch } = priceRowsAndLegacyTopLevel(measurement, []);
  const now = FieldValue.serverTimestamp();
  return {
    objectname,
    product: "",
    objecttype: DEFAULT_OBJECT_TYPE,
    category: categoryForLookup,
    areaTagIds: [],
    uom,
    inheritM2Source: "none",
    inheritAreaM2: false,
    runWidth: null,
    defaultAreaM2: null,
    measurement,
    ...firestorePatch,
    generalHours: null,
    projectManagerHours: null,
    paintingHours: null,
    plasteringHours: null,
    notes1: "",
    notes2: "",
    tooltip: "",
    objectid,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export async function loadPrepareQuoteObjectCache(
  db: Firestore,
): Promise<PrepareQuoteObjectCache> {
  const qoSnap = await db.collection("quote_objects").get();
  const qoDocs = qoSnap.docs
    .filter((d) => !isQuoteObjectsMetaDocument(d.id))
    .map((d) => ({ id: d.id, data: d.data() }));
  let maxSort = -1;
  for (const doc of qoDocs) {
    const so = doc.data.sortOrder;
    if (typeof so === "number" && Number.isFinite(so) && so > maxSort) maxSort = so;
  }
  const categoryByNorm = await loadObjectCategoryLookupCache(db);
  return {
    qoDocs,
    nextSortOrder: maxSort + 1,
    categoryByNorm,
  };
}

/**
 * Prepare pass: match in memory. Missing quote objects are appended.
 * Existing objects keep Setup fields (prices, inherit, run width, UOM) except a
 * price-list `LM-Runs` upgrades object UOM. Other sheet UOMs do not overwrite.
 */
export async function prepareQuoteObjectForDataObject(
  db: Firestore,
  dataObjectDocId: string,
  dataObjectData: DocumentData,
  cache: PrepareQuoteObjectCache,
): Promise<PrepareQuoteObjectAction> {
  const dataObject = dataObjectDocToPublic(dataObjectDocId, dataObjectData);
  const fields: DataObjectKeyFields = canonicalDataObjectFields({
    category: dataObject.category,
    productType: dataObject.productType,
    product: dataObject.product,
  });
  const objectKey = buildDataObjectKey(fields);
  const existing = findMatchingQuoteObjectDoc(cache.qoDocs, objectKey);
  const doRef = db.collection("data_objects").doc(dataObjectDocId);
  const sheetUom = mapSkuUomToQuoteUom(dataObject.uom);

  if (existing) {
    const objectid =
      typeof existing.data.objectid === "number" && Number.isFinite(existing.data.objectid)
        ? existing.data.objectid
        : null;
    const alreadyLinked =
      dataObject.quoteObjectDocId === existing.id &&
      dataObject.objectid === objectid;
    const prevUom = String(existing.data.uom ?? "");
    const nextUom = resolveExistingObjectUomFromPriceList(prevUom, sheetUom);
    const uomChanged = nextUom !== mapSkuUomToQuoteUom(prevUom);
    const now = FieldValue.serverTimestamp();
    if (uomChanged) {
      await db.collection("quote_objects").doc(existing.id).update({
        uom: nextUom,
        updatedAt: now,
      });
      existing.data.uom = nextUom;
    }
    if (!alreadyLinked || uomChanged) {
      await doRef.update({
        ...(alreadyLinked
          ? {}
          : { quoteObjectDocId: existing.id, objectid }),
        uom: nextUom,
        updatedAt: now,
      });
    }
    return uomChanged ? "updated" : "skipped";
  }

  const objectname = fields.product?.trim() ? fields.product : fields.productType;
  const categoryForLookup = await ensureObjectCategoryLookup(
    db,
    fields.category,
    cache.categoryByNorm,
  );
  const objectid = await allocateNextSequence(db, "objectid");
  const sortOrder = cache.nextSortOrder;
  cache.nextSortOrder += 1;
  const payload = quoteObjectPayloadFromDataObject(
    objectname,
    categoryForLookup,
    sheetUom,
    objectid,
    sortOrder,
  );
  const ref = db.collection("quote_objects").doc();
  await ref.set(payload);
  cache.qoDocs.push({ id: ref.id, data: payload as DocumentData });
  await doRef.update({
    quoteObjectDocId: ref.id,
    objectid,
    uom: sheetUom,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return "created";
}

export async function syncQuoteObjectFromDataObject(
  db: Firestore,
  dataObjectDocId: string,
): Promise<SyncQuoteObjectFromDataObjectResult> {
  const doRef = db.collection("data_objects").doc(dataObjectDocId);
  const doSnap = await doRef.get();
  if (!doSnap.exists) {
    throw new Error("Data object not found");
  }

  const dataObject = dataObjectDocToPublic(dataObjectDocId, doSnap.data()!);
  const fields: DataObjectKeyFields = canonicalDataObjectFields({
    category: dataObject.category,
    productType: dataObject.productType,
    product: dataObject.product,
  });
  const objectKey = buildDataObjectKey(fields);
  const objectname = fields.product?.trim() ? fields.product : fields.productType;
  const sheetUom = mapSkuUomToQuoteUom(dataObject.uom);
  const categoryForLookup = await ensureObjectCategoryLookup(db, fields.category);

  const qoSnap = await db.collection("quote_objects").get();
  const qoDocs = qoSnap.docs
    .filter((d) => !isQuoteObjectsMetaDocument(d.id))
    .map((d) => ({ id: d.id, data: d.data() }));

  const existing = findMatchingQuoteObjectDoc(qoDocs, objectKey);
  const now = FieldValue.serverTimestamp();

  if (existing) {
    const nextUom = resolveExistingObjectUomFromPriceList(
      String(existing.data.uom ?? ""),
      sheetUom,
    );
    await db.collection("quote_objects").doc(existing.id).update({
      uom: nextUom,
      updatedAt: now,
    });
    const updatedSnap = await db.collection("quote_objects").doc(existing.id).get();
    const quoteObject = docToQuoteObjectPublic(existing.id, updatedSnap.data()!);
    const objectid = quoteObject.objectid ?? null;
    await doRef.update({
      quoteObjectDocId: existing.id,
      objectid,
      uom: nextUom,
      updatedAt: now,
    });
    const nextDo = await doRef.get();
    return {
      action: "updated",
      dataObject: dataObjectDocToPublic(dataObjectDocId, nextDo.data()!),
      quoteObject,
    };
  }

  const objectid = await allocateNextSequence(db, "objectid");
  const sortOrder = await nextAppendSortOrder(
    db,
    "quote_objects",
    isQuoteObjectsMetaDocument,
  );
  const payload = quoteObjectPayloadFromDataObject(
    objectname,
    categoryForLookup,
    sheetUom,
    objectid,
    sortOrder,
  );
  const ref = db.collection("quote_objects").doc();
  await ref.set(payload);

  const qoSnap2 = await ref.get();
  const quoteObject = docToQuoteObjectPublic(ref.id, qoSnap2.data()!);
  await doRef.update({
    quoteObjectDocId: ref.id,
    objectid,
    uom: sheetUom,
    updatedAt: now,
  });
  const nextDo = await doRef.get();
  return {
    action: "created",
    dataObject: dataObjectDocToPublic(dataObjectDocId, nextDo.data()!),
    quoteObject,
  };
}
