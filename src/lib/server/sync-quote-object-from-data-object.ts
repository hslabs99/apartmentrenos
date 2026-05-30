import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { buildDataObjectKey, type DataObjectKeyFields } from "@/lib/data-object-key";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { ensureObjectCategoryLookup } from "@/lib/server/ensure-object-category-lookup";
import {
  canonicalDataObjectFields,
  dataObjectDocToPublic,
} from "@/lib/server/data-object-doc";
import {
  docToQuoteObjectPublic,
  LM_RUNS_UOM,
  priceRowsAndLegacyTopLevel,
} from "@/lib/server/quote-object-doc";
import { compareTemplateDocs, renumberAllAndNextIndex } from "@/lib/server/template-sort-order";
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

function quoteObjectMatchKey(data: DocumentData): string {
  return buildDataObjectKey({
    category: String(data.category ?? ""),
    productType: String(data.objectname ?? ""),
  });
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
  });
  const objectKey = buildDataObjectKey(fields);
  const uom = mapSkuUomToQuoteUom(dataObject.uom);
  const categoryForLookup = await ensureObjectCategoryLookup(db, fields.category);

  const qoSnap = await db.collection("quote_objects").get();
  const qoDocs = qoSnap.docs
    .filter((d) => !isQuoteObjectsMetaDocument(d.id))
    .map((d) => ({ id: d.id, data: d.data() }));

  const existing = findMatchingQuoteObjectDoc(qoDocs, objectKey);
  const now = FieldValue.serverTimestamp();

  if (existing) {
    await db.collection("quote_objects").doc(existing.id).update({
      uom,
      updatedAt: now,
    });
    const updatedSnap = await db.collection("quote_objects").doc(existing.id).get();
    const quoteObject = docToQuoteObjectPublic(existing.id, updatedSnap.data()!);
    const objectid = quoteObject.objectid ?? null;
    await doRef.update({
      quoteObjectDocId: existing.id,
      objectid,
      uom,
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
  const sortOrder = await renumberAllAndNextIndex(
    db,
    "quote_objects",
    isQuoteObjectsMetaDocument,
    (data) => String(data.objectname ?? ""),
  );
  const measurement =
    uom === LM_RUNS_UOM ? null : DEFAULT_MEASUREMENT_FROM_DATA_OBJECT;
  const { firestorePatch } = priceRowsAndLegacyTopLevel(measurement, []);
  const ref = db.collection("quote_objects").doc();
  await ref.set({
    objectname: fields.productType,
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
  });

  const qoSnap2 = await ref.get();
  const quoteObject = docToQuoteObjectPublic(ref.id, qoSnap2.data()!);
  await doRef.update({
    quoteObjectDocId: ref.id,
    objectid,
    uom,
    updatedAt: now,
  });
  const nextDo = await doRef.get();
  return {
    action: "created",
    dataObject: dataObjectDocToPublic(dataObjectDocId, nextDo.data()!),
    quoteObject,
  };
}
