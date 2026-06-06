import { columnIndexToLetter } from "@/lib/google/sheet-column-letter";
import type { DataBuildingElement } from "@/types/data-building-element";

/** `Building Elements` tab: element headers rows 2–6 (cols F+), detail rows 9–100. */
export const BUILDING_ELEMENTS_SHEET_RANGE = "A1:BA100";

export const BUILDING_ELEMENTS_SKU_NAME_ROW_1_BASED = 2;
export const BUILDING_ELEMENTS_ELEMENT_ROW_1_BASED = 3;
export const BUILDING_ELEMENTS_SIZE_ROW_1_BASED = 4;
export const BUILDING_ELEMENTS_TYPE_ROW_1_BASED = 5;
export const BUILDING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED = 6;
export const BUILDING_ELEMENTS_DATA_START_ROW_1_BASED = 9;
export const BUILDING_ELEMENTS_DATA_END_ROW_1_BASED = 100;

/** First element column (F = 0-based index 5). */
export const BUILDING_ELEMENTS_ELEMENT_START_COL_INDEX = 5;

export type ParsedBuildingElements = {
  elements: DataBuildingElement[];
  errors: string[];
};

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

function parseQuantity(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellString(v).replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function hasQuantityValue(v: unknown): boolean {
  return parseQuantity(v) != null;
}

function detailRowHeaderMatches(row: unknown[]): boolean {
  const labels = [0, 1, 2, 3, 4].map((i) => normalizeHeaderLabel(row[i]));
  return (
    labels[0] === "status check" &&
    labels[1] === "category" &&
    labels[2] === "sku product" &&
    labels[3] === "uom" &&
    labels[4] === "price"
  );
}

function discoverElementColumnIndexes(values: unknown[][]): number[] {
  const skuNameRow = values[BUILDING_ELEMENTS_SKU_NAME_ROW_1_BASED - 1] ?? [];
  const cols: number[] = [];
  for (let col = BUILDING_ELEMENTS_ELEMENT_START_COL_INDEX; col < skuNameRow.length; col++) {
    const skuName = cellString(skuNameRow[col]);
    if (!skuName) break;
    cols.push(col);
  }
  return cols;
}

/**
 * Parse building elements from `Building Elements!A1:BA100`.
 */
export function parseBuildingElementsRows(
  values: unknown[][],
  rangeStartRow1Based = 1,
): ParsedBuildingElements {
  const errors: string[] = [];
  const detailHeaderRow = values[BUILDING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED - 1] ?? [];
  if (!detailRowHeaderMatches(detailHeaderRow)) {
    const found = [0, 1, 2, 3, 4]
      .map((i) => cellString(detailHeaderRow[i]))
      .filter(Boolean)
      .join(" | ");
    return {
      elements: [],
      errors: [
        `Row ${BUILDING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED} must start with Status Check, Category, SKU Product, UOM, Price. Found: ${found || "(empty)"}`,
      ],
    };
  }

  const elementCols = discoverElementColumnIndexes(values);
  if (elementCols.length === 0) {
    return {
      elements: [],
      errors: [`No building element columns found from column F (row ${BUILDING_ELEMENTS_SKU_NAME_ROW_1_BASED} SKU Name empty).`],
    };
  }

  const skuNameRow = values[BUILDING_ELEMENTS_SKU_NAME_ROW_1_BASED - 1] ?? [];
  const elementRow = values[BUILDING_ELEMENTS_ELEMENT_ROW_1_BASED - 1] ?? [];
  const sizeRow = values[BUILDING_ELEMENTS_SIZE_ROW_1_BASED - 1] ?? [];
  const typeRow = values[BUILDING_ELEMENTS_TYPE_ROW_1_BASED - 1] ?? [];
  const quantityUomRow = values[BUILDING_ELEMENTS_QUANTITY_UOM_ROW_1_BASED - 1] ?? [];

  const elements: DataBuildingElement[] = [];
  const elementByCol = new Map<number, DataBuildingElement>();
  const seenSkuNames = new Set<string>();

  for (const col of elementCols) {
    const skuName = cellString(skuNameRow[col]);
    const skuNorm = skuName.toLowerCase();
    if (seenSkuNames.has(skuNorm)) {
      errors.push(
        `Duplicate SKU Name "${skuName}" in column ${columnIndexToLetter(col)} (row ${BUILDING_ELEMENTS_SKU_NAME_ROW_1_BASED}).`,
      );
      continue;
    }
    seenSkuNames.add(skuNorm);

    const element: DataBuildingElement = {
      skuName,
      element: cellString(elementRow[col]),
      size: cellString(sizeRow[col]),
      type: cellString(typeRow[col]),
      quantityUom: cellString(quantityUomRow[col]),
      sheetColumn: columnIndexToLetter(col),
      headerSheetRow: BUILDING_ELEMENTS_SKU_NAME_ROW_1_BASED,
      lines: [],
    };
    elements.push(element);
    elementByCol.set(col, element);
  }

  const dataStartIndex = BUILDING_ELEMENTS_DATA_START_ROW_1_BASED - rangeStartRow1Based;
  const dataEndIndex = BUILDING_ELEMENTS_DATA_END_ROW_1_BASED - rangeStartRow1Based;

  for (let i = dataStartIndex; i <= dataEndIndex && i < values.length; i++) {
    const sheetRow = rangeStartRow1Based + i;
    const row = values[i] ?? [];
    const skuProduct = cellString(row[2]);
    if (!skuProduct) continue;

    const category = cellString(row[1]);
    const lineUom = cellString(row[3]);
    const unitPrice = parseOptionalMoney(row[4]);

    for (const col of elementCols) {
      const element = elementByCol.get(col);
      if (!element) continue;

      const qtyRaw = row[col];
      if (!hasQuantityValue(qtyRaw)) continue;

      const quantity = parseQuantity(qtyRaw);
      if (quantity == null) {
        errors.push(
          `Row ${sheetRow}, column ${columnIndexToLetter(col)}: invalid quantity for "${skuProduct}".`,
        );
        continue;
      }

      element.lines.push({
        category,
        skuProduct,
        lineUom,
        unitPrice,
        quantity,
        sheetRow,
      });
    }
  }

  return { elements, errors };
}
