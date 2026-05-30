/** Firestore `data_sku_suppliers` document — supplier option (cols G–M). */
export type DataSkuSupplier = {
  skuId: string;
  /** Supplier option 1–10 (sheet “Priority” column). */
  supplierOption: number;
  supplier: string;
  model: string;
  /** Supplier’s own SKU/code (sheet “SKU” column) — not `skuId`. */
  supplierSku: string;
  link: string;
  priceIncGst: number | null;
  priceExcGst: number | null;
  sourceSheetRows: number[];
};
