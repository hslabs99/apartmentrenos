import {
  buildPaintingElementConsumptionRows,
  findPaintingElementForLine,
  isPaintingParentPackageLine,
} from "@/lib/client/painting-element-index";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import { LABOUR_RATE_CATEGORY } from "@/lib/labour-silo";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

export const PAINTING_SITE_FEE_PRODUCT_TYPE = "Painting";
export const PAINTING_SITE_FEE_PRODUCT = "Painting Site Fee";

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Flat site setup fee from `data_labourrates` (Labour / Painting / Painting Site Fee). */
export function paintingSiteFeeRate(
  rates: DataLabourRatePublic[],
): DataLabourRatePublic | null {
  const matches = rates.filter(
    (r) =>
      normKey(r.category) === normKey(LABOUR_RATE_CATEGORY) &&
      normKey(r.productType) === normKey(PAINTING_SITE_FEE_PRODUCT_TYPE) &&
      normKey(r.product) === normKey(PAINTING_SITE_FEE_PRODUCT),
  );
  return matches[0] ?? null;
}

export function paintingSiteFeeExcGst(rates: DataLabourRatePublic[]): number | null {
  const rate = paintingSiteFeeRate(rates);
  if (!rate || !Number.isFinite(rate.priceExcGst)) return null;
  return rate.priceExcGst;
}

export type ProjectPaintConsumptionArgs = {
  objects: ProjectAreaObjectPublic[];
  catalogSkus: DataSkuPublic[];
  paintingElementBySkuName: Map<string, DataPaintingElementPublic>;
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  supplierDiscountByKey?: SupplierDiscountByKey;
};

/** True when any included paint parent line explodes to paint material litres. */
export function projectHasPaintConsumption(args: ProjectPaintConsumptionArgs): boolean {
  const {
    objects,
    catalogSkus,
    paintingElementBySkuName,
    suppliersBySkuId,
    supplierDiscountByKey = new Map(),
  } = args;

  for (const row of objects) {
    if (row.included === false) continue;
    if (!isPaintingParentPackageLine(row, catalogSkus, paintingElementBySkuName)) continue;
    const element = findPaintingElementForLine(row, catalogSkus, paintingElementBySkuName);
    if (!element) continue;
    const consumption = buildPaintingElementConsumptionRows(
      element,
      row,
      catalogSkus,
      suppliersBySkuId,
      supplierDiscountByKey,
    );
    for (const part of consumption) {
      if (part.litrePerM2 == null || !Number.isFinite(part.litrePerM2)) continue;
      if ((part.extendedLitres ?? 0) > 0) return true;
    }
  }
  return false;
}

export function paintingSiteFeeWithMarginExcGst(
  feeExcGst: number,
  marginPct: number,
): number {
  return Math.round(feeExcGst * (1 + marginPct / 100) * 100) / 100;
}
