import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import { runImportPaintingElements } from "@/lib/server/import-painting-elements";
import { auditElementSkuCoverage } from "@/lib/server/validate-element-sku-coverage";
import { runSupportingImportWithLog, importRunIdFromError } from "@/lib/server/supporting-import-log";

export const runtime = "nodejs";

/** POST — replace `data_painting_elements` from `Painting Elements` (rows 2–6 headers, rows 9–100 detail). */
export async function POST() {
  const db = getAdminFirestore();
  try {
    const { importRunId, result } = await runSupportingImportWithLog(
      db,
      {
        kind: "supporting_painting_elements",
        tabTitle: MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE,
        sheetRange: "A1:BA100",
      },
      async () => {
        const importResult = await runImportPaintingElements(db);
        const elementCoverage = await auditElementSkuCoverage(db, "painting");
        return { ...importResult, elementCoverage };
      },
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
        warnings: [
          `${result.parsedLines} detail line(s) across ${result.parsedElements} element(s)`,
          ...result.elementCoverage.warnings,
        ],
      }),
    );
    return NextResponse.json({
      ok: true,
      importRunId,
      ...result,
      warnings: [
        `${result.parsedLines} detail line(s) across ${result.parsedElements} element(s)`,
        ...result.elementCoverage.warnings,
      ],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import painting elements";
    return NextResponse.json(
      { error: message, importRunId: importRunIdFromError(e) },
      { status: 500 },
    );
  }
}
