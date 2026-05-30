import {
  buildPrimarySupplierBySkuId,
  buildSuppliersBySkuId,
} from "@/lib/client/primary-supplier-by-sku";
import type { PrimarySupplierSummary } from "@/lib/client/primary-supplier-by-sku";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";

export type CatalogSkuData = {
  skus: DataSkuPublic[];
  primarySupplierBySkuId: Record<string, PrimarySupplierSummary>;
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
};

export async function loadCatalogSkuData(): Promise<CatalogSkuData> {
  const [skuRes, supRes] = await Promise.all([
    fetch("/api/data-skus"),
    fetch("/api/data-sku-suppliers"),
  ]);
  const skuData = (await skuRes.json()) as { items?: DataSkuPublic[]; error?: string };
  const supData = (await supRes.json()) as {
    items?: DataSkuSupplierPublic[];
    error?: string;
  };
  if (!skuRes.ok) throw new Error(skuData.error ?? "Failed to load data_skus");
  if (!supRes.ok) throw new Error(supData.error ?? "Failed to load data_sku_suppliers");
  const supplierItems = supData.items ?? [];
  return {
    skus: skuData.items ?? [],
    primarySupplierBySkuId: buildPrimarySupplierBySkuId(supplierItems),
    suppliersBySkuId: buildSuppliersBySkuId(supplierItems),
  };
}
