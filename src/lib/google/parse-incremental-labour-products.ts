import type { DataObjectLabourRate } from "@/types/data-object-labour-rate";
import { dataLabourRateKey } from "@/lib/data-labour-rate-key";

/** `Incremental Labour - Products` tab: row 3 headers, row 4+ data (columns A–I). */
export const INCREMENTAL_LABOUR_PRODUCTS_SHEET_RANGE = "A3:I150";

export const INCREMENTAL_LABOUR_PRODUCTS_HEADER_ROW_1_BASED = 3;

export const INCREMENTAL_LABOUR_PRODUCTS_DATA_START_ROW_1_BASED = 4;

export type ParsedIncrementalLabourProductRow = DataObjectLabourRate;

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normalizeHeaderLabel(raw: unknown): string {
  return cellString(raw).toLowerCase().replace(/\s+/g, " ");
}

function parseLabourHours(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellString(v);
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every((c) => cellString(c) === "");
}

function headerMatches(row: unknown[]): boolean {
  const labels = [
    normalizeHeaderLabel(row[0]),
    normalizeHeaderLabel(row[1]),
    normalizeHeaderLabel(row[2]),
    normalizeHeaderLabel(row[3]),
    normalizeHeaderLabel(row[4]),
    normalizeHeaderLabel(row[5]),
    normalizeHeaderLabel(row[6]),
    normalizeHeaderLabel(row[7]),
    normalizeHeaderLabel(row[8]),
  ];
  return (
    labels[0] === "category" &&
    labels[1] === "product type" &&
    labels[2] === "product" &&
    labels[3] === "construction assistant" &&
    labels[4] === "lead contractor" &&
    labels[5] === "electrician" &&
    labels[6] === "plumber" &&
    labels[7] === "uom" &&
    labels[8] === "comments"
  );
}

/**
 * Parse incremental labour product rows from `Incremental Labour - Products!A3:I150`.
 */
export function parseIncrementalLabourProductsRows(
  values: unknown[][],
  rangeStartRow1Based = 3,
): { headerRow1Based: number; rows: ParsedIncrementalLabourProductRow[]; errors: string[] } {
  const headerIndex = INCREMENTAL_LABOUR_PRODUCTS_HEADER_ROW_1_BASED - rangeStartRow1Based;
  const headerRow = values[headerIndex] ?? [];
  const errors: string[] = [];

  if (!headerMatches(headerRow)) {
    const found = [0, 1, 2, 3, 4, 5, 6, 7, 8]
      .map((i) => cellString(headerRow[i]))
      .filter(Boolean)
      .join(" | ");
    return {
      headerRow1Based: 0,
      rows: [],
      errors: [
        `Row ${INCREMENTAL_LABOUR_PRODUCTS_HEADER_ROW_1_BASED} must be Category, Product Type, Product, Construction Assistant, Lead Contractor, Electrician, Plumber, UOM, Comments. Found: ${found || "(empty)"}`,
      ],
    };
  }

  const out: ParsedIncrementalLabourProductRow[] = [];
  const seen = new Set<string>();
  const dataStartIndex =
    INCREMENTAL_LABOUR_PRODUCTS_DATA_START_ROW_1_BASED - rangeStartRow1Based;

  for (let i = dataStartIndex; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];

    if (isRowEmpty(row)) continue;

    const category = cellString(row[0]);
    const productType = cellString(row[1]);
    const product = cellString(row[2]);

    if (!category || !productType) {
      errors.push(`Row ${sheetRow}: missing category or product type.`);
      continue;
    }

    const key = dataLabourRateKey(category, productType, product);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      category,
      productType,
      product,
      constructionAssistant: parseLabourHours(row[3]),
      leadContractor: parseLabourHours(row[4]),
      electrician: parseLabourHours(row[5]),
      plumber: parseLabourHours(row[6]),
      uom: cellString(row[7]),
      comments: cellString(row[8]),
      sheetRow,
    });
  }

  return {
    headerRow1Based: INCREMENTAL_LABOUR_PRODUCTS_HEADER_ROW_1_BASED,
    rows: out,
    errors,
  };
}
