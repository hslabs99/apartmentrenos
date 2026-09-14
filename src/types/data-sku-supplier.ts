/** Firestore `data_sku_suppliers` document — supplier option (cols G–M) + that row’s appends. */
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
  /** Append slots from this priority row only (not merged across P1/P2/P3). */
  append1Type: string;
  append1Spec: string;
  append2Type: string;
  append2Spec: string;
  append3Type: string;
  append3Spec: string;
};
