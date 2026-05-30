import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_BLINDS_TYPES_COLLECTION,
  isDataBlindsTypesMetaDocument,
} from "@/lib/firestore/data-blinds-types-collection";
import { dataBlindTypeDocToPublic } from "@/lib/server/data-blind-doc";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(DATA_BLINDS_TYPES_COLLECTION).get();
    const items = snap.docs
      .filter((d) => !isDataBlindsTypesMetaDocument(d.id))
      .map((d) => dataBlindTypeDocToPublic(d.id, d.data()))
      .sort((a, b) =>
        a.typeName.localeCompare(b.typeName, undefined, { sensitivity: "base" }),
      );
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load data_blinds_types";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
