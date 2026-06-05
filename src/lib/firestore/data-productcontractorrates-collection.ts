export const DATA_PRODUCTCONTRACTORRATES_COLLECTION = "data_productcontractorrates";

export const DATA_PRODUCTCONTRACTORRATES_COLLECTION_META_ID = "_collection_meta";

export function isDataProductcontractorratesMetaDocument(docId: string): boolean {
  return docId === DATA_PRODUCTCONTRACTORRATES_COLLECTION_META_ID;
}
