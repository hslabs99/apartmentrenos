import { isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";

/** Minimal row shape for building a colour expansion index. */
export type ColourLookupRow = {
  colourClass: string;
  descriptor: string;
};

/** Index of concrete colour descriptors grouped by first letter of colourClass. */
export type ColourLookupIndex = {
  /** Lowercase class initial → normalized descriptor tokens. */
  byClassInitial: ReadonlyMap<string, ReadonlySet<string>>;
  /** Lowercase class initial → sorted display labels (for diagnostics). */
  displayByClassInitial: ReadonlyMap<string, readonly string[]>;
};

const ALL_CLASS_TOKEN_RE = /^all-([a-z])$/i;

/** Comma/semicolon-separated colour list on a SKU row or filter. */
export function splitSkuColourListTokens(value: string): string[] {
  if (!value.trim()) return [];
  if (!/[;,]/.test(value)) return [value.trim()];
  return value
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** `All-M`, `All-H`, etc. — X is the first letter of a colour class. */
export function isAllClassColourToken(token: string): boolean {
  return ALL_CLASS_TOKEN_RE.test(token.trim());
}

/** Meta descriptors from Lists (not concrete product colours). */
export function isMetaColourDescriptor(descriptor: string): boolean {
  const t = descriptor.trim();
  if (!t) return true;
  if (isAllLookupOrFilterValue(t)) return true;
  return isAllClassColourToken(t);
}

export function buildColourLookupIndex(rows: ColourLookupRow[]): ColourLookupIndex {
  const byClassInitial = new Map<string, Set<string>>();
  const displayByClassInitial = new Map<string, Map<string, string>>();

  for (const row of rows) {
    const descriptor = row.descriptor.trim();
    const colourClass = row.colourClass.trim();
    if (!descriptor || isMetaColourDescriptor(descriptor)) continue;
    if (!colourClass || colourClass.toLowerCase() === "all") continue;

    const initial = colourClass[0]!.toLowerCase();
    const norm = normalizeSkuPart(descriptor);

    let normSet = byClassInitial.get(initial);
    if (!normSet) {
      normSet = new Set();
      byClassInitial.set(initial, normSet);
    }
    normSet.add(norm);

    let labelMap = displayByClassInitial.get(initial);
    if (!labelMap) {
      labelMap = new Map();
      displayByClassInitial.set(initial, labelMap);
    }
    if (!labelMap.has(norm)) labelMap.set(norm, descriptor);
  }

  const frozenByInitial = new Map<string, ReadonlySet<string>>();
  const frozenDisplay = new Map<string, readonly string[]>();
  for (const [initial, normSet] of byClassInitial) {
    frozenByInitial.set(initial, normSet);
    const labelMap = displayByClassInitial.get(initial)!;
    const labels = [...normSet]
      .map((n) => labelMap.get(n) ?? n)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    frozenDisplay.set(initial, labels);
  }

  return { byClassInitial: frozenByInitial, displayByClassInitial: frozenDisplay };
}

export type ExpandedColourTokens = {
  /** Plain `All` wildcard — matches any filter colour. */
  wildcard: boolean;
  /** Normalized concrete descriptor tokens after expansion. */
  normalized: ReadonlySet<string>;
  /** Human-readable labels for diagnostics. */
  displayLabels: readonly string[];
};

function mergeExpanded(
  acc: { wildcard: boolean; normalized: Set<string>; displayLabels: string[] },
  part: ExpandedColourTokens,
): void {
  if (part.wildcard) {
    acc.wildcard = true;
    return;
  }
  for (const n of part.normalized) acc.normalized.add(n);
  for (const label of part.displayLabels) {
    if (!acc.displayLabels.includes(label)) acc.displayLabels.push(label);
  }
}

function expandSingleColourToken(
  token: string,
  index: ColourLookupIndex,
): ExpandedColourTokens {
  const trimmed = token.trim();
  if (!trimmed) {
    return { wildcard: false, normalized: new Set(), displayLabels: [] };
  }
  if (isAllLookupOrFilterValue(trimmed)) {
    return { wildcard: true, normalized: new Set(), displayLabels: [] };
  }

  const classMatch = trimmed.match(ALL_CLASS_TOKEN_RE);
  if (classMatch) {
    const initial = classMatch[1]!.toLowerCase();
    const norms = index.byClassInitial.get(initial);
    if (norms && norms.size > 0) {
      const displayLabels = index.displayByClassInitial.get(initial) ?? [];
      return { wildcard: false, normalized: new Set(norms), displayLabels: [...displayLabels] };
    }
  }

  const norm = normalizeSkuPart(trimmed);
  return { wildcard: false, normalized: new Set([norm]), displayLabels: [trimmed] };
}

/**
 * Expand a colour field value (possibly comma-separated) into concrete descriptors.
 * `All` → wildcard; `All-M` / `All-H` → all descriptors for that class initial.
 */
export function expandColourFieldTokens(
  value: string,
  index: ColourLookupIndex | null | undefined,
): ExpandedColourTokens {
  const tokens = splitSkuColourListTokens(value);
  if (tokens.length === 0) {
    return { wildcard: false, normalized: new Set(), displayLabels: [] };
  }

  if (!index) {
    const normalized = new Set(tokens.map((t) => normalizeSkuPart(t)));
    return { wildcard: false, normalized, displayLabels: tokens };
  }

  const acc = {
    wildcard: false,
    normalized: new Set<string>(),
    displayLabels: [] as string[],
  };
  for (const token of tokens) {
    mergeExpanded(acc, expandSingleColourToken(token, index));
    if (acc.wildcard) break;
  }

  acc.displayLabels.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return {
    wildcard: acc.wildcard,
    normalized: acc.normalized,
    displayLabels: acc.displayLabels,
  };
}

/**
 * OR match: any expanded SKU token intersects any expanded filter token.
 * Plain `All` on either side is a wildcard (handled before this in the filter pipeline).
 */
export function colourFieldTokensMatch(
  skuColourOptions: string,
  filterColour: string,
  index: ColourLookupIndex | null | undefined,
): boolean {
  const skuExpanded = expandColourFieldTokens(skuColourOptions, index);
  if (skuExpanded.wildcard) return true;

  const filterExpanded = expandColourFieldTokens(filterColour, index);
  if (filterExpanded.wildcard) return true;

  for (const s of skuExpanded.normalized) {
    if (filterExpanded.normalized.has(s)) return true;
  }
  return false;
}

/** Diagnostic label, e.g. `"All-H" → [BN-H, BB-H, GM-H]`. */
export function formatExpandedColourField(
  rawValue: string,
  index: ColourLookupIndex | null | undefined,
): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "(blank)";
  const expanded = expandColourFieldTokens(trimmed, index);
  if (expanded.wildcard) return `"${trimmed}" (wildcard All)`;
  if (expanded.displayLabels.length === 0) return `"${trimmed}"`;
  const single =
    expanded.displayLabels.length === 1 &&
    normalizeSkuPart(trimmed) === normalizeSkuPart(expanded.displayLabels[0]!);
  if (single) return `"${trimmed}"`;
  return `"${trimmed}" → [${expanded.displayLabels.join(", ")}]`;
}
