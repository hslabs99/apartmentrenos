import { normalizeSupplierNameKey } from "@/lib/supplier/normalize-supplier-name";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";

export type SupplierDiscountByKey = Map<string, DataSupplierDiscountPublic>;

/** Same normalisation as `dataSupplierDiscountKey` (supplier name). */
export function supplierDiscountKey(supplier: string): string {
  return normalizeSupplierNameKey(supplier);
}

export function supplierDiscountByKeyFromRows(
  rows: DataSupplierDiscountPublic[],
): SupplierDiscountByKey {
  const map: SupplierDiscountByKey = new Map();
  for (const row of rows) {
    const key = supplierDiscountKey(row.supplier);
    if (!key || map.has(key)) continue;
    map.set(key, row);
  }
  return map;
}

/** Default % column when supplier uses a retail price book (discount &gt; 0). */
export function defaultSupplierDiscountPct(
  supplierName: string,
  discountByKey: SupplierDiscountByKey,
): number {
  const row = discountByKey.get(supplierDiscountKey(supplierName));
  const pct = row?.default;
  if (typeof pct !== "number" || !Number.isFinite(pct) || pct <= 0) return 0;
  return pct;
}

/** Retail ex-GST → cost ex-GST after supplier default discount. */
export function applySupplierDiscountToPriceExcGst(
  retailExcGst: number | null,
  discountPct: number,
): number | null {
  if (retailExcGst == null || !Number.isFinite(retailExcGst)) return null;
  if (!(discountPct > 0)) return retailExcGst;
  return Math.round(retailExcGst * (1 - discountPct / 100) * 100) / 100;
}

export function formatSupplierDiscountPctLabel(discountPct: number): string {
  if (!(discountPct > 0)) return "";
  const rounded = Math.round(discountPct * 100) / 100;
  const text =
    Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${text}%`;
}

export type AdjustedSupplierPrice = {
  priceExcGst: number | null;
  discountPctApplied: number | null;
};

export function adjustedSupplierPriceExcGst(
  sup: Pick<DataSkuSupplierPublic, "supplier" | "priceExcGst">,
  discountByKey: SupplierDiscountByKey,
): AdjustedSupplierPrice {
  const discountPct = defaultSupplierDiscountPct(sup.supplier, discountByKey);
  if (!(discountPct > 0)) {
    return { priceExcGst: sup.priceExcGst, discountPctApplied: null };
  }
  return {
    priceExcGst: applySupplierDiscountToPriceExcGst(sup.priceExcGst, discountPct),
    discountPctApplied: discountPct,
  };
}
