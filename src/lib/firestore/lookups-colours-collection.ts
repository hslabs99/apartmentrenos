export const LOOKUPS_COLOURS_COLLECTION = "lookups_colours";

export const LOOKUPS_COLOURS_COLLECTION_META_ID = "_collection_meta";

export function isLookupsColoursMetaDocument(docId: string): boolean {
  return docId === LOOKUPS_COLOURS_COLLECTION_META_ID;
}
