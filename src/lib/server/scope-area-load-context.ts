import type { Firestore } from "firebase-admin/firestore";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import {
  buildScopeTemplateAreaRowsFromFirestore,
  type ScopeTemplateAreaRow,
} from "@/lib/server/scope-doc";

export type ScopeAreaContext = {
  docIdByAreaid: Map<number, string>;
  nameByAreaid: Map<number, string>;
  areasOrdered: ScopeTemplateAreaRow[];
};

export async function loadScopeAreaContext(db: Firestore): Promise<ScopeAreaContext> {
  const snap = await db.collection("areas").get();
  const areaDocs = snap.docs.filter((d) => !isAreasMetaDocument(d.id));
  const docIdByAreaid = new Map<number, string>();
  const nameByAreaid = new Map<number, string>();
  for (const d of areaDocs) {
    const data = d.data();
    const aid = Number(data.areaid);
    if (Number.isInteger(aid)) {
      docIdByAreaid.set(aid, d.id);
      nameByAreaid.set(aid, String(data.areaname ?? ""));
    }
  }
  const areasOrdered = buildScopeTemplateAreaRowsFromFirestore(areaDocs);
  return { docIdByAreaid, nameByAreaid, areasOrdered };
}
