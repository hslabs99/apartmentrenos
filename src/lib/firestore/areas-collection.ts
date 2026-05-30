/**
 * Firestore has no separate "create collection" API — the `areas`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const AREAS_COLLECTION_META_ID = "_collection_meta";

export function isAreasMetaDocument(docId: string): boolean {
  return docId === AREAS_COLLECTION_META_ID;
}
