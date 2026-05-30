import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";

export type CascadeRow = {
  level: string;
  style: string;
  colour: string;
};

function normLevel(level: string): string {
  return normalizeSkuPart(level);
}

/** Distinct cascade levels (sorted). */
export function distinctCascadeLevels(rows: CascadeRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const v = r.level.trim();
    if (!v || seen.has(normLevel(v))) continue;
    seen.add(normLevel(v));
    out.push(v);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

/** Styles valid for a cascade level (empty level → all styles in sheet). */
export function cascadeStylesForLevel(rows: CascadeRow[], level: string): string[] {
  const levelNorm = normLevel(level);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (levelNorm && normLevel(r.level) !== levelNorm) continue;
    const v = r.style.trim();
    if (!v || seen.has(normalizeSkuPart(v))) continue;
    seen.add(normalizeSkuPart(v));
    out.push(v);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

/** Colours valid for level + style (both required for a restricted list). */
export function cascadeColoursForLevelStyle(
  rows: CascadeRow[],
  level: string,
  style: string,
): string[] {
  const levelNorm = normLevel(level);
  const styleNorm = normalizeSkuPart(style);
  if (!levelNorm || !styleNorm) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (normLevel(r.level) !== levelNorm) continue;
    if (normalizeSkuPart(r.style) !== styleNorm) continue;
    const v = r.colour.trim();
    if (!v || seen.has(normalizeSkuPart(v))) continue;
    seen.add(normalizeSkuPart(v));
    out.push(v);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

/** When saved colour is no longer valid, keep it visible once in the list. */
export function withSavedChoice(options: string[], saved: string): string[] {
  const t = saved.trim();
  if (!t) return options;
  if (options.some((o) => normalizeSkuPart(o) === normalizeSkuPart(t))) return options;
  return [...options, `${t} (saved)`];
}
