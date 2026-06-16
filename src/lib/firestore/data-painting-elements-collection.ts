export const DATA_PAINTING_ELEMENTS_COLLECTION = "data_painting_elements";

export const DATA_PAINTING_ELEMENTS_COLLECTION_META_ID = "_collection_meta";

export function isDataPaintingElementsMetaDocument(docId: string): boolean {
  return docId === DATA_PAINTING_ELEMENTS_COLLECTION_META_ID;
}
