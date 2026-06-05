/** See import-lists-policy.ts: existing row → notes only; else create. */
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { fetchListsStyleRows } from "@/lib/google/fetch-lists-style-rows";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import { LOOKUP_TYPE_STYLE } from "@/lib/lookup-types";
import { allocateNextSequence } from "@/lib/firestore/sequences";

export type ImportListsStylesResult = {
  tabTitle: string;
  gid: number;
  range: string;
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
};

function normalizeKey(lookuptype: string, lookupvalue: string): string {
  return `${lookuptype.trim().toLowerCase()}\x1e${lookupvalue.trim().toLowerCase()}`;
}

export async function runImportListsStyles(
  db: Firestore,
): Promise<ImportListsStylesResult> {
  const fetched = await fetchListsStyleRows();
  const rows = fetched.rows;

  const snap = await db.collection("lookups").get();
  const existingByKey = new Map<string, { id: string }>();
  for (const doc of snap.docs) {
    if (isLookupsMetaDocument(doc.id)) continue;
    const data = doc.data();
    const type = String(data.lookuptype ?? "");
    const value = String(data.lookupvalue ?? "");
    if (type !== LOOKUP_TYPE_STYLE) continue;
    existingByKey.set(normalizeKey(type, value), { id: doc.id });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const now = FieldValue.serverTimestamp();

  for (const row of rows) {
    if (isAllLookupOrFilterValue(row.lookupvalue)) {
      skipped++;
      continue;
    }
    const key = normalizeKey(row.lookuptype, row.lookupvalue);
    const hit = existingByKey.get(key);

    if (hit) {
      await db.collection("lookups").doc(hit.id).update({
        notes: row.notes,
        updatedAt: now,
      });
      updated++;
      continue;
    }

    const lookupid = await allocateNextSequence(db, "lookupid");
    const ref = await db.collection("lookups").add({
      lookupid,
      lookuptype: row.lookuptype,
      lookupvalue: row.lookupvalue,
      notes: row.notes,
      createdAt: now,
      updatedAt: now,
    });
    existingByKey.set(key, { id: ref.id });
    created++;
  }

  return {
    tabTitle: fetched.tabTitle,
    gid: fetched.gid,
    range: fetched.range,
    parsed: rows.length,
    created,
    updated,
    skipped,
  };
}
