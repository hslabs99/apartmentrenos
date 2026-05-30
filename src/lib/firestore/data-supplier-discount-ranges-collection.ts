export const DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION = "data_supplier_discount_ranges";

export const DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION_META_ID = "_collection_meta";

export function isDataSupplierDiscountRangesMetaDocument(docId: string): boolean {
  return docId === DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION_META_ID;
}
