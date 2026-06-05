import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { MASTER_PRICES_CONTRACTOR_RATES_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import { runImportProductContractorRates } from "@/lib/server/import-product-contractor-rates";
import { runSupportingImportWithLog, importRunIdFromError } from "@/lib/server/supporting-import-log";

export const runtime = "nodejs";

/** POST — replace `data_productcontractorrates` from `Products_ContractorRates` (row 5 headers, row 6+ data). */
export async function POST() {
  const db = getAdminFirestore();
  try {
    const { importRunId, result } = await runSupportingImportWithLog(
      db,
      {
        kind: "supporting_product_contractor_rates",
        tabTitle: MASTER_PRICES_CONTRACTOR_RATES_TAB_TITLE,
        sheetRange: "A1:H",
      },
      () => runImportProductContractorRates(db),
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
    const message = e instanceof Error ? e.message : "Failed to import product contractor rates";
    return NextResponse.json(
      { error: message, importRunId: importRunIdFromError(e) },
      { status: 500 },
    );
  }
}
