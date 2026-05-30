/** See import-lists-policy.ts: existing row → notes only; else create. */
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { fetchListsUomRows } from "@/lib/google/fetch-lists-uom-rows";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { LOOKUP_TYPE_UOM } from "@/lib/lookup-types";
import { allocateNextSequence } from "@/lib/firestore/sequences";

export type ImportListsUomResult = {
  tabTitle: string;
  range: string;
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
};

function normalizeKey(lookuptype: string, lookupvalue: string): string {
  return `${lookuptype.trim().toLowerCase()}\x1e${lookupvalue.trim().toLowerCase()}`;
}

export async function runImportListsUom(db: Firestore): Promise<ImportListsUomResult> {
  const fetched = await fetchListsUomRows();
  const rows = fetched.rows;

  const snap = await db.collection("lookups").get();
  const existingByKey = new Map<string, { id: string }>();
  for (const doc of snap.docs) {
    if (isLookupsMetaDocument(doc.id)) continue;
    const data = doc.data();
    const type = String(data.lookuptype ?? "");
    const value = String(data.lookupvalue ?? "");
    if (type !== LOOKUP_TYPE_UOM) continue;
    existingByKey.set(normalizeKey(type, mapSkuUomToQuoteUom(value)), { id: doc.id });
  }

  let created = 0;
  let updated = 0;
  const now = FieldValue.serverTimestamp();

  for (const row of rows) {
    const lookupvalue = mapSkuUomToQuoteUom(row.lookupvalue);
    const key = normalizeKey(row.lookuptype, lookupvalue);
    const hit = existingByKey.get(key);

    if (hit) {
      await db.collection("lookups").doc(hit.id).update({
        lookupvalue,
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
      lookupvalue,
      notes: row.notes,
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
    skipped: 0,
  };
}
