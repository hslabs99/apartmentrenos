import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runImportDataBlinds } from "@/lib/server/import-data-blinds";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST — replace data_blinds, data_blinds_types, data_blinds_footers from blinds workbook. */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await runImportDataBlinds(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import blinds";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
