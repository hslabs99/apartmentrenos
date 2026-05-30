export const DATA_BLINDS_TYPES_COLLECTION = "data_blinds_types";

export const DATA_BLINDS_TYPES_COLLECTION_META_ID = "_collection_meta";

export function isDataBlindsTypesMetaDocument(docId: string): boolean {
  return docId === DATA_BLINDS_TYPES_COLLECTION_META_ID;
}
