import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { blindsQuoteObjectDocId } from "@/lib/google/blinds-type-slug";
import {
  DATA_BLINDS_TYPES_COLLECTION,
  isDataBlindsTypesMetaDocument,
} from "@/lib/firestore/data-blinds-types-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { ensureObjectCategoryLookup } from "@/lib/server/ensure-object-category-lookup";
import { priceRowsAndLegacyTopLevel } from "@/lib/server/quote-object-doc";
import { renumberAllAndNextIndex } from "@/lib/server/template-sort-order";

export const BLINDS_QUOTE_CATEGORY = "Blinds";
export const BLINDS_SYSTEM_OBJECT = "Blinds";
const BLINDS_UOM = "Unit";
const BLINDS_OBJECT_TYPE = "Unit";
const BLINDS_MEASUREMENT = 1;

export type SyncBlindsQuoteObjectsResult = {
  typesProcessed: number;
  created: number;
  updated: number;
  duplicatesRemoved: number;
  orphansRemoved: number;
};

function blindsQuoteObjectPayload(categoryLabel: string, typeName: string) {
  const { firestorePatch } = priceRowsAndLegacyTopLevel(BLINDS_MEASUREMENT, []);
  return {
    objectname: typeName,
    product: "",
    objecttype: BLINDS_OBJECT_TYPE,
    category: categoryLabel,
    systemObject: BLINDS_SYSTEM_OBJECT,
    areaTagIds: [] as string[],
    uom: BLINDS_UOM,
    inheritM2Source: "none" as const,
    inheritAreaM2: false,
    runWidth: null,
    defaultAreaM2: null,
    measurement: BLINDS_MEASUREMENT,
    ...firestorePatch,
    generalHours: null,
    projectManagerHours: null,
    paintingHours: null,
    plasteringHours: null,
    notes1: "",
    notes2: "",
    tooltip: "",
  };
}

/**
 * Upsert one `quote_objects` row per `data_blinds_types` entry (deterministic doc id).
 * Removes duplicate and orphan blind quote objects.
 */
export async function syncBlindsQuoteObjects(
  db: Firestore,
  typeNames?: string[],
): Promise<SyncBlindsQuoteObjectsResult> {
  let types = typeNames?.map((t) => t.trim()).filter(Boolean) ?? [];

  if (types.length === 0) {
    const typesSnap = await db.collection(DATA_BLINDS_TYPES_COLLECTION).get();
    types = typesSnap.docs
      .filter((d) => !isDataBlindsTypesMetaDocument(d.id))
      .map((d) => String(d.data().typeName ?? "").trim())
      .filter(Boolean);
  }

  if (types.length === 0) {
    throw new Error(
      "No blind types found. Import blinds into data_blinds_types first, or pass type names.",
    );
  }

  const categoryLabel = await ensureObjectCategoryLookup(db, BLINDS_QUOTE_CATEGORY);
  const qoSnap = await db.collection("quote_objects").get();
  const allQo = qoSnap.docs.filter((d) => !isQuoteObjectsMetaDocument(d.id));

  const typeNameLowers = new Set(types.map((t) => t.toLowerCase()));
  const targetIds = new Set(types.map((t) => blindsQuoteObjectDocId(t)));

  let duplicatesRemoved = 0;
  let orphansRemoved = 0;

  for (const doc of allQo) {
    const data = doc.data();
    const nameLower = String(data.objectname ?? "").trim().toLowerCase();
    const isBlinds =
      String(data.systemObject ?? "").trim() === BLINDS_SYSTEM_OBJECT ||
      doc.id.startsWith("blinds_") ||
      (String(data.category ?? "").trim() === BLINDS_QUOTE_CATEGORY &&
        typeNameLowers.has(nameLower));

    if (!isBlinds) continue;

    if (targetIds.has(doc.id)) continue;

    if (typeNameLowers.has(nameLower)) {
      await db.collection("quote_objects").doc(doc.id).delete();
      duplicatesRemoved++;
      continue;
    }

    if (
      String(data.systemObject ?? "").trim() === BLINDS_SYSTEM_OBJECT ||
      doc.id.startsWith("blinds_") ||
      String(data.category ?? "").trim() === BLINDS_QUOTE_CATEGORY
    ) {
      await db.collection("quote_objects").doc(doc.id).delete();
      orphansRemoved++;
    }
  }

  const now = FieldValue.serverTimestamp();
  let created = 0;
  let updated = 0;

  for (const typeName of types) {
    const docId = blindsQuoteObjectDocId(typeName);
    const ref = db.collection("quote_objects").doc(docId);
    const existing = await ref.get();
    const payload = blindsQuoteObjectPayload(categoryLabel, typeName);

    if (existing.exists) {
      await ref.update({
        ...payload,
        updatedAt: now,
      });
      updated++;
      continue;
    }

    const objectid = await allocateNextSequence(db, "objectid");
    const sortOrder = await renumberAllAndNextIndex(
      db,
      "quote_objects",
      isQuoteObjectsMetaDocument,
      (data) => String(data.objectname ?? ""),
    );
    await ref.set({
      ...payload,
      objectid,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });
    created++;
  }

  return {
    typesProcessed: types.length,
    created,
    updated,
    duplicatesRemoved,
    orphansRemoved,
  };
}
