import { isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import { normalizeElevateLevel, normalizeSkuPart } from "@/lib/sku/normalize-sku-part";

export type DataSkuFilterFields = {
  category: string;
  productType: string;
  /** Empty = match any product on the SKU row. */
  product?: string;
  elevateLevel: string;
  style: string;
  colour: string;
};

export type DataSkuMatchable = {
  category: string;
  productType: string;
  product: string;
  elevateLevel: string;
  style: string;
  colourOptions: string;
};

export type DataSkuFilterOptions = {
  /**
   * Picker lists: also include SKUs with `All` on any tier/style/colour column that still
   * match filters in parallel — even when cascade narrowing already found exact-tier rows.
   */
  includeAllDimensionSkuRows?: boolean;
};

function dataSkuRowKey(sku: DataSkuMatchable): string {
  return [
    normalizeSkuPart(sku.category),
    normalizeSkuPart(sku.productType),
    normalizeSkuPart(sku.product),
    normalizeSkuPart(sku.elevateLevel),
    normalizeSkuPart(sku.style),
    normalizeSkuPart(sku.colourOptions),
  ].join("|");
}

function skuHasAnyAllDimensionValue(sku: DataSkuMatchable): boolean {
  return (
    skuHasAllDimensionValue(sku, "elevateLevel") ||
    skuHasAllDimensionValue(sku, "style") ||
    skuHasAllDimensionValue(sku, "colour")
  );
}

function choiceToRaw(choice: string): string {
  return choice === "(blank)" ? "" : choice.trim();
}

function isOpenFilter(choice: string): boolean {
  const t = choice.trim();
  return t === "" || t === "All";
}

function skuFieldIsAll(value: string): boolean {
  return isAllLookupOrFilterValue(value);
}

/** Comma/semicolon-separated tier, style, or colour list on a SKU row. */
function splitDimensionListTokens(value: string): string[] {
  if (!value.trim()) return [];
  if (!/[;,]/.test(value)) return [value.trim()];
  return value
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizedFilterChoice(
  dimension: "elevateLevel" | "style" | "colour",
  filterChoice: string,
): string {
  return normalizeDimensionPart(dimension, choiceToRaw(filterChoice));
}

/** SKU row value matches filter: `All`, exact token, or listed option (e.g. colour `BN, BB`). */
function skuDimensionIncludesFilterChoice(
  dimension: "elevateLevel" | "style" | "colour",
  skuValue: string,
  filterChoice: string,
): boolean {
  if (!filterChoice.trim()) return true;
  if (skuFieldIsAll(skuValue)) return true;
  const choiceNorm = normalizedFilterChoice(dimension, filterChoice);
  const tokens = splitDimensionListTokens(skuValue);
  if (tokens.length <= 1) {
    return normalizeDimensionPart(dimension, skuValue) === choiceNorm;
  }
  return tokens.some((t) => normalizeDimensionPart(dimension, t) === choiceNorm);
}

export function normalizeDimensionPart(
  dimension: "elevateLevel" | "style" | "colour",
  value: string,
): string {
  if (dimension === "elevateLevel") return normalizeElevateLevel(value);
  return normalizeSkuPart(value);
}

function skuFieldMatchesFilter(
  skuValue: string,
  filterChoice: string,
  dimension?: "elevateLevel" | "style" | "colour",
): boolean {
  if (!filterChoice.trim()) return true;
  if (dimension) {
    return skuDimensionIncludesFilterChoice(dimension, skuValue, filterChoice);
  }
  if (skuFieldIsAll(skuValue)) return true;
  return normalizeSkuPart(skuValue) === normalizeSkuPart(choiceToRaw(filterChoice));
}

function skuDimensionValue(
  sku: DataSkuMatchable,
  dimension: "elevateLevel" | "style" | "colour",
): string {
  switch (dimension) {
    case "elevateLevel":
      return sku.elevateLevel;
    case "style":
      return sku.style;
    case "colour":
      return sku.colourOptions;
  }
}

/** Exact match on a dimension (SKU value is not `All`). */
function skuHasExactDimensionMatch(sku: DataSkuMatchable, dimension: "elevateLevel" | "style" | "colour", filterChoice: string): boolean {
  const v = skuDimensionValue(sku, dimension);
  if (skuFieldIsAll(v)) return false;
  return skuDimensionIncludesFilterChoice(dimension, v, filterChoice);
}

function skuHasAllDimensionValue(sku: DataSkuMatchable, dimension: "elevateLevel" | "style" | "colour"): boolean {
  return skuFieldIsAll(skuDimensionValue(sku, dimension));
}

/**
 * Narrow a pool by one tier/style/colour choice: prefer SKUs that match exactly;
 * if none, keep SKUs whose row value is `All` for that dimension.
 */
export function narrowSkusByDimensionWithAllFallback<T extends DataSkuMatchable>(
  pool: T[],
  dimension: "elevateLevel" | "style" | "colour",
  filterChoice: string,
): T[] {
  if (isOpenFilter(filterChoice)) return pool;
  const direct = pool.filter((s) => skuHasExactDimensionMatch(s, dimension, filterChoice));
  if (direct.length > 0) return direct;
  return pool.filter((s) => skuHasAllDimensionValue(s, dimension));
}

function skusMatchingBaseFilters<T extends DataSkuMatchable>(skus: T[], filters: DataSkuFilterFields): T[] {
  return skus.filter((sku) => {
    if (!skuFieldMatchesFilter(sku.category, filters.category)) return false;
    if (!skuFieldMatchesFilter(sku.productType, filters.productType)) return false;
    if (filters.product?.trim()) {
      if (!skuFieldMatchesFilter(sku.product, filters.product)) return false;
    }
    return true;
  });
}

/**
 * Checklist / workbench SKU resolution: category + type (+ optional product), then
 * tier → style → colour. Each dimension uses an exact row match when present,
 * otherwise SKUs with `All` on that dimension.
 *
 * With `includeAllDimensionSkuRows`, also union any base-filter SKU that has `All` on at
 * least one tier/style/colour column and matches all active filters in parallel (picker UX).
 */
export function filterDataSkusWithCascadeFallback<T extends DataSkuMatchable>(
  skus: T[],
  filters: DataSkuFilterFields,
  options?: DataSkuFilterOptions,
): T[] {
  const base = skusMatchingBaseFilters(skus, filters);
  let cascadePool = base;
  cascadePool = narrowSkusByDimensionWithAllFallback(cascadePool, "elevateLevel", filters.elevateLevel);
  cascadePool = narrowSkusByDimensionWithAllFallback(cascadePool, "style", filters.style);
  cascadePool = narrowSkusByDimensionWithAllFallback(cascadePool, "colour", filters.colour);

  if (!options?.includeAllDimensionSkuRows) return cascadePool;

  const allDimensionRows = base.filter(
    (s) => skuHasAnyAllDimensionValue(s) && skuMatchesDataSkuFilters(s, filters),
  );

  const seen = new Set<string>();
  const merged: T[] = [];
  for (const row of [...cascadePool, ...allDimensionRows]) {
    const key = dataSkuRowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

/** @deprecated Prefer {@link filterDataSkusWithCascadeFallback} for tier/style/colour lists. */
export function skuMatchesDataSkuFilters(
  sku: DataSkuMatchable,
  filters: DataSkuFilterFields,
): boolean {
  if (!skuFieldMatchesFilter(sku.category, filters.category)) return false;
  if (!skuFieldMatchesFilter(sku.productType, filters.productType)) return false;
  if (filters.product?.trim()) {
    if (!skuFieldMatchesFilter(sku.product, filters.product)) return false;
  }
  if (!isOpenFilter(filters.elevateLevel)) {
    if (!skuFieldMatchesFilter(sku.elevateLevel, filters.elevateLevel, "elevateLevel")) {
      return false;
    }
  }
  if (!isOpenFilter(filters.style)) {
    if (!skuFieldMatchesFilter(sku.style, filters.style, "style")) return false;
  }
  if (!isOpenFilter(filters.colour)) {
    if (!skuFieldMatchesFilter(sku.colourOptions, filters.colour, "colour")) return false;
  }
  return true;
}
