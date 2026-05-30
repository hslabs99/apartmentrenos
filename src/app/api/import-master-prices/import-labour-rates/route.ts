import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runImportLabourRates } from "@/lib/server/import-labour-rates";

export const runtime = "nodejs";

/** POST — replace `data_labourrates` from `Products_Labour` (row 5 headers, row 6+ data). */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await runImportLabourRates(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import labour rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
