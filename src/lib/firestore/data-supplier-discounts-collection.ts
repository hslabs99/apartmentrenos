export const DATA_SUPPLIER_DISCOUNTS_COLLECTION = "data_supplier_discounts";



export const DATA_SUPPLIER_DISCOUNTS_COLLECTION_META_ID = "_collection_meta";



export function isDataSupplierDiscountsMetaDocument(docId: string): boolean {

  return docId === DATA_SUPPLIER_DISCOUNTS_COLLECTION_META_ID;

}


