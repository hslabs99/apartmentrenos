import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataObjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_OBJECTS_COLLECTION,
  isDataObjectsMetaDocument,
} from "@/lib/firestore/data-objects-collection";
import { dataObjectDocToPublic } from "@/lib/server/data-object-doc";
import type { DataObjectPublic } from "@/types/data-object-public";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataObjectsBootstrap(db);
    const snap = await db.collection(DATA_OBJECTS_COLLECTION).get();
    const items: DataObjectPublic[] = snap.docs
      .filter((d) => !isDataObjectsMetaDocument(d.id))
      .map((d) => dataObjectDocToPublic(d.id, d.data()))
      .sort((a, b) => {
        const c = a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
        if (c !== 0) return c;
        const p = a.productType.localeCompare(b.productType, undefined, {
          sensitivity: "base",
        });
        if (p !== 0) return p;
        return a.product.localeCompare(b.product, undefined, {
          sensitivity: "base",
        });
      });
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load data_objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
