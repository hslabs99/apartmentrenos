/**
 * Firestore has no separate "create collection" API — the `areaobjects`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const AREAOBJECTS_COLLECTION_META_ID = "_collection_meta";

export function isAreaObjectsMetaDocument(docId: string): boolean {
  return docId === AREAOBJECTS_COLLECTION_META_ID;
}
