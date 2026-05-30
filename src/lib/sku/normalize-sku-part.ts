/** Normalized string for SKU / cascade dimension matching. */
export function normalizeSkuPart(value: string): string {
  return value.trim().toLowerCase();
}
