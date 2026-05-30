import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureCascadesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  CASCADES_COLLECTION,
  isCascadesMetaDocument,
} from "@/lib/firestore/cascades-collection";
import { cascadeDocToPublic } from "@/lib/server/cascade-doc";
import type { CascadePublic } from "@/types/cascade-public";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureCascadesBootstrap(db);
    const snap = await db.collection(CASCADES_COLLECTION).get();
    const items: CascadePublic[] = snap.docs
      .filter((d) => !isCascadesMetaDocument(d.id))
      .map((d) => cascadeDocToPublic(d.id, d.data()))
      .sort((a, b) => {
        const l = a.level.localeCompare(b.level, undefined, { sensitivity: "base" });
        if (l !== 0) return l;
        const s = a.style.localeCompare(b.style, undefined, { sensitivity: "base" });
        if (s !== 0) return s;
        return a.colour.localeCompare(b.colour, undefined, { sensitivity: "base" });
      });
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load cascades";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
