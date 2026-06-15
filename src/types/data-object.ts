/** Firestore `data_objects` — one quote object per category + product type (or labour product name). */
export type DataObject = {
  category: string;
  productType: string;
  /** Legacy labour rows may store a product name here; new rows leave this empty. */
  product: string;
  uom: string;
  /** Normalized composite key for dedupe queries. */
  objectKey: string;
  quoteObjectDocId: string | null;
  objectid: number | null;
};
