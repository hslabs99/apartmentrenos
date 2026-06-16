import {
  preferredSkuPickForProductName,
  preferredSupplierForSku,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

function normalizeSkuName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Case-insensitive map: painting element SKU Name (row 2) → element doc. */
export function buildPaintingElementIndex(
  items: DataPaintingElementPublic[],
): Map<string, DataPaintingElementPublic> {
  const map = new Map<string, DataPaintingElementPublic>();
  for (const item of items) {
    const key = normalizeSkuName(item.skuName);
    if (!key || map.has(key)) continue;
    map.set(key, item);
  }
  return map;
}

/** SKU product name on the line used to match `data_painting_elements.skuName`. */
export function paintingElementSkuNameForLine(
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
): string | null {
  const fromLine = line.skuProduct?.trim();
  if (fromLine) return fromLine;

  const skuId = line.skuId?.trim();
  if (!skuId) return null;

  const sku = catalogSkus.find((s) => s.skuId === skuId || s.id === skuId);
  const product = sku?.product?.trim();
  return product || null;
}

export function catalogSkuForProjectLine(
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
): DataSkuPublic | null {
  const skuId = line.skuId?.trim();
  if (!skuId) return null;
  return catalogSkus.find((s) => s.skuId === skuId || s.id === skuId) ?? null;
}

/** Parent paint package (not material/component SKU) — matches element matrix or painting category. */
export function isPaintingParentPackageLine(
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
  paintingElementBySkuName?: Map<string, DataPaintingElementPublic>,
): boolean {
  const skuName = paintingElementSkuNameForLine(line, catalogSkus);
  if (!skuName) return false;
  if (paintingElementBySkuName?.has(normalizeSkuName(skuName))) return true;
  const sku = catalogSkuForProjectLine(line, catalogSkus);
  if (sku) {
    const category = sku.category.trim().toLowerCase();
    const productType = sku.productType.trim().toLowerCase();
    const isPaint =
      category.includes("paint") || productType.includes("paint");
    const isMaterial =
      category.includes("material") || productType.includes("material");
    if (isPaint && !isMaterial) return true;
  }
  // Workbench parent line with SKU product but no catalog link — still report + red-flag.
  return Boolean(line.skuProduct?.trim());
}

export function findPaintingElementForLine(
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
  index: Map<string, DataPaintingElementPublic>,
): DataPaintingElementPublic | null {
  const skuName = paintingElementSkuNameForLine(line, catalogSkus);
  if (!skuName) return null;
  return index.get(normalizeSkuName(skuName)) ?? null;
}

export type PaintingElementConsumptionRow = {
  category: string;
  skuProduct: string;
  lineUom: string;
  unitM2Multiplier: number;
  extendedM2: number;
  litrePerM2: number | null;
  extendedLitres: number | null;
  skuPick: ScopeLineSkuPick | null;
  retailPriceExcGst: number | null;
  discountPctApplied: number | null;
  unitLineTotalExcGst: number | null;
  lineTotalExcGst: number | null;
};

/** Parent line measure multiplier (defaults to 1 when unset). */
export function paintingElementParentMultiplier(line: ProjectAreaObjectPublic): number {
  const m = line.custommeasure;
  if (m != null && Number.isFinite(m)) return m;
  return 1;
}

function sheetUnitPriceExcGst(
  lineUom: string,
  priceM2: number | null,
  priceLitre: number | null,
): number | null {
  const uom = lineUom.trim().toUpperCase();
  if (uom === "M2" || uom === "M²") return priceM2;
  if (uom === "LTR" || uom === "L" || uom === "LITRE" || uom === "LITRES") {
    return priceLitre ?? priceM2;
  }
  if (uom === "HRS" || uom === "HR" || uom === "HOURS") return priceLitre ?? priceM2;
  return priceM2 ?? priceLitre;
}

/** Paint material rows: litres already include m² via L/m² — price per litre, not per m² again. */
function isLitrePricedPaintMaterialRow(
  litrePerM2: number | null,
  extendedLitres: number | null,
): boolean {
  return (
    litrePerM2 != null &&
    Number.isFinite(litrePerM2) &&
    extendedLitres != null &&
    Number.isFinite(extendedLitres)
  );
}

export function buildPaintingElementConsumptionRows(
  element: DataPaintingElementPublic,
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): PaintingElementConsumptionRow[] {
  const multiplier = paintingElementParentMultiplier(line);
  return element.lines.map((row) => {
    const skuPick = preferredSkuPickForProductName(
      row.skuProduct,
      catalogSkus,
      suppliersBySkuId,
      supplierDiscountByKey,
    );

    let retailPriceExcGst: number | null = sheetUnitPriceExcGst(
      row.lineUom,
      row.priceM2,
      row.priceLitre,
    );
    let discountedPriceExcGst: number | null = retailPriceExcGst;
    let discountPctApplied: number | null = null;

    if (skuPick) {
      const suppliers = suppliersBySkuId[skuPick.skuId] ?? [];
      const sup =
        suppliers.find((s) => s.supplierOption === skuPick.supplierOption) ??
        preferredSupplierForSku(suppliers);
      const catalogPrice = sup?.priceExcGst ?? skuPick.priceExcGst ?? null;
      if (catalogPrice != null) {
        retailPriceExcGst = catalogPrice;
      }
      discountedPriceExcGst = skuPick.priceExcGst ?? retailPriceExcGst;
      discountPctApplied = skuPick.discountPctApplied;
    }

    const extendedM2 = row.m2Multiplier * multiplier;
    const extendedLitres =
      row.litrePerM2 != null && Number.isFinite(row.litrePerM2)
        ? extendedM2 * row.litrePerM2
        : null;

    const litrePriced = isLitrePricedPaintMaterialRow(row.litrePerM2, extendedLitres);
    const extendedPriceExcGst = discountedPriceExcGst ?? retailPriceExcGst;

    let unitLineTotalExcGst: number | null;
    let lineTotalExcGst: number | null;
    if (litrePriced) {
      const unitLitres = row.m2Multiplier * row.litrePerM2!;
      unitLineTotalExcGst =
        retailPriceExcGst != null ? unitLitres * retailPriceExcGst : null;
      lineTotalExcGst =
        extendedPriceExcGst != null && extendedLitres != null
          ? extendedLitres * extendedPriceExcGst
          : null;
    } else {
      unitLineTotalExcGst =
        retailPriceExcGst != null ? row.m2Multiplier * retailPriceExcGst : null;
      lineTotalExcGst =
        extendedPriceExcGst != null ? extendedM2 * extendedPriceExcGst : null;
    }

    return {
      category: row.category,
      skuProduct: row.skuProduct,
      lineUom: row.lineUom,
      unitM2Multiplier: row.m2Multiplier,
      extendedM2,
      litrePerM2: row.litrePerM2,
      extendedLitres,
      skuPick,
      retailPriceExcGst,
      discountPctApplied,
      unitLineTotalExcGst,
      lineTotalExcGst,
    };
  });
}

const PRICE_CHECK_TOLERANCE = 0.02;

export function sumPaintingElementUnitTotals(
  rows: PaintingElementConsumptionRow[],
): { total: number | null; pricedRowCount: number; missingPriceCount: number } {
  let total = 0;
  let pricedRowCount = 0;
  let missingPriceCount = 0;
  for (const row of rows) {
    if (row.unitLineTotalExcGst == null) {
      missingPriceCount += 1;
      continue;
    }
    total += row.unitLineTotalExcGst;
    pricedRowCount += 1;
  }
  if (pricedRowCount === 0) return { total: null, pricedRowCount, missingPriceCount };
  return { total, pricedRowCount, missingPriceCount };
}

export function sumPaintingElementExtendedTotals(
  rows: PaintingElementConsumptionRow[],
): { total: number | null; pricedRowCount: number; missingPriceCount: number } {
  let total = 0;
  let pricedRowCount = 0;
  let missingPriceCount = 0;
  for (const row of rows) {
    if (row.lineTotalExcGst == null) {
      missingPriceCount += 1;
      continue;
    }
    total += row.lineTotalExcGst;
    pricedRowCount += 1;
  }
  if (pricedRowCount === 0) return { total: null, pricedRowCount, missingPriceCount };
  return { total, pricedRowCount, missingPriceCount };
}

export function paintingElementPriceCheck(
  componentsUnitTotal: number | null,
  paintUnitPriceExcGst: number | null,
): { matches: boolean | null; difference: number | null } {
  if (componentsUnitTotal == null || paintUnitPriceExcGst == null) {
    return { matches: null, difference: null };
  }
  const difference = componentsUnitTotal - paintUnitPriceExcGst;
  return {
    matches: Math.abs(difference) <= PRICE_CHECK_TOLERANCE,
    difference,
  };
}
