/**
 * Firestore has no separate "create collection" API — the `projects` collection
 * appears once this document exists. Hidden from the Projects CRUD list.
 */
export const PROJECTS_COLLECTION_META_ID = "_collection_meta";

export function isProjectsMetaDocument(docId: string): boolean {
  return docId === PROJECTS_COLLECTION_META_ID;
}
