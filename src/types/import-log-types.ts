/** Import log types only (no runtime exports). Helpers: `@/lib/import-log-utils`. */

/** Row-level sample for skipped invalid rows (stored on importlog). */
export type ImportLogRowSample = {
  sheetRowNumber: number;
  status: "skipped_empty" | "skipped_invalid";
  reason: string;
  sku: string | null;
  category: string | null;
  product: string | null;
};

/** Parsed product key values as read from the sheet (for error diagnosis). */
export type ImportLogProductKeySnapshot = {
  category: string;
  productType: string;
  product: string;
  elevateLevel: string;
  style: string;
  colourOptions: string;
};

/** Data-quality issue detected during import (fix in spreadsheet). */
export type ImportLogDataError = {
  /** 1-based row number in the Google Sheet workbook (same as Excel row). */
  sheetRowNumber: number;
  code:
    | "incomplete_row"
    | "supplier_without_product_key"
    | "invalid_supplier_option"
    | "duplicate_supplier_option";
  message: string;
  category: string | null;
  product: string | null;
  productKey?: ImportLogProductKeySnapshot;
};

/** Core accountability counts shown on every importlog document. */
export type ImportLogSummary = {
  rowsFound: number;
  blankRows: number;
  rowsImported: number;
  productsImported: number;
  /** New products (new skuId). */
  productsAppended: number;
  /** Existing products updated by key match. */
  productsUpdated: number;
  suppliersImported: number;
  errorRows: number;
  headerRow: number;
  apiRowsReturned: number;
};

/** Extended parse diagnostics (UI / optional Firestore detail). */
export type ImportLogAudit = {
  headerRow1Based: number;
  dataStartRow1Based: number;
  detectedHeaderLabels: string[];
  mappedFieldNames: string[];
  apiRowsReturned: number;
  sheetGridRowCount: number | null;
  totalDataRowsScanned: number;
  blankRowsSkipped: number;
  nonBlankRows: number;
  importedRows: number;
  productsImported: number;
  productsAppended: number;
  productsUpdated: number;
  suppliersImported: number;
  skippedInvalidRows: number;
  unmappedHeaders: string[];
  warnings: string[];
  skippedRowSamples: ImportLogRowSample[];
  dataErrors: ImportLogDataError[];
};

export type ImportLogStatus = "success" | "partial" | "failed";

export type ImportLogKind =
  | "data_skus_import"
  | "data_skus_import_building"
  | "data_skus_import_labour";

export type ImportLogPublic = {
  importRunId: string;
  kind: ImportLogKind;
  status: ImportLogStatus;
  tabTitle: string;
  gid: number;
  sheetRange: string;
  completedAt: string;
  summary: ImportLogSummary;
  deletedPrior: number;
  errorMessage?: string;
  warnings?: string[];
  skippedInvalidSamples?: ImportLogRowSample[];
  dataErrors?: ImportLogDataError[];
  /** Full parse detail when available (stream / legacy docs). */
  audit?: ImportLogAudit;
};
