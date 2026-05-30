/** Firestore `data_objects` — one quote object line per category + product type. */
export type DataObject = {
  category: string;
  productType: string;
  /** Always empty; SKUs carry product detail. */
  product: string;
  uom: string;
  /** Normalized composite key for dedupe queries. */
  objectKey: string;
  quoteObjectDocId: string | null;
  objectid: number | null;
};
