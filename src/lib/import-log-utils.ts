import type {
  ImportLogAudit,
  ImportLogKind,
  ImportLogSummary,
} from "@/types/import-log-types";

/** Keep in sync with `MASTER_PRICES_*_TAB_TITLE` in master-prices-spreadsheet.ts */
const SKU_IMPORT_TAB_BUILDING = "Products_Building";
const SKU_IMPORT_TAB_LABOUR = "Products_Labour";

function sheetTabTitleMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Infer log kind from the worksheet title on a completed import. */
export function importLogKindFromTabTitle(tabTitle: string): ImportLogKind {
  if (sheetTabTitleMatches(tabTitle, SKU_IMPORT_TAB_BUILDING)) {
    return "data_skus_import_building";
  }
  if (sheetTabTitleMatches(tabTitle, SKU_IMPORT_TAB_LABOUR)) {
    return "data_skus_import_labour";
  }
  return "data_skus_import";
}

/** Parse kind stored on a Firestore import log document. */
export function parseStoredImportLogKind(raw: string): ImportLogKind {
  if (raw === "data_skus_import_building") return "data_skus_import_building";
  if (raw === "data_skus_import_labour") return "data_skus_import_labour";
  return "data_skus_import";
}

export function auditToSummary(audit: ImportLogAudit): ImportLogSummary {
  return {
    rowsFound: audit.totalDataRowsScanned,
    blankRows: audit.blankRowsSkipped,
    rowsImported: audit.importedRows,
    productsImported: audit.productsImported,
    productsAppended: audit.productsAppended,
    productsUpdated: audit.productsUpdated,
    suppliersImported: audit.suppliersImported,
    errorRows: audit.skippedInvalidRows,
    headerRow: audit.headerRow1Based,
    apiRowsReturned: audit.apiRowsReturned,
  };
}
