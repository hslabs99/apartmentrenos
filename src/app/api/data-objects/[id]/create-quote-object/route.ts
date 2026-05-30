import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isDataObjectsMetaDocument } from "@/lib/firestore/data-objects-collection";
import { syncQuoteObjectFromDataObject } from "@/lib/server/sync-quote-object-from-data-object";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const result = await syncQuoteObjectFromDataObject(db, id);
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create or update quote object";
    const status = message === "Data object not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
