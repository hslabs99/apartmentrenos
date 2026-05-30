import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runImportObjectLabourRates } from "@/lib/server/import-object-labour-rates";

export const runtime = "nodejs";

/**
 * POST — upsert `data_objectlabourrates` from `Incremental Labour - Products!A3:I150`.
 * Match key: Category + Product Type + Product (columns A–C).
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await runImportObjectLabourRates(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to import incremental labour products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
