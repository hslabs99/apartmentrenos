import {
  preferredSkuPickForProductName,
  preferredSupplierForSku,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

function normalizeSkuName(value: string): string {
  return value.trim().toLowerCase();
}

/** Case-insensitive map: building element SKU Name (row 2) → element doc. */
export function buildBuildingElementIndex(
  items: DataBuildingElementPublic[],
): Map<string, DataBuildingElementPublic> {
  const map = new Map<string, DataBuildingElementPublic>();
  for (const item of items) {
    const key = normalizeSkuName(item.skuName);
    if (!key || map.has(key)) continue;
    map.set(key, item);
  }
  return map;
}

/** SKU product name on the line used to match `data_building_elements.skuName`. */
export function buildingElementSkuNameForLine(
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
): string | null {
  const fromLine = line.skuProduct?.trim();
  if (fromLine) return fromLine;

  const skuId = line.skuId?.trim();
  if (!skuId) return null;

  const sku = catalogSkus.find((s) => s.id === skuId);
  const product = sku?.product?.trim();
  return product || null;
}

export function findBuildingElementForLine(
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
  index: Map<string, DataBuildingElementPublic>,
): DataBuildingElementPublic | null {
  const skuName = buildingElementSkuNameForLine(line, catalogSkus);
  if (!skuName) return null;
  return index.get(normalizeSkuName(skuName)) ?? null;
}

export type BuildingElementConsumptionRow = {
  category: string;
  skuProduct: string;
  lineUom: string;
  unitQty: number;
  extendedQty: number;
  /** Matched `data_skus` row + preferred supplier (same as SKU dropdown default). */
  skuPick: ScopeLineSkuPick | null;
  /** Retail ex-GST (before supplier discount) — used for Price column and unit cost. */
  retailPriceExcGst: number | null;
  /** Supplier discount % when applied to extended cost. */
  discountPctApplied: number | null;
  /** `unitQty × retailPriceExcGst` — per 1 parent UOM (sheet build / price check). */
  unitLineTotalExcGst: number | null;
  /** `extendedQty × discounted price` — supplier discount applies here only. */
  lineTotalExcGst: number | null;
};

/** Parent line measure multiplier (defaults to 1 when unset). */
export function buildingElementParentMultiplier(line: ProjectAreaObjectPublic): number {
  const m = line.custommeasure;
  if (m != null && Number.isFinite(m)) return m;
  return 1;
}

export function buildBuildingElementConsumptionRows(
  element: DataBuildingElementPublic,
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): BuildingElementConsumptionRow[] {
  const multiplier = buildingElementParentMultiplier(line);
  return element.lines.map((row) => {
    const skuPick = preferredSkuPickForProductName(
      row.skuProduct,
      catalogSkus,
      suppliersBySkuId,
      supplierDiscountByKey,
    );

    let retailPriceExcGst: number | null = row.unitPrice ?? null;
    let discountedPriceExcGst: number | null = row.unitPrice ?? null;
    let discountPctApplied: number | null = null;

    if (skuPick) {
      const suppliers = suppliersBySkuId[skuPick.skuId] ?? [];
      const sup =
        suppliers.find((s) => s.supplierOption === skuPick.supplierOption) ??
        preferredSupplierForSku(suppliers);
      retailPriceExcGst = sup?.priceExcGst ?? skuPick.priceExcGst ?? row.unitPrice ?? null;
      discountedPriceExcGst = skuPick.priceExcGst ?? retailPriceExcGst;
      discountPctApplied = skuPick.discountPctApplied;
    }

    const extendedQty = row.quantity * multiplier;
    const unitLineTotalExcGst =
      retailPriceExcGst != null ? row.quantity * retailPriceExcGst : null;
    const extendedPriceExcGst = discountedPriceExcGst ?? retailPriceExcGst;
    const lineTotalExcGst =
      extendedPriceExcGst != null ? extendedQty * extendedPriceExcGst : null;

    return {
      category: row.category,
      skuProduct: row.skuProduct,
      lineUom: row.lineUom,
      unitQty: row.quantity,
      extendedQty,
      skuPick,
      retailPriceExcGst,
      discountPctApplied,
      unitLineTotalExcGst,
      lineTotalExcGst,
    };
  });
}

const PRICE_CHECK_TOLERANCE = 0.02;

export function sumBuildingElementUnitTotals(
  rows: BuildingElementConsumptionRow[],
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

export function sumBuildingElementExtendedTotals(
  rows: BuildingElementConsumptionRow[],
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

export function buildingElementPriceCheck(
  componentsUnitTotal: number | null,
  wallUnitPriceExcGst: number | null,
): { matches: boolean | null; difference: number | null } {
  if (componentsUnitTotal == null || wallUnitPriceExcGst == null) {
    return { matches: null, difference: null };
  }
  const difference = componentsUnitTotal - wallUnitPriceExcGst;
  return {
    matches: Math.abs(difference) <= PRICE_CHECK_TOLERANCE,
    difference,
  };
}
