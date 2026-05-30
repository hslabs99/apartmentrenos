/** Stable Firestore doc id segment from tab / type name. */
export function blindsTypeSlug(typeName: string): string {
  const slug = typeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "unknown_type";
}

export function blindsPriceDocId(typeName: string, dropMm: number): string {
  return `${blindsTypeSlug(typeName)}_${dropMm}`;
}

/** Deterministic `quote_objects` doc id — at most one per blind type. */
export function blindsQuoteObjectDocId(typeName: string): string {
  return `blinds_${blindsTypeSlug(typeName)}`;
}
