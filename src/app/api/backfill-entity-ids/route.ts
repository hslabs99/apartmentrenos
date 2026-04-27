import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { backfillAllEntityIds } from "@/lib/server/backfill-entity-ids";

export const runtime = "nodejs";

/**
 * POST: Assign missing numeric IDs (projectid, areaid, objectid, lookupid) on legacy
 * documents and sync sequence counters. Safe to run multiple times (idempotent for
 * docs that already have IDs).
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const summary = await backfillAllEntityIds(db);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backfill failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
