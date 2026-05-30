export const DATA_BLINDS_FOOTERS_COLLECTION = "data_blinds_footers";

export const DATA_BLINDS_FOOTERS_COLLECTION_META_ID = "_collection_meta";

export function isDataBlindsFootersMetaDocument(docId: string): boolean {
  return docId === DATA_BLINDS_FOOTERS_COLLECTION_META_ID;
}
