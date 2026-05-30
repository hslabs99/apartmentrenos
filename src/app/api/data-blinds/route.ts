import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_BLINDS_COLLECTION,
  isDataBlindsMetaDocument,
} from "@/lib/firestore/data-blinds-collection";
import { dataBlindDocToPublic } from "@/lib/server/data-blind-doc";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const typeFilter = req.nextUrl.searchParams.get("type")?.trim() ?? "";
    const db = getAdminFirestore();
    const snap = await db.collection(DATA_BLINDS_COLLECTION).get();

    let items = snap.docs
      .filter((d) => !isDataBlindsMetaDocument(d.id))
      .map((d) => dataBlindDocToPublic(d.id, d.data()));

    if (typeFilter) {
      const q = typeFilter.toLowerCase();
      items = items.filter((r) => r.type.toLowerCase() === q);
    }

    items.sort((a, b) => {
      const tc = a.type.localeCompare(b.type, undefined, { sensitivity: "base" });
      if (tc !== 0) return tc;
      return a.dropMm - b.dropMm;
    });

    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load data_blinds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
