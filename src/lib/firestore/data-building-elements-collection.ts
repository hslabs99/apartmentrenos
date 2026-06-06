export const DATA_BUILDING_ELEMENTS_COLLECTION = "data_building_elements";

export const DATA_BUILDING_ELEMENTS_COLLECTION_META_ID = "_collection_meta";

export function isDataBuildingElementsMetaDocument(docId: string): boolean {
  return docId === DATA_BUILDING_ELEMENTS_COLLECTION_META_ID;
}
