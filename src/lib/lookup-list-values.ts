import type { LookupPublic } from "@/types/lookup";

/** Wildcard token used in filters and SKU rows — not a duplicate list entry from lookups. */
export function isAllLookupOrFilterValue(value: string): boolean {
  return value.trim().toLowerCase() === "all";
}

/**
 * Distinct sorted `lookupvalue`s for a type, excluding "All".
 * UI dropdowns should render a single synthetic "All" (or blank) at the top.
 */
export function distinctLookupValues(
  lookups: LookupPublic[],
  lookuptype: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lookups) {
    if (l.lookuptype !== lookuptype) continue;
    const v = l.lookupvalue.trim();
    if (!v || isAllLookupOrFilterValue(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

/** Remove "All" from ad-hoc choice lists (e.g. data_objects–derived dropdowns). */
export function excludeAllFromChoices(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (t && isAllLookupOrFilterValue(t)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
