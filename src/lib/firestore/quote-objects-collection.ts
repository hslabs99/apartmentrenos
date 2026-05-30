/**
 * Firestore has no separate "create collection" API — the `quote_objects`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const QUOTE_OBJECTS_COLLECTION_META_ID = "_collection_meta";

export function isQuoteObjectsMetaDocument(docId: string): boolean {
  return docId === QUOTE_OBJECTS_COLLECTION_META_ID;
}
