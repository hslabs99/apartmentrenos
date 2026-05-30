import type {
  DataSupplierDiscount,
  DataSupplierDiscountRange,
} from "@/types/data-supplier-discount";

/**
 * `Supplier Discounts` tab layout (A1:G):
 * - Row 1: title
 * - Row 2: Supplier | Default ↓ | $2,500 | $4,000 | $8,000 | $9,999 | Comment
 * - Row 3+: data
 */
export const SUPPLIER_DISCOUNTS_SHEET_RANGE = "A1:G19";

export const SUPPLIER_DISCOUNTS_HEADER_ROW_1_BASED = 2;
export const SUPPLIER_DISCOUNTS_DATA_START_ROW_1_BASED = 3;

/** Columns C–F on the header row → range names 1–4. */
export const SUPPLIER_DISCOUNT_RANGE_COLUMNS = [2, 3, 4, 5] as const;

export type ParsedSupplierDiscountImport = {
  ranges: DataSupplierDiscountRange[];
  suppliers: DataSupplierDiscount[];
};

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normalizeHeaderLabel(raw: unknown): string {
  return cellString(raw).toLowerCase().replace(/\s+/g, " ");
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every((c) => cellString(c) === "");
}

/** Parse $2,500 / 2500 → dollars (order thresholds only). */
function parseThreshold(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v >= 100) return Math.round(v);
    return null;
  }
  const raw = cellString(v);
  const s = raw.replace(/^\$/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 100 ? n : null;
}

/** Parse discount %; empty cell → null. */
function parseOptionalDiscountPct(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 0 && v <= 1) return Math.round(v * 10000) / 100;
    return v;
  }
  const s = cellString(v).replace(/%$/, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parse default % (required; 0% is valid). */
function parseDefaultDiscountPct(v: unknown): number | null {
  const pct = parseOptionalDiscountPct(v);
  if (pct == null && (v === 0 || v === "0" || v === "0%")) return 0;
  return pct;
}

function isSupplierDiscountHeaderRow(row: unknown[]): boolean {
  const supplier = normalizeHeaderLabel(row[0]);
  const second = normalizeHeaderLabel(row[1]);
  if (supplier !== "supplier" || !second.includes("default")) return false;
  for (const col of SUPPLIER_DISCOUNT_RANGE_COLUMNS) {
    if (parseThreshold(row[col]) != null) return true;
  }
  return false;
}

function findCommentColumnIndex(row: unknown[]): number {
  for (let i = 0; i < row.length; i++) {
    if (normalizeHeaderLabel(row[i]) === "comment") return i;
  }
  return 6;
}

export function parseSupplierDiscountsSheet(
  values: unknown[][],
  rangeStartRow1Based = 1,
): {
  headerRow1Based: number;
  dataStartRow1Based: number;
  ranges: DataSupplierDiscountRange[];
  suppliers: DataSupplierDiscount[];
  errors: string[];
} {
  const errors: string[] = [];
  let headerIndex = -1;

  for (let i = 0; i < values.length; i++) {
    if (isSupplierDiscountHeaderRow(values[i] ?? [])) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) {
    const fixedIndex = SUPPLIER_DISCOUNTS_HEADER_ROW_1_BASED - rangeStartRow1Based;
    if (isSupplierDiscountHeaderRow(values[fixedIndex] ?? [])) {
      headerIndex = fixedIndex;
    }
  }

  if (headerIndex < 0) {
    return {
      headerRow1Based: 0,
      dataStartRow1Based: 0,
      ranges: [],
      suppliers: [],
      errors: [
        `Row ${SUPPLIER_DISCOUNTS_HEADER_ROW_1_BASED} must be Supplier, Default ↓, $2,500…$9,999, Comment.`,
      ],
    };
  }

  const headerRow = values[headerIndex] ?? [];
  const commentCol = findCommentColumnIndex(headerRow);

  const ranges: DataSupplierDiscountRange[] = [];
  SUPPLIER_DISCOUNT_RANGE_COLUMNS.forEach((col, idx) => {
    const threshold = parseThreshold(headerRow[col]);
    if (threshold == null) {
      errors.push(`Header column ${col + 1}: missing range ${idx + 1} threshold.`);
      return;
    }
    ranges.push({ rangeName: idx + 1, discount: threshold });
  });

  const headerRow1Based = rangeStartRow1Based + headerIndex;
  const dataStartIndex = headerIndex + 1;
  const dataStartRow1Based = rangeStartRow1Based + dataStartIndex;

  const suppliers: DataSupplierDiscount[] = [];
  const seen = new Set<string>();

  for (let i = dataStartIndex; i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];

    if (isRowEmpty(row)) continue;

    const supplier = cellString(row[0]);
    if (!supplier) continue;
    if (normalizeHeaderLabel(supplier) === "supplier") continue;

    const key = supplier.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const defaultPct = parseDefaultDiscountPct(row[1]);
    if (defaultPct == null) {
      errors.push(`Row ${sheetRow}: missing or invalid default % for "${supplier}".`);
      continue;
    }

    const comment =
      commentCol >= 0 ? cellString(row[commentCol]) || undefined : undefined;

    suppliers.push({
      supplier,
      default: defaultPct,
      range1: parseOptionalDiscountPct(row[2]),
      range2: parseOptionalDiscountPct(row[3]),
      range3: parseOptionalDiscountPct(row[4]),
      range4: parseOptionalDiscountPct(row[5]),
      comment,
      sheetRow,
    });
  }

  return {
    headerRow1Based,
    dataStartRow1Based,
    ranges,
    suppliers,
    errors,
  };
}

/** @deprecated use parseSupplierDiscountsSheet */
export function parseSupplierDiscountsRows(
  values: unknown[][],
  rangeStartRow1Based = 1,
) {
  const parsed = parseSupplierDiscountsSheet(values, rangeStartRow1Based);
  return {
    headerRow1Based: parsed.headerRow1Based,
    tierHeaderRow1Based: parsed.headerRow1Based,
    dataStartRow1Based: parsed.dataStartRow1Based,
    rows: parsed.suppliers,
    errors: parsed.errors,
  };
}
