import type { DataSkuSupplier } from "@/types/data-sku-supplier";

/** `data_sku_suppliers` document returned from the API. */
export type DataSkuSupplierPublic = DataSkuSupplier & {
  id: string;
};
