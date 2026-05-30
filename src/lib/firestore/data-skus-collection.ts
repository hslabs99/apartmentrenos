export const DATA_SKUS_COLLECTION = "data_skus";

export const DATA_SKUS_COLLECTION_META_ID = "_collection_meta";

export function isDataSkusMetaDocument(docId: string): boolean {
  return docId === DATA_SKUS_COLLECTION_META_ID;
}
