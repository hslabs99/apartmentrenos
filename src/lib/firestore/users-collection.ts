/**
 * Firestore has no separate "create collection" API — the `users` collection
 * appears once this document exists. Hidden from the Users CRUD list.
 */
export const USERS_COLLECTION_META_ID = "_collection_meta";

export function isUsersMetaDocument(docId: string): boolean {
  return docId === USERS_COLLECTION_META_ID;
}
