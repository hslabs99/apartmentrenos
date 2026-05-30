/**
 * Bootstrap doc so the `scopes` collection exists. Hidden from CRUD lists.
 */
export const SCOPES_COLLECTION_META_ID = "_collection_meta";

export function isScopesMetaDocument(docId: string): boolean {
  return docId === SCOPES_COLLECTION_META_ID;
}
