/**
 * Firestore has no separate "create collection" API — the `lookups`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const LOOKUPS_COLLECTION_META_ID = "_collection_meta";

export function isLookupsMetaDocument(docId: string): boolean {
  return docId === LOOKUPS_COLLECTION_META_ID;
}
