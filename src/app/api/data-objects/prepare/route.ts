import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runPrepareDataObjects } from "@/lib/server/prepare-data-objects";

export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await runPrepareDataObjects(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to prepare data objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
