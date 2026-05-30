/**
 * Firestore has no separate "create collection" API — the `projectareas`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const PROJECTAREAS_COLLECTION_META_ID = "_collection_meta";

export function isProjectAreasMetaDocument(docId: string): boolean {
  return docId === PROJECTAREAS_COLLECTION_META_ID;
}
