import { buildSkuImportFromSheetRows } from "@/lib/google/build-sku-import-from-sheet";
import { normalizeSupplierOption } from "@/lib/sku/supplier-option";
import { normalizeProductKeyPart } from "@/lib/sku/product-key";
import { MASTER_PRICES_SKU_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import type { ParsedSheetRow } from "@/lib/google/parsed-sheet-row";
import { truncateAppendSpec } from "@/lib/sku/data-sku-append-slots";
import type { DataSku } from "@/types/data-sku";
import type { DataSkuSupplier } from "@/types/data-sku-supplier";
import type { ImportLogAudit, ImportLogRowSample } from "@/types/import-log-types";

/** Column layout for Products_SKU_ALL, Products_Building, and Products_Painting (row 5 headers). */
/** Preferred header row when auto-detect is ambiguous (1-based row 5). */
export const SKU_HEADER_ROW_1_BASED = 5;

/** First data row when header is on row 5 (1-based row 6). */
export const SKU_DATA_START_ROW_1_BASED = 6;

const HEADER_SCAN_MAX_ROWS = 25;
const MAX_SKIPPED_SAMPLES = 150;
const MAX_CUSTOM_ELEVATE_SAMPLES_STORED = 500;

type SheetFieldKey = keyof Omit<ParsedSheetRow, "sheetRowNumber" | "productKeySourceRowNumber">;

const HEADER_ALIASES: Record<string, SheetFieldKey> = {
  category: "category",
  "product type": "productType",
  product: "product",
  specification: "product",
  description: "product",
  "product description": "product",
  "product name": "product",
  "elevate level": "elevateLevel",
  style: "style",
  "colour options": "colourOptions",
  "color options": "colourOptions",
  priority: "supplierOption",
  supplier: "supplier",
  model: "model",
  sku: "supplierSku",
  link: "link",
  $: "priceIncGst",
  "price inc gst": "priceIncGst",
  "price (inc gst)": "priceIncGst",
  "$ exc gst": "priceExcGst",
  "price exc gst": "priceExcGst",
  "price (exc gst)": "priceExcGst",
  uom: "uom",
  apend1type: "append1Type",
  append1type: "append1Type",
  "apend1 type": "append1Type",
  "append1 type": "append1Type",
  apend1spec: "append1Spec",
  append1spec: "append1Spec",
  "apend1 spec": "append1Spec",
  "append1 spec": "append1Spec",
  apend2type: "append2Type",
  append2type: "append2Type",
  "apend2 type": "append2Type",
  "append2 type": "append2Type",
  apend2spec: "append2Spec",
  append2spec: "append2Spec",
  "apend2 spec": "append2Spec",
  "append2 spec": "append2Spec",
  apend3type: "append3Type",
  append3type: "append3Type",
  "apend3 type": "append3Type",
  "append3 type": "append3Type",
  apend3spec: "append3Spec",
  append3spec: "append3Spec",
  "apend3 spec": "append3Spec",
  "append3 spec": "append3Spec",
  "sheet width": "sheetWidth",
  "stock available": "stockAvailable",
  "lead time": "leadTime",
  location: "location",
  comments: "comments",
};

function normalizeHeaderLabel(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseNumberOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(/^\$/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function isRowEmpty(cells: unknown[]): boolean {
  return cells.every((c) => parseText(c) === "");
}

function hasCategoryProductTypeProduct(
  cells: unknown[],
  fieldToColIndex: Map<SheetFieldKey, number>,
): boolean {
  const category = parseText(cells[fieldToColIndex.get("category") ?? 0]);
  const productType = parseText(cells[fieldToColIndex.get("productType") ?? 1]);
  const product = parseText(cells[fieldToColIndex.get("product") ?? 2]);
  return category !== "" && productType !== "" && product !== "";
}

export type ParseMasterPricesSkusOptions = {
  sheetGridRowCount?: number | null;
  /** Skip rows missing Category, Product Type, or Product (columns A–C) without error. */
  requireCategoryProductTypeProduct?: boolean;
  /** Carry cols A–F down from the last non-empty value (multi-supplier continuation rows). */
  fillDownProductKey?: boolean;
};

const PRODUCT_KEY_FIELD_KEYS = [
  "category",
  "productType",
  "product",
  "elevateLevel",
  "style",
  "colourOptions",
] as const satisfies readonly SheetFieldKey[];

type ProductKeyCarry = Record<(typeof PRODUCT_KEY_FIELD_KEYS)[number], string>;

function emptyProductKeyCarry(): ProductKeyCarry {
  return {
    category: "",
    productType: "",
    product: "",
    elevateLevel: "",
    style: "",
    colourOptions: "",
  };
}

function hasLocalProductKeyAnchor(record: ParsedSheetRow): boolean {
  return (
    record.category.trim() !== "" &&
    record.productType.trim() !== "" &&
    record.product.trim() !== ""
  );
}

/** New product line when any populated A–C cell differs from the carried key (avoids bleeding prior product). */
function shouldResetCarryForNewProductLine(
  record: ParsedSheetRow,
  carry: ProductKeyCarry,
): boolean {
  const checks: (keyof Pick<ProductKeyCarry, "category" | "productType" | "product">)[] = [
    "category",
    "productType",
    "product",
  ];
  for (const field of checks) {
    const incoming = record[field].trim();
    if (!incoming) continue;
    const held = carry[field].trim();
    if (held && normalizeProductKeyPart(incoming) !== normalizeProductKeyPart(held)) {
      return true;
    }
  }
  return false;
}

function applyProductKeyFillDown(record: ParsedSheetRow, carry: ProductKeyCarry): void {
  for (const field of PRODUCT_KEY_FIELD_KEYS) {
    const trimmed = record[field].trim();
    if (trimmed) {
      carry[field] = record[field];
    } else if (carry[field]) {
      record[field] = carry[field];
    }
  }
}

/** Column D — skipped entirely on data_skus import. */
function isCustomElevateLevel(raw: string): boolean {
  return raw.trim().toLowerCase() === "custom";
}

function readElevateLevelCell(
  cells: unknown[],
  fieldToColIndex: Map<SheetFieldKey, number>,
): string {
  const colIndex = fieldToColIndex.get("elevateLevel") ?? 3;
  return parseText(cells[colIndex]);
}

function scoreHeaderRow(cells: unknown[]): number {
  let score = 0;
  for (const cell of cells) {
    const label = normalizeHeaderLabel(cell);
    if (!label) continue;
    if (
      label === "sku" ||
      label === "category" ||
      label === "product" ||
      label === "specification" ||
      label === "description"
    ) {
      score += 10;
    }
    if (HEADER_ALIASES[label]) score += 2;
  }
  return score;
}

const MIN_HEADER_SCORE = 24;

/** Pick the row most likely to be column headers (scans first N rows). */
export function findHeaderRowIndex(values: unknown[][]): number {
  const scanUpTo = Math.min(HEADER_SCAN_MAX_ROWS, values.length);
  const preferredIdx = Math.min(SKU_HEADER_ROW_1_BASED - 1, Math.max(0, values.length - 1));
  let bestIdx = preferredIdx;
  let bestScore = -1;

  for (let i = 0; i < scanUpTo; i++) {
    const score = scoreHeaderRow(values[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestScore < MIN_HEADER_SCORE) {
    return preferredIdx;
  }

  const preferredScore = scoreHeaderRow(values[preferredIdx] ?? []);
  if (preferredScore >= MIN_HEADER_SCORE && preferredScore >= bestScore - 4) {
    return preferredIdx;
  }

  return Math.max(0, bestIdx);
}

function emptyParsedRow(sheetRowNumber: number): ParsedSheetRow {
  return {
    sheetRowNumber,
    productKeySourceRowNumber: sheetRowNumber,
    category: "",
    productType: "",
    product: "",
    elevateLevel: "",
    style: "",
    colourOptions: "",
    supplierOption: null,
    supplier: "",
    model: "",
    supplierSku: "",
    link: "",
    priceIncGst: null,
    priceExcGst: null,
    uom: "",
    append1Type: "",
    append1Spec: "",
    append2Type: "",
    append2Spec: "",
    append3Type: "",
    append3Spec: "",
    sheetWidth: "",
    stockAvailable: "",
    leadTime: "",
    location: "",
    comments: "",
  };
}

export type ParseMasterPricesSkusResult = {
  products: DataSku[];
  suppliers: DataSkuSupplier[];
  audit: ImportLogAudit;
  /** @deprecated use audit.blankRowsSkipped */
  skippedEmptyRows: number;
  headerMap: Record<string, number>;
  warnings: string[];
};

/**
 * Parse sheet values from row 1 downward; auto-detects header row.
 * Aggregates sheet rows into products (unique A–F) and supplier options (G–M).
 */
export function parseMasterPricesSkuRows(
  values: unknown[][],
  options?: ParseMasterPricesSkusOptions,
): ParseMasterPricesSkusResult {
  const warnings: string[] = [];
  const skippedRowSamples: ImportLogRowSample[] = [];

  if (!values.length) {
    const emptyAudit: ImportLogAudit = {
      headerRow1Based: SKU_HEADER_ROW_1_BASED,
      dataStartRow1Based: SKU_DATA_START_ROW_1_BASED,
      detectedHeaderLabels: [],
      mappedFieldNames: [],
      apiRowsReturned: 0,
      sheetGridRowCount: options?.sheetGridRowCount ?? null,
      totalDataRowsScanned: 0,
      blankRowsSkipped: 0,
      customElevateRowsSkipped: 0,
      nonBlankRows: 0,
      importedRows: 0,
      productsImported: 0,
      productsAppended: 0,
      productsUpdated: 0,
      suppliersImported: 0,
      skippedInvalidRows: 0,
      unmappedHeaders: [],
      warnings: ["No rows returned from sheet."],
      skippedRowSamples: [],
      customElevateSkippedSamples: [],
      dataErrors: [],
    };
    return {
      products: [],
      suppliers: [],
      audit: emptyAudit,
      skippedEmptyRows: 0,
      headerMap: {},
      warnings: emptyAudit.warnings,
    };
  }

  const headerRowIndex = findHeaderRowIndex(values);
  const headerRow1Based = headerRowIndex + 1;
  const dataStartRow1Based = headerRow1Based + 1;

  const headerRow = values[headerRowIndex] ?? [];
  const headerMap: Record<string, number> = {};
  /** First column index for each field — duplicate headers (A–F repeated) must not overwrite. */
  const fieldToColIndex = new Map<SheetFieldKey, number>();
  const detectedHeaderLabels: string[] = [];
  const unmappedHeaders: string[] = [];
  const duplicateHeaderFields: string[] = [];

  headerRow.forEach((cell, colIndex) => {
    const rawLabel = parseText(cell);
    if (!rawLabel) return;
    detectedHeaderLabels.push(rawLabel);
    const label = normalizeHeaderLabel(cell);
    headerMap[label] = colIndex;
    const field = HEADER_ALIASES[label];
    if (field) {
      if (fieldToColIndex.has(field)) {
        duplicateHeaderFields.push(
          `${rawLabel} (column ${colIndex + 1}, first at column ${(fieldToColIndex.get(field) ?? 0) + 1})`,
        );
      } else {
        fieldToColIndex.set(field, colIndex);
      }
    } else {
      unmappedHeaders.push(`${rawLabel} (column ${colIndex + 1})`);
    }
  });

  const mappedFieldNames = [...fieldToColIndex.keys()];

  const expectedProductHeaders: SheetFieldKey[] = [
    "category",
    "productType",
    "product",
    "elevateLevel",
    "style",
    "colourOptions",
  ];
  for (const field of expectedProductHeaders) {
    if (!mappedFieldNames.includes(field)) {
      warnings.push(
        `Expected column "${field}" was not found in header row ${headerRow1Based}.`,
      );
    }
  }

  if (headerRow1Based !== SKU_HEADER_ROW_1_BASED) {
    warnings.push(
      `Header row auto-detected on row ${headerRow1Based} (not default row ${SKU_HEADER_ROW_1_BASED}).`,
    );
  }

  if (duplicateHeaderFields.length > 0) {
    warnings.push(
      `Duplicate header label(s) ignored after first mapping (${duplicateHeaderFields.length}): ${duplicateHeaderFields.slice(0, 8).join("; ")}${duplicateHeaderFields.length > 8 ? "…" : ""}`,
    );
  }

  const sheetRows: ParsedSheetRow[] = [];
  let blankRowsSkipped = 0;
  let customElevateRowsSkipped = 0;
  let nonBlankRows = 0;
  let emptySamplesLogged = 0;
  const customElevateSkippedSamples: ImportLogRowSample[] = [];
  const MAX_EMPTY_SAMPLES = 25;
  const productKeyCarry = emptyProductKeyCarry();
  let productKeyOriginRow: number | null = null;

  for (let i = headerRowIndex + 1; i < values.length; i++) {
    const cells = values[i] ?? [];
    const sheetRowNumber = i + 1;

    if (isRowEmpty(cells)) {
      if (options?.fillDownProductKey) {
        Object.assign(productKeyCarry, emptyProductKeyCarry());
        productKeyOriginRow = null;
      }
      blankRowsSkipped += 1;
      if (
        emptySamplesLogged < MAX_EMPTY_SAMPLES &&
        skippedRowSamples.length < MAX_SKIPPED_SAMPLES
      ) {
        emptySamplesLogged += 1;
        skippedRowSamples.push({
          sheetRowNumber,
          status: "skipped_empty",
          reason: "All cells blank.",
          sku: null,
          category: null,
          product: null,
        });
      }
      continue;
    }

    if (isCustomElevateLevel(readElevateLevelCell(cells, fieldToColIndex))) {
      customElevateRowsSkipped += 1;
      const sample: ImportLogRowSample = {
        sheetRowNumber,
        status: "skipped_custom_elevate",
        reason: "Elevate Level (column D) is Custom — row skipped.",
        sku: null,
        category: parseText(cells[fieldToColIndex.get("category") ?? 0]) || null,
        product: parseText(cells[fieldToColIndex.get("product") ?? 2]) || null,
      };
      if (customElevateSkippedSamples.length < MAX_CUSTOM_ELEVATE_SAMPLES_STORED) {
        customElevateSkippedSamples.push(sample);
      }
      if (skippedRowSamples.length < MAX_SKIPPED_SAMPLES) {
        skippedRowSamples.push(sample);
      }
      continue;
    }

    if (
      options?.requireCategoryProductTypeProduct &&
      !hasCategoryProductTypeProduct(cells, fieldToColIndex)
    ) {
      blankRowsSkipped += 1;
      if (
        emptySamplesLogged < MAX_EMPTY_SAMPLES &&
        skippedRowSamples.length < MAX_SKIPPED_SAMPLES
      ) {
        emptySamplesLogged += 1;
        skippedRowSamples.push({
          sheetRowNumber,
          status: "skipped_empty",
          reason:
            "Missing Category, Product Type, or Product (columns A–C) — row skipped.",
          sku: null,
          category: parseText(cells[fieldToColIndex.get("category") ?? 0]) || null,
          product: parseText(cells[fieldToColIndex.get("product") ?? 2]) || null,
        });
      }
      continue;
    }

    nonBlankRows += 1;
    const record = emptyParsedRow(sheetRowNumber);

    fieldToColIndex.forEach((colIndex, field) => {
      const raw = cells[colIndex];
      if (field === "supplierOption") {
        record.supplierOption = normalizeSupplierOption(raw);
      } else if (field === "priceIncGst" || field === "priceExcGst") {
        record[field] = parseNumberOrNull(raw);
      } else if (
        field === "append1Spec" ||
        field === "append2Spec" ||
        field === "append3Spec"
      ) {
        record[field] = truncateAppendSpec(parseText(raw));
      } else {
        record[field] = parseText(raw);
      }
    });

    if (options?.fillDownProductKey) {
      if (shouldResetCarryForNewProductLine(record, productKeyCarry)) {
        Object.assign(productKeyCarry, emptyProductKeyCarry());
        productKeyOriginRow = null;
      }
      if (hasLocalProductKeyAnchor(record)) {
        productKeyOriginRow = sheetRowNumber;
      }
      applyProductKeyFillDown(record, productKeyCarry);
      record.productKeySourceRowNumber = productKeyOriginRow ?? sheetRowNumber;
    }

    sheetRows.push(record);
  }

  const built = buildSkuImportFromSheetRows(sheetRows, MAX_SKIPPED_SAMPLES, {
    headerRow1Based,
    dataStartRow1Based,
  });
  const allSkippedSamples = [...skippedRowSamples, ...built.skippedRowSamples].slice(
    0,
    MAX_SKIPPED_SAMPLES,
  );

  if (customElevateRowsSkipped > 0) {
    warnings.push(
      `${customElevateRowsSkipped} row(s) skipped — Elevate Level (column D) is Custom.`,
    );
  }

  if (built.dataErrors.length > 0) {
    warnings.push(
      `${built.dataErrors.length} data error(s) — duplicate supplier options and other issues must be fixed in the spreadsheet.`,
    );
  }

  const totalDataRowsScanned = values.length - headerRowIndex - 1;
  const sheetGridRowCount = options?.sheetGridRowCount ?? null;

  if (
    sheetGridRowCount != null &&
    sheetGridRowCount > 100 &&
    values.length < 50
  ) {
    warnings.push(
      `Sheet tab has ${sheetGridRowCount} grid rows but API returned only ${values.length} row(s). Wrong tab or sparse range — expected "${MASTER_PRICES_SKU_TAB_TITLE}".`,
    );
  }

  const importedRows = built.products.length + built.suppliers.length;

  const audit: ImportLogAudit = {
    headerRow1Based,
    dataStartRow1Based,
    detectedHeaderLabels,
    mappedFieldNames,
    apiRowsReturned: values.length,
    sheetGridRowCount,
    totalDataRowsScanned,
    blankRowsSkipped,
    customElevateRowsSkipped,
    nonBlankRows,
    importedRows,
    productsImported: built.products.length,
    productsAppended: 0,
    productsUpdated: 0,
    suppliersImported: built.suppliers.length,
    skippedInvalidRows: built.skippedInvalidRows,
    unmappedHeaders,
    warnings: [...warnings, ...unmappedHeaders.map((h) => `Unmapped column header: ${h}`)],
    skippedRowSamples: allSkippedSamples,
    customElevateSkippedSamples,
    dataErrors: built.dataErrors,
  };

  return {
    products: built.products,
    suppliers: built.suppliers,
    audit,
    skippedEmptyRows: blankRowsSkipped,
    headerMap,
    warnings: audit.warnings,
  };
}
