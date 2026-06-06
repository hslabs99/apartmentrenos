import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { LOOKUP_TYPE_OBJECT_CATEGORY } from "@/lib/lookup-types";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import {
  collectQuoteObjectCategoryLabels,
  normalizeObjectCategoryValue,
} from "@/lib/server/quote-object-categories";

export type SyncObjectCategoryLookupsResult = {
  categoriesFromQuoteObjects: number;
  lookupsCreated: number;
  lookupsAlreadyPresent: number;
};

async function loadExistingObjectCategoryNorms(db: Firestore): Promise<Set<string>> {
  const snap = await db.collection("lookups").get();
  const norms = new Set<string>();
  for (const doc of snap.docs) {
    if (isLookupsMetaDocument(doc.id)) continue;
    const data = doc.data();
    if (String(data.lookuptype ?? "") !== LOOKUP_TYPE_OBJECT_CATEGORY) continue;
    const existing = String(data.lookupvalue ?? "").trim();
    if (!existing) continue;
    norms.add(normalizeObjectCategoryValue(existing));
  }
  return norms;
}

/**
 * Ensure every distinct quote_objects.category has a matching ObjectCategory lookup row.
 * Existing lookups are left unchanged (case-insensitive match).
 */
export async function syncObjectCategoryLookupsFromQuoteObjects(
  db: Firestore,
): Promise<SyncObjectCategoryLookupsResult> {
  const categories = await collectQuoteObjectCategoryLabels(db);
  const existingNorms = await loadExistingObjectCategoryNorms(db);

  let lookupsCreated = 0;
  let lookupsAlreadyPresent = 0;
  const now = FieldValue.serverTimestamp();

  for (const category of categories) {
    const norm = normalizeObjectCategoryValue(category);
    if (existingNorms.has(norm)) {
      lookupsAlreadyPresent++;
      continue;
    }
    const lookupid = await allocateNextSequence(db, "lookupid");
    await db.collection("lookups").add({
      lookupid,
      lookuptype: LOOKUP_TYPE_OBJECT_CATEGORY,
      lookupvalue: category,
      notes: "",
      createdAt: now,
      updatedAt: now,
    });
    existingNorms.add(norm);
    lookupsCreated++;
  }

  return {
    categoriesFromQuoteObjects: categories.length,
    lookupsCreated,
    lookupsAlreadyPresent,
  };
}
