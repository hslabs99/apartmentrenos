import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { MASTER_PRICES_CASCADES_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import { runImportCascades } from "@/lib/server/import-cascades";
import { importRunIdFromError, runSupportingImportWithLog } from "@/lib/server/supporting-import-log";

export const runtime = "nodejs";

/** POST — replace `cascades` from `Cascading Restrictions!A1:C50`. */
export async function POST() {
  const db = getAdminFirestore();
  try {
    const { importRunId, result } = await runSupportingImportWithLog(
      db,
      {
        kind: "supporting_cascades",
        tabTitle: MASTER_PRICES_CASCADES_TAB_TITLE,
        sheetRange: "A1:C50",
      },
      () => runImportCascades(db),
      (result) => ({
        tabTitle: result.tabTitle,
        gid: result.gid,
        sheetRange: result.range,
        headerRow1Based: result.headerRow1Based,
        rowsFound: result.parsed,
        rowsImported: result.written,
        rowsCreated: result.written,
        deletedPrior: result.deletedPrior,
      }),
    );
    return NextResponse.json({ ok: true, importRunId, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import cascades";
    return NextResponse.json(
      { error: message, importRunId: importRunIdFromError(e) },
      { status: 500 },
    );
  }
}
