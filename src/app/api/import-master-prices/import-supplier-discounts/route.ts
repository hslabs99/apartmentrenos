import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import { runImportSupplierDiscounts } from "@/lib/server/import-supplier-discounts";
import { importRunIdFromError, runSupportingImportWithLog } from "@/lib/server/supporting-import-log";

export const runtime = "nodejs";

/** POST — replace `data_supplier_discounts` from `Supplier Discounts` tab. */
export async function POST() {
  const db = getAdminFirestore();
  try {
    const { importRunId, result } = await runSupportingImportWithLog(
      db,
      {
        kind: "supporting_supplier_discounts",
        tabTitle: MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
        sheetRange: "A1:G19",
      },
      () => runImportSupplierDiscounts(db),
      (result) => ({
        tabTitle: result.tabTitle,
        gid: result.gid,
        sheetRange: result.range,
        headerRow1Based: result.headerRow1Based,
        rowsFound: result.parsedSuppliers + result.parsedRanges,
        rowsImported: result.writtenSuppliers + result.writtenRanges,
        rowsCreated: result.writtenSuppliers + result.writtenRanges,
        suppliersImported: result.writtenSuppliers,
        deletedPrior: result.deletedSuppliersPrior + result.deletedRangesPrior,
        parseErrors: result.parseErrors,
      }),
    );
    return NextResponse.json({ ok: true, importRunId, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import supplier discounts";
    return NextResponse.json(
      { error: message, importRunId: importRunIdFromError(e) },
      { status: 500 },
    );
  }
}
