/**
 * Firestore has no separate "create collection" API — the `project_notes` collection
 * appears once this document exists. Hidden from the project notes CRUD list.
 */
export const PROJECT_NOTES_COLLECTION_META_ID = "_collection_meta";

export function isProjectNotesMetaDocument(docId: string): boolean {
  return docId === PROJECT_NOTES_COLLECTION_META_ID;
}
