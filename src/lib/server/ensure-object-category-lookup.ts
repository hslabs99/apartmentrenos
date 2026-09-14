import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { LOOKUP_TYPE_OBJECT_CATEGORY } from "@/lib/lookup-types";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { normalizeObjectCategoryValue } from "@/lib/server/quote-object-categories";

/**
 * Ensure `lookups` has an ObjectCategory row for `category` (trim + case-insensitive).
 * Returns the canonical lookup value stored (existing or new).
 * When `cache` is passed, it is used instead of re-reading `lookups` (misses are written and cached).
 */
export async function ensureObjectCategoryLookup(
  db: Firestore,
  category: string,
  cache?: Map<string, string>,
): Promise<string> {
  const trimmed = category.trim();
  if (!trimmed) return "";

  const norm = normalizeObjectCategoryValue(trimmed);
  const cached = cache?.get(norm);
  if (cached) return cached;

  if (!cache) {
    const snap = await db.collection("lookups").get();
    for (const doc of snap.docs) {
      if (isLookupsMetaDocument(doc.id)) continue;
      const data = doc.data();
      if (String(data.lookuptype ?? "") !== LOOKUP_TYPE_OBJECT_CATEGORY) continue;
      const existing = String(data.lookupvalue ?? "").trim();
      if (normalizeObjectCategoryValue(existing) === norm) return existing;
    }
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
  cache?.set(norm, trimmed);
  return trimmed;
}

export async function loadObjectCategoryLookupCache(
  db: Firestore,
): Promise<Map<string, string>> {
  const snap = await db.collection("lookups").get();
  const cache = new Map<string, string>();
  for (const doc of snap.docs) {
    if (isLookupsMetaDocument(doc.id)) continue;
    const data = doc.data();
    if (String(data.lookuptype ?? "") !== LOOKUP_TYPE_OBJECT_CATEGORY) continue;
    const existing = String(data.lookupvalue ?? "").trim();
    if (!existing) continue;
    const norm = normalizeObjectCategoryValue(existing);
    if (!cache.has(norm)) cache.set(norm, existing);
  }
  return cache;
}
