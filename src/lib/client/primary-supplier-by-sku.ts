import { isValidSupplierOption } from "@/lib/sku/supplier-option";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";

export type PrimarySupplierSummary = {
  supplier: string;
  priceIncGst: number | null;
  priceExcGst: number | null;
  /** Lowest supplier option on file for this SKU (1 preferred; 2, 3, … as fallback). */
  supplierOption: number;
};

/** Best supplier row per SKU: option 1, else 2, else 3, else lowest option available. */
export function buildPrimarySupplierBySkuId(
  items: DataSkuSupplierPublic[],
): Record<string, PrimarySupplierSummary> {
  const bySku = new Map<string, DataSkuSupplierPublic[]>();
  for (const s of items) {
    if (!isValidSupplierOption(s.supplierOption)) continue;
    const list = bySku.get(s.skuId) ?? [];
    list.push(s);
    bySku.set(s.skuId, list);
  }

  const out: Record<string, PrimarySupplierSummary> = {};
  for (const [skuId, list] of bySku) {
    const sorted = [...list].sort((a, b) => a.supplierOption - b.supplierOption);
    const best = sorted[0];
    if (!best) continue;
    out[skuId] = {
      supplier: best.supplier.trim(),
      priceIncGst: best.priceIncGst,
      priceExcGst: best.priceExcGst,
      supplierOption: best.supplierOption,
    };
  }
  return out;
}

/** All supplier rows per SKU, sorted by priority (1, 2, 3, …). */
export function buildSuppliersBySkuId(
  items: DataSkuSupplierPublic[],
): Record<string, DataSkuSupplierPublic[]> {
  const bySku = new Map<string, DataSkuSupplierPublic[]>();
  for (const s of items) {
    if (!isValidSupplierOption(s.supplierOption)) continue;
    const list = bySku.get(s.skuId) ?? [];
    list.push(s);
    bySku.set(s.skuId, list);
  }
  const out: Record<string, DataSkuSupplierPublic[]> = {};
  for (const [skuId, list] of bySku) {
    out[skuId] = [...list].sort((a, b) => a.supplierOption - b.supplierOption);
  }
  return out;
}
