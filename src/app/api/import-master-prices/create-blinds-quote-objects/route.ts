import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { syncBlindsQuoteObjects } from "@/lib/server/sync-blinds-quote-objects";

export const runtime = "nodejs";

/** POST — upsert one quote_objects row per blind type (refresh anytime). */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await syncBlindsQuoteObjects(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create blinds quote objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
