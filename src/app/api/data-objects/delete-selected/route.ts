import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runDeleteDataObjects } from "@/lib/server/delete-data-objects";

export const runtime = "nodejs";

/** POST — delete selected `data_objects` rows by document id. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids provided." }, { status: 400 });
    }

    const db = getAdminFirestore();
    const result = await runDeleteDataObjects(db, ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete data objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
