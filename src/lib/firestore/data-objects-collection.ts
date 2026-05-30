export const DATA_OBJECTS_COLLECTION = "data_objects";

export const DATA_OBJECTS_COLLECTION_META_ID = "_collection_meta";

export function isDataObjectsMetaDocument(docId: string): boolean {
  return docId === DATA_OBJECTS_COLLECTION_META_ID;
}
