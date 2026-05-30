/** See import-lists-policy.ts: existing row → notes only; else create. */
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { fetchListsColourRows } from "@/lib/google/fetch-lists-colour-rows";
import {
  LOOKUPS_COLOURS_COLLECTION,
  isLookupsColoursMetaDocument,
} from "@/lib/firestore/lookups-colours-collection";
import { buildLookupColourKey } from "@/lib/lookup-colour-key";
import { canonicalLookupColourFields, lookupColourKeyFromFields } from "@/lib/server/lookup-colour-doc";
import { ensureLookupsColoursBootstrap } from "@/lib/firestore/collection-bootstrap";
import { allocateNextSequence } from "@/lib/firestore/sequences";

export type ImportListsColoursResult = {
  tabTitle: string;
  range: string;
  parsed: number;
  created: number;
  updated: number;
};

export async function runImportListsColours(
  db: Firestore,
): Promise<ImportListsColoursResult> {
  await ensureLookupsColoursBootstrap(db);
  const fetched = await fetchListsColourRows();
  const rows = fetched.rows;

  const snap = await db.collection(LOOKUPS_COLOURS_COLLECTION).get();
  const existingByKey = new Map<string, { id: string }>();
  for (const doc of snap.docs) {
    if (isLookupsColoursMetaDocument(doc.id)) continue;
    const data = doc.data();
    const key =
      String(data.colourKey ?? "").trim() ||
      lookupColourKeyFromFields({
        category: String(data.category ?? ""),
        colourClass: String(data.colourClass ?? ""),
        descriptor: String(data.descriptor ?? ""),
      });
    if (key) existingByKey.set(key, { id: doc.id });
  }

  let created = 0;
  let updated = 0;
  const now = FieldValue.serverTimestamp();

  for (const row of rows) {
    const canon = canonicalLookupColourFields({
      category: row.category,
      colourClass: row.colourClass,
      descriptor: row.descriptor,
    });
    const key = buildLookupColourKey(canon);
    const hit = existingByKey.get(key);

    if (hit) {
      await db.collection(LOOKUPS_COLOURS_COLLECTION).doc(hit.id).update({
        notes: row.notes,
        updatedAt: now,
      });
      updated++;
      continue;
    }

    const colourLookupId = await allocateNextSequence(db, "colourlookupid");
    const ref = await db.collection(LOOKUPS_COLOURS_COLLECTION).add({
      colourLookupId,
      category: canon.category,
      colourClass: canon.colourClass,
      descriptor: canon.descriptor,
      notes: row.notes,
      colourKey: key,
      createdAt: now,
      updatedAt: now,
    });
    existingByKey.set(key, { id: ref.id });
    created++;
  }

  return {
    tabTitle: fetched.tabTitle,
    range: fetched.range,
    parsed: rows.length,
    created,
    updated,
  };
}
