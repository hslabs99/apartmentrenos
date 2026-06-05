import type { PrimarySupplierSummary } from "@/lib/client/primary-supplier-by-sku";
import type { DataSku } from "@/types/data-sku";

/** `data_skus` document returned from the API (`id` === `skuId`). */
export type DataSkuPublic = DataSku & {
  id: string;
  supplierCount: number;
  /** Best-priority supplier row (option 1, else lowest available). */
  primarySupplier: PrimarySupplierSummary | null;
};
