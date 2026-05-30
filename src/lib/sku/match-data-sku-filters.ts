import { isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";

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

export function skuFieldMatchesFilter(skuValue: string, filterChoice: string): boolean {
  if (!filterChoice.trim()) return true;
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
  return normalizeSkuPart(v) === normalizeSkuPart(choiceToRaw(filterChoice));
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
 */
export function filterDataSkusWithCascadeFallback<T extends DataSkuMatchable>(
  skus: T[],
  filters: DataSkuFilterFields,
): T[] {
  let pool = skusMatchingBaseFilters(skus, filters);
  pool = narrowSkusByDimensionWithAllFallback(pool, "elevateLevel", filters.elevateLevel);
  pool = narrowSkusByDimensionWithAllFallback(pool, "style", filters.style);
  pool = narrowSkusByDimensionWithAllFallback(pool, "colour", filters.colour);
  return pool;
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
    if (!skuFieldMatchesFilter(sku.elevateLevel, filters.elevateLevel)) return false;
  }
  if (!isOpenFilter(filters.style)) {
    if (!skuFieldMatchesFilter(sku.style, filters.style)) return false;
  }
  if (!isOpenFilter(filters.colour)) {
    if (!skuFieldMatchesFilter(sku.colourOptions, filters.colour)) return false;
  }
  return true;
}
