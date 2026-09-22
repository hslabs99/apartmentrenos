import { catalogJsonGet } from "@/lib/client/catalog-fetch-cache";
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

export async function loadCatalogSkuData(signal?: AbortSignal): Promise<CatalogSkuData> {
  const req = signal ? { signal } : undefined;
  const skuResult = await catalogJsonGet<{
    items?: DataSkuPublic[];
    suppliers?: DataSkuSupplierPublic[];
    error?: string;
  }>("/api/data-skus?includeSuppliers=1", req);
  if (!skuResult.ok) throw new Error(skuResult.data.error ?? "Failed to load data_skus");

  let supplierItems = skuResult.data.suppliers;
  if (!supplierItems) {
    const supResult = await catalogJsonGet<{
      items?: DataSkuSupplierPublic[];
      error?: string;
    }>("/api/data-sku-suppliers", req);
    if (!supResult.ok) {
      throw new Error(supResult.data.error ?? "Failed to load data_sku_suppliers");
    }
    supplierItems = supResult.data.items ?? [];
  }

  return {
    skus: skuResult.data.items ?? [],
    primarySupplierBySkuId: buildPrimarySupplierBySkuId(supplierItems),
    suppliersBySkuId: buildSuppliersBySkuId(supplierItems),
  };
}
