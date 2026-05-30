/**
 * Bootstrap doc so the `price_levels` collection exists. Hidden from CRUD lists.
 */
export const PRICE_LEVELS_COLLECTION_META_ID = "_collection_meta";

export function isPriceLevelsMetaDocument(docId: string): boolean {
  return docId === PRICE_LEVELS_COLLECTION_META_ID;
}
