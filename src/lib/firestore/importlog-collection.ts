export const IMPORTLOG_COLLECTION = "importlog";

export const IMPORTLOG_COLLECTION_META_ID = "_collection_meta";

export function isImportlogMetaDocument(docId: string): boolean {
  return docId === IMPORTLOG_COLLECTION_META_ID;
}
