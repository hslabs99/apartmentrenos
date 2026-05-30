/**
 * Firestore has no separate "create collection" API — the `projectareaanswers`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const PROJECTAREAANSWERS_COLLECTION_META_ID = "_collection_meta";

export function isProjectAreaAnswersMetaDocument(docId: string): boolean {
  return docId === PROJECTAREAANSWERS_COLLECTION_META_ID;
}

