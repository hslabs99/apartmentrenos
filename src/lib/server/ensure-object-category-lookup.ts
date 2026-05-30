import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { LOOKUP_TYPE_OBJECT_CATEGORY } from "@/lib/lookup-types";
import { allocateNextSequence } from "@/lib/firestore/sequences";

function normalizeLookupValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Ensure `lookups` has an ObjectCategory row for `category` (trim + case-insensitive).
 * Returns the canonical lookup value stored (existing or new).
 */
export async function ensureObjectCategoryLookup(
  db: Firestore,
  category: string,
): Promise<string> {
  const trimmed = category.trim();
  if (!trimmed) return "";

  const snap = await db.collection("lookups").get();
  const norm = normalizeLookupValue(trimmed);
  for (const doc of snap.docs) {
    if (isLookupsMetaDocument(doc.id)) continue;
    const data = doc.data();
    if (String(data.lookuptype ?? "") !== LOOKUP_TYPE_OBJECT_CATEGORY) continue;
    const existing = String(data.lookupvalue ?? "").trim();
    if (normalizeLookupValue(existing) === norm) return existing;
  }

  const lookupid = await allocateNextSequence(db, "lookupid");
  await db.collection("lookups").add({
    lookupid,
    lookuptype: LOOKUP_TYPE_OBJECT_CATEGORY,
    lookupvalue: trimmed,
    notes: "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return trimmed;
}
