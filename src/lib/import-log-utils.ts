import type {
  ImportLogAudit,
  ImportLogKind,
  ImportLogSummary,
} from "@/types/import-log-types";

/** Keep in sync with `MASTER_PRICES_*_TAB_TITLE` in master-prices-spreadsheet.ts */
const SKU_IMPORT_TAB_BUILDING = "Products_Building";
const SKU_IMPORT_TAB_PAINTING = "Products_Painting";
function sheetTabTitleMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Infer log kind from the worksheet title on a completed import. */
export function importLogKindFromTabTitle(tabTitle: string): ImportLogKind {
  if (sheetTabTitleMatches(tabTitle, SKU_IMPORT_TAB_BUILDING)) {
    return "data_skus_import_building";
  }
  if (sheetTabTitleMatches(tabTitle, SKU_IMPORT_TAB_PAINTING)) {    return "data_skus_import_painting";
  }
  return "data_skus_import";
}

/** Parse kind stored on a Firestore import log document. */
export function parseStoredImportLogKind(raw: string): ImportLogKind {
  if (raw === "data_skus_import_building") return "data_skus_import_building";
  if (raw === "data_skus_import_labour") return "data_skus_import_labour";
  if (raw === "data_skus_import_painting") return "data_skus_import_painting";
  if (raw === "supporting_labour_rates") return "supporting_labour_rates";
  if (raw === "supporting_product_contractor_rates") return "supporting_product_contractor_rates";
  if (raw === "supporting_building_elements") return "supporting_building_elements";
  if (raw === "supporting_painting_elements") return "supporting_painting_elements";
  if (raw === "supporting_cascades") return "supporting_cascades";
  if (raw === "supporting_supplier_discounts") return "supporting_supplier_discounts";
  if (raw === "supporting_lists") return "supporting_lists";
  if (raw === "supporting_incremental_labour") return "supporting_incremental_labour";
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
