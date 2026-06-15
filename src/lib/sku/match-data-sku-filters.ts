import { isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import {
  colourFieldTokensMatch,
  formatExpandedColourField,
  type ColourLookupIndex,
} from "@/lib/sku/colour-lookup-index";
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
  /** When set, `All-M` / `All-H` etc. expand via lookups_colours before colour matching. */
  colourLookupIndex?: ColourLookupIndex | null;
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
  colourLookupIndex?: ColourLookupIndex | null,
): boolean {
  if (!filterChoice.trim()) return true;
  if (skuFieldIsAll(skuValue)) return true;
  if (dimension === "colour" && colourLookupIndex) {
    return colourFieldTokensMatch(skuValue, filterChoice, colourLookupIndex);
  }
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
  colourLookupIndex?: ColourLookupIndex | null,
): boolean {
  if (!filterChoice.trim()) return true;
  if (dimension) {
    return skuDimensionIncludesFilterChoice(
      dimension,
      skuValue,
      filterChoice,
      colourLookupIndex,
    );
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
function skuHasExactDimensionMatch(
  sku: DataSkuMatchable,
  dimension: "elevateLevel" | "style" | "colour",
  filterChoice: string,
  colourLookupIndex?: ColourLookupIndex | null,
): boolean {
  const v = skuDimensionValue(sku, dimension);
  if (skuFieldIsAll(v)) return false;
  return skuDimensionIncludesFilterChoice(dimension, v, filterChoice, colourLookupIndex);
}

function skuHasAllDimensionValue(sku: DataSkuMatchable, dimension: "elevateLevel" | "style" | "colour"): boolean {
  return skuFieldIsAll(skuDimensionValue(sku, dimension));
}

/**
 * Narrow a pool by one tier/style/colour choice.
 * A SKU row matches when that column is `All` or when the value equals / lists the filter
 * (e.g. style `All` matches project style Manhattan; elevate `Investor-Plus, Executive`
 * matches filter `Executive`).
 */
export function narrowSkusByDimensionWithAllFallback<T extends DataSkuMatchable>(
  pool: T[],
  dimension: "elevateLevel" | "style" | "colour",
  filterChoice: string,
  colourLookupIndex?: ColourLookupIndex | null,
): T[] {
  if (isOpenFilter(filterChoice)) return pool;
  return pool.filter((s) => {
    const v = skuDimensionValue(s, dimension);
    if (skuFieldIsAll(v)) return true;
    return skuDimensionIncludesFilterChoice(dimension, v, filterChoice, colourLookupIndex);
  });
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

export type DataSkuFilterPipelineStep = {
  step: "catalog" | "base" | "elevateLevel" | "style" | "colour" | "includeAllMerge";
  label: string;
  filterValue: string;
  filterOpen: boolean;
  countIn: number;
  countOut: number;
  /** Up to 5 SKUs removed at this step (when countOut < countIn). */
  rejectedSamples: {
    skuId: string;
    field: string;
    skuValue: string;
    reason: string;
  }[];
};

function rejectionReasonForDimension(
  dimension: "elevateLevel" | "style" | "colour",
  skuValue: string,
  filterChoice: string,
  colourLookupIndex?: ColourLookupIndex | null,
): string {
  if (isOpenFilter(filterChoice)) return "filter open";
  if (skuFieldIsAll(skuValue)) return "unexpected — All should match";
  if (dimension === "colour" && colourLookupIndex) {
    const skuLabel = formatExpandedColourField(skuValue, colourLookupIndex);
    const filterLabel = formatExpandedColourField(filterChoice, colourLookupIndex);
    return `SKU ${skuLabel} does not overlap filter ${filterLabel}`;
  }
  const tokens = splitDimensionListTokens(skuValue);
  const choiceNorm = normalizedFilterChoice(dimension, filterChoice);
  if (tokens.length > 1) {
    return `listed values [${tokens.join(", ")}] do not include filter "${filterChoice}" (norm: ${choiceNorm})`;
  }
  return `value "${skuValue}" ≠ filter "${filterChoice}" (norm: ${normalizeDimensionPart(dimension, skuValue)} vs ${choiceNorm})`;
}

function pipelineRejections<T extends DataSkuMatchable & { skuId?: string }>(
  poolIn: T[],
  poolOut: T[],
  dimension: "elevateLevel" | "style" | "colour",
  filterChoice: string,
  colourLookupIndex?: ColourLookupIndex | null,
): DataSkuFilterPipelineStep["rejectedSamples"] {
  if (isOpenFilter(filterChoice) || poolOut.length >= poolIn.length) return [];
  const kept = new Set(poolOut);
  const out: DataSkuFilterPipelineStep["rejectedSamples"] = [];
  for (const sku of poolIn) {
    if (kept.has(sku)) continue;
    const field = dimension === "colour" ? "colourOptions" : dimension;
    const skuValue = skuDimensionValue(sku, dimension);
    out.push({
      skuId: String(sku.skuId ?? "").trim() || "—",
      field,
      skuValue: skuValue || "(blank)",
      reason: rejectionReasonForDimension(
        dimension,
        skuValue,
        filterChoice,
        colourLookupIndex,
      ),
    });
    if (out.length >= 5) break;
  }
  return out;
}

/** Step counts for SKU filter debugging (same pipeline as {@link filterDataSkusWithCascadeFallback}). */
export function dataSkuFilterPipeline<T extends DataSkuMatchable & { skuId?: string }>(
  skus: T[],
  filters: DataSkuFilterFields,
  options?: DataSkuFilterOptions,
): DataSkuFilterPipelineStep[] {
  const colourLookupIndex = options?.colourLookupIndex ?? null;
  const currentOnly = skus.filter((s) => (s as { isCurrent?: boolean }).isCurrent !== false);
  const base = skusMatchingBaseFilters(currentOnly, filters);
  const baseRejected: DataSkuFilterPipelineStep["rejectedSamples"] = [];
  if (base.length < currentOnly.length) {
    for (const sku of currentOnly) {
      if (base.includes(sku)) continue;
      if (!skuFieldMatchesFilter(sku.category, filters.category)) {
        baseRejected.push({
          skuId: String(sku.skuId ?? "").trim() || "—",
          field: "category",
          skuValue: sku.category || "(blank)",
          reason: `category "${sku.category}" ≠ "${filters.category}"`,
        });
      } else if (!skuFieldMatchesFilter(sku.productType, filters.productType)) {
        baseRejected.push({
          skuId: String(sku.skuId ?? "").trim() || "—",
          field: "productType",
          skuValue: sku.productType || "(blank)",
          reason: `productType "${sku.productType}" ≠ "${filters.productType}"`,
        });
      }
      if (baseRejected.length >= 5) break;
    }
  }

  let pool = base;
  const afterElevate = narrowSkusByDimensionWithAllFallback(pool, "elevateLevel", filters.elevateLevel);
  const elevateStep: DataSkuFilterPipelineStep = {
    step: "elevateLevel",
    label: "Elevate / tier",
    filterValue: filters.elevateLevel,
    filterOpen: isOpenFilter(filters.elevateLevel),
    countIn: pool.length,
    countOut: afterElevate.length,
    rejectedSamples: pipelineRejections(pool, afterElevate, "elevateLevel", filters.elevateLevel),
  };
  pool = afterElevate;

  const afterStyle = narrowSkusByDimensionWithAllFallback(pool, "style", filters.style);
  const styleStep: DataSkuFilterPipelineStep = {
    step: "style",
    label: "Style",
    filterValue: filters.style,
    filterOpen: isOpenFilter(filters.style),
    countIn: pool.length,
    countOut: afterStyle.length,
    rejectedSamples: pipelineRejections(pool, afterStyle, "style", filters.style),
  };
  pool = afterStyle;

  const colourFilterLabel =
    colourLookupIndex && filters.colour.trim()
      ? formatExpandedColourField(filters.colour, colourLookupIndex)
      : filters.colour;
  const afterColour = narrowSkusByDimensionWithAllFallback(
    pool,
    "colour",
    filters.colour,
    colourLookupIndex,
  );
  const colourStep: DataSkuFilterPipelineStep = {
    step: "colour",
    label: "Colour",
    filterValue: colourFilterLabel,
    filterOpen: isOpenFilter(filters.colour),
    countIn: pool.length,
    countOut: afterColour.length,
    rejectedSamples: pipelineRejections(
      pool,
      afterColour,
      "colour",
      filters.colour,
      colourLookupIndex,
    ),
  };
  pool = afterColour;

  const steps: DataSkuFilterPipelineStep[] = [
    {
      step: "catalog",
      label: "Catalog (isCurrent)",
      filterValue: "isCurrent !== false",
      filterOpen: false,
      countIn: skus.length,
      countOut: currentOnly.length,
      rejectedSamples: [],
    },
    {
      step: "base",
      label: "Category + product type",
      filterValue: `category="${filters.category}" productType="${filters.productType}"`,
      filterOpen: false,
      countIn: currentOnly.length,
      countOut: base.length,
      rejectedSamples: baseRejected,
    },
    elevateStep,
    styleStep,
    colourStep,
  ];

  if (options?.includeAllDimensionSkuRows) {
    const allDimensionRows = base.filter(
      (s) => skuHasAnyAllDimensionValue(s) && skuMatchesDataSkuFilters(s, filters),
    );
    const merged = filterDataSkusWithCascadeFallback(skus, filters, options);
    steps.push({
      step: "includeAllMerge",
      label: "Union All-dimension rows",
      filterValue: "includeAllDimensionSkuRows",
      filterOpen: false,
      countIn: pool.length + allDimensionRows.length,
      countOut: merged.length,
      rejectedSamples: [],
    });
    return steps;
  }

  return steps;
}

export function countSkusMatchingBaseProductKey(
  skus: DataSkuMatchable[],
  category: string,
  productType: string,
): number {
  if (!category.trim() || !productType.trim()) return 0;
  return skusMatchingBaseFilters(
    skus.filter((s) => (s as { isCurrent?: boolean }).isCurrent !== false),
    { category, productType, elevateLevel: "", style: "", colour: "" },
  ).length;
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
  const colourLookupIndex = options?.colourLookupIndex ?? null;
  const base = skusMatchingBaseFilters(skus, filters);
  let cascadePool = base;
  cascadePool = narrowSkusByDimensionWithAllFallback(cascadePool, "elevateLevel", filters.elevateLevel);
  cascadePool = narrowSkusByDimensionWithAllFallback(cascadePool, "style", filters.style);
  cascadePool = narrowSkusByDimensionWithAllFallback(
    cascadePool,
    "colour",
    filters.colour,
    colourLookupIndex,
  );

  if (!options?.includeAllDimensionSkuRows) return cascadePool;

  const allDimensionRows = base.filter(
    (s) =>
      skuHasAnyAllDimensionValue(s) &&
      skuMatchesDataSkuFilters(s, filters, colourLookupIndex),
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
  colourLookupIndex?: ColourLookupIndex | null,
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
    if (
      !skuFieldMatchesFilter(
        sku.colourOptions,
        filters.colour,
        "colour",
        colourLookupIndex,
      )
    ) {
      return false;
    }
  }
  return true;
}
