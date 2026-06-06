import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataBuildingElementsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_BUILDING_ELEMENTS_COLLECTION,
  isDataBuildingElementsMetaDocument,
} from "@/lib/firestore/data-building-elements-collection";
import { dataBuildingElementDocToPublic } from "@/lib/server/data-building-element-doc";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";

export const runtime = "nodejs";

function sortBuildingElements(
  a: DataBuildingElementPublic,
  b: DataBuildingElementPublic,
): number {
  return a.skuName.localeCompare(b.skuName, undefined, { sensitivity: "base" });
}

/** GET — list imported building elements with nested lines (read-only). */
export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataBuildingElementsBootstrap(db);
    const snap = await db.collection(DATA_BUILDING_ELEMENTS_COLLECTION).get();
    const items: DataBuildingElementPublic[] = snap.docs
      .filter((d) => !isDataBuildingElementsMetaDocument(d.id))
      .map((d) => dataBuildingElementDocToPublic(d.id, d.data()))
      .sort(sortBuildingElements);
    const lineCount = items.reduce((sum, el) => sum + el.lines.length, 0);
    return NextResponse.json({ items, count: items.length, lineCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list building elements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
