import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataPaintingElementsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_PAINTING_ELEMENTS_COLLECTION,
  isDataPaintingElementsMetaDocument,
} from "@/lib/firestore/data-painting-elements-collection";
import { dataPaintingElementDocToPublic } from "@/lib/server/data-painting-element-doc";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";

export const runtime = "nodejs";

function sortPaintingElements(
  a: DataPaintingElementPublic,
  b: DataPaintingElementPublic,
): number {
  return a.skuName.localeCompare(b.skuName, undefined, { sensitivity: "base" });
}

/** GET — list imported painting elements with nested lines (read-only). */
export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataPaintingElementsBootstrap(db);
    const snap = await db.collection(DATA_PAINTING_ELEMENTS_COLLECTION).get();
    const items: DataPaintingElementPublic[] = snap.docs
      .filter((d) => !isDataPaintingElementsMetaDocument(d.id))
      .map((d) => dataPaintingElementDocToPublic(d.id, d.data()))
      .sort(sortPaintingElements);
    const lineCount = items.reduce((sum, el) => sum + el.lines.length, 0);
    return NextResponse.json({ items, count: items.length, lineCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list painting elements";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
