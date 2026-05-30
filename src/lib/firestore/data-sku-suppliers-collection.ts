export const DATA_SKU_SUPPLIERS_COLLECTION = "data_sku_suppliers";

export const DATA_SKU_SUPPLIERS_COLLECTION_META_ID = "_collection_meta";

export function isDataSkuSuppliersMetaDocument(docId: string): boolean {
  return docId === DATA_SKU_SUPPLIERS_COLLECTION_META_ID;
}
