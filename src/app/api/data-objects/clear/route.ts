import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runClearDataObjects } from "@/lib/server/clear-data-objects";

export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await runClearDataObjects(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to clear data_objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
