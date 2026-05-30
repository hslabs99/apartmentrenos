export const DATA_BLINDS_COLLECTION = "data_blinds";

export const DATA_BLINDS_COLLECTION_META_ID = "_collection_meta";

export function isDataBlindsMetaDocument(docId: string): boolean {
  return docId === DATA_BLINDS_COLLECTION_META_ID;
}
