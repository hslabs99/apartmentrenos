import { columnIndexToLetter } from "@/lib/google/sheet-column-letter";
import type { DataPaintingElement } from "@/types/data-painting-element";

/** `Painting Elements` tab: element headers rows 2–6 (cols H+), detail rows 9–100. */
export const PAINTING_ELEMENTS_SHEET_RANGE = "A1:BA100";

export const PAINTING_ELEMENTS_SKU_NAME_ROW_1_BASED = 2;
export const PAINTING_ELEMENTS_ELEMENT_ROW_1_BASED = 3;
export const PAINTING_ELEMENTS_SIZE_ROW_1_BASED = 4;
export const PAINTING_ELEMENTS_TYPE_ROW_1_BASED = 5;
export const PAINTING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED = 6;
export const PAINTING_ELEMENTS_DATA_START_ROW_1_BASED = 9;
export const PAINTING_ELEMENTS_DATA_END_ROW_1_BASED = 100;

/** First element column (H = 0-based index 7). Cols A–G are fixed detail headers. */
export const PAINTING_ELEMENTS_ELEMENT_START_COL_INDEX = 7;

export type ParsedPaintingElements = {
  elements: DataPaintingElement[];
  errors: string[];
};

function cellString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function normalizeHeaderLabel(raw: unknown): string {
  return cellString(raw).toLowerCase().replace(/\s+/g, " ");
}

function parseOptionalNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellString(v).replace(/^\$/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseM2Multiplier(v: unknown): number | null {
  return parseOptionalNumber(v);
}

function hasM2MultiplierValue(v: unknown): boolean {
  return parseM2Multiplier(v) != null;
}

function detailRowHeaderMatches(row: unknown[]): boolean {
  const labels = [0, 1, 2, 3, 4, 5, 6].map((i) => normalizeHeaderLabel(row[i]));
  return (
    labels[0] === "status check" &&
    labels[1] === "category" &&
    labels[2] === "sku product" &&
    labels[3] === "uom" &&
    (labels[4] === "litre/m2" || labels[4] === "litre / m2" || labels[4].includes("litre")) &&
    (labels[5] === "price litre" || labels[5].includes("price") && labels[5].includes("litre")) &&
    (labels[6] === "price m2" || labels[6].includes("price") && labels[6].includes("m2"))
  );
}

/** Columns with a SKU Name on row 2; skip empty columns (gaps allowed). */
function discoverElementColumnIndexes(values: unknown[][]): number[] {
  const skuNameRow = values[PAINTING_ELEMENTS_SKU_NAME_ROW_1_BASED - 1] ?? [];
  const cols: number[] = [];
  let consecutiveEmpty = 0;
  const maxConsecutiveEmpty = 12;

  for (let col = PAINTING_ELEMENTS_ELEMENT_START_COL_INDEX; col < skuNameRow.length; col++) {
    const skuName = cellString(skuNameRow[col]);
    if (!skuName) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= maxConsecutiveEmpty && cols.length > 0) break;
      continue;
    }
    consecutiveEmpty = 0;
    cols.push(col);
  }
  return cols;
}

/**
 * Parse painting elements from `Painting Elements!A1:BA100`.
 */
export function parsePaintingElementsRows(
  values: unknown[][],
  rangeStartRow1Based = 1,
): ParsedPaintingElements {
  const errors: string[] = [];
  const detailHeaderRow = values[PAINTING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED - 1] ?? [];
  if (!detailRowHeaderMatches(detailHeaderRow)) {
    const found = [0, 1, 2, 3, 4, 5, 6]
      .map((i) => cellString(detailHeaderRow[i]))
      .filter(Boolean)
      .join(" | ");
    return {
      elements: [],
      errors: [
        `Row ${PAINTING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED} must start with Status Check, Category, SKU Product, UOM, Litre/M2, Price Litre, Price M2. Found: ${found || "(empty)"}`,
      ],
    };
  }

  const elementCols = discoverElementColumnIndexes(values);
  if (elementCols.length === 0) {
    return {
      elements: [],
      errors: [
        `No painting element columns found from column H (row ${PAINTING_ELEMENTS_SKU_NAME_ROW_1_BASED} SKU Name empty).`,
      ],
    };
  }

  const skuNameRow = values[PAINTING_ELEMENTS_SKU_NAME_ROW_1_BASED - 1] ?? [];
  const elementRow = values[PAINTING_ELEMENTS_ELEMENT_ROW_1_BASED - 1] ?? [];
  const sizeRow = values[PAINTING_ELEMENTS_SIZE_ROW_1_BASED - 1] ?? [];
  const typeRow = values[PAINTING_ELEMENTS_TYPE_ROW_1_BASED - 1] ?? [];
  const quantityUomRow = values[PAINTING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED - 1] ?? [];

  const elements: DataPaintingElement[] = [];
  const elementByCol = new Map<number, DataPaintingElement>();
  const seenSkuNames = new Set<string>();

  for (const col of elementCols) {
    const skuName = cellString(skuNameRow[col]);
    const skuNorm = skuName.toLowerCase();
    if (seenSkuNames.has(skuNorm)) {
      errors.push(
        `Duplicate SKU Name "${skuName}" in column ${columnIndexToLetter(col)} (row ${PAINTING_ELEMENTS_SKU_NAME_ROW_1_BASED}).`,
      );
      continue;
    }
    seenSkuNames.add(skuNorm);

    const element: DataPaintingElement = {
      skuName,
      element: cellString(elementRow[col]),
      size: cellString(sizeRow[col]),
      type: cellString(typeRow[col]),
      quantityUom: cellString(quantityUomRow[col]),
      sheetColumn: columnIndexToLetter(col),
      headerSheetRow: PAINTING_ELEMENTS_SKU_NAME_ROW_1_BASED,
      lines: [],
    };
    elements.push(element);
    elementByCol.set(col, element);
  }

  const dataStartIndex = PAINTING_ELEMENTS_DATA_START_ROW_1_BASED - rangeStartRow1Based;
  const dataEndIndex = PAINTING_ELEMENTS_DATA_END_ROW_1_BASED - rangeStartRow1Based;

  for (let i = dataStartIndex; i <= dataEndIndex && i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];
    const skuProduct = cellString(row[2]);
    if (!skuProduct) continue;

    const statusCheck = cellString(row[0]);
    const category = cellString(row[1]);
    const lineUom = cellString(row[3]);
    const litrePerM2 = parseOptionalNumber(row[4]);
    const priceLitre = parseOptionalNumber(row[5]);
    const priceM2 = parseOptionalNumber(row[6]);

    for (const col of elementCols) {
      const element = elementByCol.get(col);
      if (!element) continue;

      const qtyRaw = row[col];
      if (!hasM2MultiplierValue(qtyRaw)) continue;

      const m2Multiplier = parseM2Multiplier(qtyRaw);
      if (m2Multiplier == null) {
        errors.push(
          `Row ${sheetRow}, column ${columnIndexToLetter(col)}: invalid M2 multiplier for "${skuProduct}".`,
        );
        continue;
      }

      element.lines.push({
        statusCheck,
        category,
        skuProduct,
        lineUom,
        litrePerM2,
        priceLitre,
        priceM2,
        m2Multiplier,
        sheetRow,
      });
    }
  }

  return { elements, errors };
}
