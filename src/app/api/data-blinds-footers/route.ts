import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_BLINDS_FOOTERS_COLLECTION,
  isDataBlindsFootersMetaDocument,
} from "@/lib/firestore/data-blinds-footers-collection";
import { dataBlindFooterDocToPublic } from "@/lib/server/data-blind-doc";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const typeFilter = req.nextUrl.searchParams.get("type")?.trim() ?? "";
    const db = getAdminFirestore();
    const snap = await db.collection(DATA_BLINDS_FOOTERS_COLLECTION).get();

    let items = snap.docs
      .filter((d) => !isDataBlindsFootersMetaDocument(d.id))
      .map((d) => dataBlindFooterDocToPublic(d.id, d.data()));

    if (typeFilter) {
      const q = typeFilter.toLowerCase();
      items = items.filter((r) => r.type.toLowerCase() === q);
    }

    items.sort((a, b) => {
      const tc = a.type.localeCompare(b.type, undefined, { sensitivity: "base" });
      if (tc !== 0) return tc;
      return a.sortOrder - b.sortOrder;
    });

    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load data_blinds_footers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
