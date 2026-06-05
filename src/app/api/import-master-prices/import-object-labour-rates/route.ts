import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import { runImportObjectLabourRates } from "@/lib/server/import-object-labour-rates";
import { importRunIdFromError, runSupportingImportWithLog } from "@/lib/server/supporting-import-log";

export const runtime = "nodejs";

/**
 * POST — replace `data_objectlabourrates` from `Incremental Labour - Products!A3:I150`.
 * Collection is cleared first; Product (column C) is stored only when populated on the sheet.
 */
export async function POST() {
  const db = getAdminFirestore();
  try {
    const { importRunId, result } = await runSupportingImportWithLog(
      db,
      {
        kind: "supporting_incremental_labour",
        tabTitle: MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
        sheetRange: "A3:I150",
      },
      () => runImportObjectLabourRates(db),
      (result) => ({
        tabTitle: result.tabTitle,
        gid: result.gid,
        sheetRange: result.range,
        headerRow1Based: result.headerRow1Based,
        rowsFound: result.parsed,
        rowsImported: result.written,
        rowsCreated: result.written,
        deletedPrior: result.deletedPrior,
        parseErrors: result.parseErrors,
      }),
    );
    return NextResponse.json({ ok: true, importRunId, ...result });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to import incremental labour products";
    return NextResponse.json(
      { error: message, importRunId: importRunIdFromError(e) },
      { status: 500 },
    );
  }
}
