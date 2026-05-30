export const DATA_OBJECTLABOURRATES_COLLECTION = "data_objectlabourrates";

export const DATA_OBJECTLABOURRATES_COLLECTION_META_ID = "_collection_meta";

export function isDataObjectlabourratesMetaDocument(docId: string): boolean {
  return docId === DATA_OBJECTLABOURRATES_COLLECTION_META_ID;
}
