export const CASCADES_COLLECTION = "cascades";

export const CASCADES_COLLECTION_META_ID = "_collection_meta";

export function isCascadesMetaDocument(docId: string): boolean {
  return docId === CASCADES_COLLECTION_META_ID;
}
