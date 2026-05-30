/**
 * Firestore — the `settings` collection appears once this document exists.
 * Hidden from CRUD lists.
 */
export const SETTINGS_COLLECTION_META_ID = "_collection_meta";

export function isSettingsMetaDocument(docId: string): boolean {
  return docId === SETTINGS_COLLECTION_META_ID;
}
