import type { DataProductContractorRate } from "@/types/data-product-contractor-rate";

/** `Products_ContractorRates` tab: row 5 headers, row 6+ data (columns A–H). */
export const PRODUCT_CONTRACTOR_RATES_SHEET_RANGE = "A1:H";

/** Fixed header row (1-based row 5). */
export const PRODUCT_CONTRACTOR_RATES_HEADER_ROW_1_BASED = 5;

/** First data row when header is on row 5 (1-based row 6). */
export const PRODUCT_CONTRACTOR_RATES_DATA_START_ROW_1_BASED = 6;

export type ParsedProductContractorRateRow = DataProductContractorRate;

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normalizeHeaderLabel(raw: unknown): string {
  return cellString(raw).toLowerCase().replace(/\s+/g, " ");
}

function parseOptionalMoney(v: unknown): number | null {
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
  const labels = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => normalizeHeaderLabel(row[i]));
  return (
    labels[0] === "product type" &&
    labels[1] === "specification" &&
    labels[2] === "labour desc" &&
    labels[3] === "base" &&
    labels[4] === "m2" &&
    labels[5] === "lm" &&
    labels[6] === "unit" &&
    labels[7] === "notes"
  );
}

function buildRowKey(productType: string, specification: string): string {
  return [productType, specification]
    .map((p) => p.trim().toLowerCase())
    .join("\x1e");
}

/**
 * Parse contractor rate rows from `Products_ContractorRates!A1:H`.
 * Expects headers on row 5 and data from row 6.
 */
export function parseProductContractorRatesRows(
  values: unknown[][],
  rangeStartRow1Based = 1,
): { headerRow1Based: number; rows: ParsedProductContractorRateRow[]; errors: string[] } {
  const headerIndex = PRODUCT_CONTRACTOR_RATES_HEADER_ROW_1_BASED - rangeStartRow1Based;
  const headerRow = values[headerIndex] ?? [];
  const errors: string[] = [];

  if (!headerMatches(headerRow)) {
    const found = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((i) => cellString(headerRow[i]))
      .filter(Boolean)
      .join(" | ");
    return {
      headerRow1Based: 0,
      rows: [],
      errors: [
        `Row ${PRODUCT_CONTRACTOR_RATES_HEADER_ROW_1_BASED} must be Product Type, Specification, Labour Desc, Base, M2, LM, Unit, Notes. Found: ${found || "(empty)"}`,
      ],
    };
  }

  const out: ParsedProductContractorRateRow[] = [];
  const seen = new Set<string>();
  const dataStartIndex = PRODUCT_CONTRACTOR_RATES_DATA_START_ROW_1_BASED - rangeStartRow1Based;

  for (let i = dataStartIndex; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];

    if (isRowEmpty(row)) continue;

    const productType = cellString(row[0]);
    const specification = cellString(row[1]);
    const labourDescRaw = cellString(row[2]);
    const labourDesc = labourDescRaw || null;
    const notesRaw = cellString(row[7]);
    const notes = notesRaw || null;

    if (!productType || !specification) {
      errors.push(`Row ${sheetRow}: missing product type or specification.`);
      continue;
    }

    const moneyFields: { label: string; value: unknown }[] = [
      { label: "Base", value: row[3] },
      { label: "M2", value: row[4] },
      { label: "LM", value: row[5] },
      { label: "Unit", value: row[6] },
    ];
    let moneyInvalid = false;
    const parsedMoney = moneyFields.map(({ label, value }) => {
      if (value == null || cellString(value) === "") return null;
      const parsed = parseOptionalMoney(value);
      if (parsed == null) {
        errors.push(`Row ${sheetRow}: invalid ${label} for "${specification}".`);
        moneyInvalid = true;
      }
      return parsed;
    });
    if (moneyInvalid) continue;

    const key = buildRowKey(productType, specification);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      productType,
      specification,
      labourDesc,
      base: parsedMoney[0] ?? null,
      m2: parsedMoney[1] ?? null,
      lm: parsedMoney[2] ?? null,
      unit: parsedMoney[3] ?? null,
      notes,
      sheetRow,
    });
  }

  return {
    headerRow1Based: PRODUCT_CONTRACTOR_RATES_HEADER_ROW_1_BASED,
    rows: out,
    errors,
  };
}
