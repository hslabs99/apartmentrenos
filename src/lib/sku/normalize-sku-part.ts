/** Normalized string for SKU / cascade dimension matching. */
export function normalizeSkuPart(value: string): string {
  return value.trim().toLowerCase();
}

/** Elevate / cascade level matching — ignores spaces vs hyphens (e.g. Investor Plus = Investor-Plus). */
export function normalizeElevateLevel(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
