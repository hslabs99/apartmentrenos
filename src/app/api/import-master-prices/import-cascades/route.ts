import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runImportCascades } from "@/lib/server/import-cascades";

export const runtime = "nodejs";

/** POST — replace `cascades` from `Cascading Restrictions!A1:C50`. */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const result = await runImportCascades(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import cascades";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
