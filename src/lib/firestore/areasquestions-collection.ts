/**
 * Firestore has no separate "create collection" API — the `areasquestions`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const AREASQUESTIONS_COLLECTION_META_ID = "_collection_meta";

export function isAreasQuestionsMetaDocument(docId: string): boolean {
  return docId === AREASQUESTIONS_COLLECTION_META_ID;
}

