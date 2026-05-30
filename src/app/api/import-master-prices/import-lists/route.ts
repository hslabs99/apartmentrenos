import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { runImportListsColours } from "@/lib/server/import-lists-colours";
import { runImportListsStyles } from "@/lib/server/import-lists-styles";
import { runImportListsUom } from "@/lib/server/import-lists-uom";

export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getAdminFirestore();
    const [styles, colours, uom] = await Promise.all([
      runImportListsStyles(db),
      runImportListsColours(db),
      runImportListsUom(db),
    ]);
    return NextResponse.json({
      ok: true,
      styles,
      colours,
      uom,
      // Legacy flat fields for older UI (styles only)
      tabTitle: styles.tabTitle,
      range: styles.range,
      parsed: styles.parsed,
      created: styles.created,
      updated: styles.updated,
      skipped: styles.skipped,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import lists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
