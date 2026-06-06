import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import { runImportBuildingElements } from "@/lib/server/import-building-elements";
import { runSupportingImportWithLog, importRunIdFromError } from "@/lib/server/supporting-import-log";

export const runtime = "nodejs";

/** POST — replace `data_building_elements` from `Building Elements` (rows 2–6 headers, rows 9–100 detail). */
export async function POST() {
  const db = getAdminFirestore();
  try {
    const { importRunId, result } = await runSupportingImportWithLog(
      db,
      {
        kind: "supporting_building_elements",
        tabTitle: MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE,
        sheetRange: "A1:BA100",
      },
      () => runImportBuildingElements(db),
      (result) => ({
        tabTitle: result.tabTitle,
        gid: result.gid,
        sheetRange: result.range,
        headerRow1Based: 2,
        rowsFound: result.parsedElements,
        rowsImported: result.written,
        rowsCreated: result.written,
        deletedPrior: result.deletedPrior,
        parseErrors: result.parseErrors,
        warnings: [`${result.parsedLines} detail line(s) across ${result.parsedElements} element(s)`],
      }),
    );
    return NextResponse.json({ ok: true, importRunId, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import building elements";
    return NextResponse.json(
      { error: message, importRunId: importRunIdFromError(e) },
      { status: 500 },
    );
  }
}
