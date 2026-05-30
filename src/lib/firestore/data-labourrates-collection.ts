export const DATA_LABOURRATES_COLLECTION = "data_labourrates";

export const DATA_LABOURRATES_COLLECTION_META_ID = "_collection_meta";

export function isDataLabourratesMetaDocument(docId: string): boolean {
  return docId === DATA_LABOURRATES_COLLECTION_META_ID;
}
