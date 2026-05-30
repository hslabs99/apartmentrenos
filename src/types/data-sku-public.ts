import type { DataSku } from "@/types/data-sku";

/** `data_skus` document returned from the API (`id` === `skuId`). */
export type DataSkuPublic = DataSku & {
  id: string;
  supplierCount: number;
};
