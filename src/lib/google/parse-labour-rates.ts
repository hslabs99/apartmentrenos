import type { DataLabourRate } from "@/types/data-labour-rate";

/** `Products_Labour` tab: row 5 headers, row 6+ data (columns A–E). */
export const LABOUR_RATES_SHEET_RANGE = "A1:E";

/** Fixed header row (1-based row 5). */
export const LABOUR_RATES_HEADER_ROW_1_BASED = 5;

/** First data row when header is on row 5 (1-based row 6). */
export const LABOUR_RATES_DATA_START_ROW_1_BASED = 6;

export type ParsedLabourRateRow = DataLabourRate;

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normalizeHeaderLabel(raw: unknown): string {
  return cellString(raw).toLowerCase().replace(/\s+/g, " ");
}

function parsePriceExcGst(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellString(v).replace(/^\$/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
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
  ];
  return (
    labels[0] === "category" &&
    labels[1] === "product type" &&
    labels[2] === "product" &&
    (labels[3] === "$ exc gst" || labels[3] === "price exc gst") &&
    labels[4] === "uom"
  );
}

function buildRowKey(category: string, productType: string, product: string): string {
  return [category, productType, product]
    .map((p) => p.trim().toLowerCase())
    .join("\x1e");
}

/**
 * Parse labour rate rows from `Products_Labour!A1:E`.
 * Expects headers on row 5 and data from row 6.
 */
export function parseLabourRatesRows(
  values: unknown[][],
  rangeStartRow1Based = 1,
): { headerRow1Based: number; rows: ParsedLabourRateRow[]; errors: string[] } {
  const headerIndex = LABOUR_RATES_HEADER_ROW_1_BASED - rangeStartRow1Based;
  const headerRow = values[headerIndex] ?? [];
  const errors: string[] = [];

  if (!headerMatches(headerRow)) {
    const found = [0, 1, 2, 3, 4]
      .map((i) => cellString(headerRow[i]))
      .filter(Boolean)
      .join(" | ");
    return {
      headerRow1Based: 0,
      rows: [],
      errors: [
        `Row ${LABOUR_RATES_HEADER_ROW_1_BASED} must be Category, Product Type, Product, $ Exc GST, UOM. Found: ${found || "(empty)"}`,
      ],
    };
  }

  const out: ParsedLabourRateRow[] = [];
  const seen = new Set<string>();
  const dataStartIndex = LABOUR_RATES_DATA_START_ROW_1_BASED - rangeStartRow1Based;

  for (let i = dataStartIndex; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];

    if (isRowEmpty(row)) continue;

    const category = cellString(row[0]);
    const productType = cellString(row[1]);
    const product = cellString(row[2]);
    const priceExcGst = parsePriceExcGst(row[3]);
    const uom = cellString(row[4]);

    if (!category || !productType || !product) {
      errors.push(`Row ${sheetRow}: missing category, product type, or product.`);
      continue;
    }
    if (priceExcGst == null) {
      errors.push(`Row ${sheetRow}: invalid or missing $ Exc GST for "${product}".`);
      continue;
    }
    if (!uom) {
      errors.push(`Row ${sheetRow}: missing UOM for "${product}".`);
      continue;
    }

    const key = buildRowKey(category, productType, product);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      category,
      productType,
      product,
      priceExcGst,
      uom,
      sheetRow,
    });
  }

  return { headerRow1Based: LABOUR_RATES_HEADER_ROW_1_BASED, rows: out, errors };
}
