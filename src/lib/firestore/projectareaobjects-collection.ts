/**
 * Firestore has no separate "create collection" API — the `projectareaobjects`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const PROJECTAREAOBJECTS_COLLECTION_META_ID = "_collection_meta";

export function isProjectAreaObjectsMetaDocument(docId: string): boolean {
  return docId === PROJECTAREAOBJECTS_COLLECTION_META_ID;
}
