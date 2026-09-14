import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import {
  filterDataSkusWithCascadeFallback,
  type DataSkuMatchable,
} from "@/lib/sku/match-data-sku-filters";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";

export type ShowAllIdentity = {
  category: string;
  productType: string;
};

export type ShowAllSkuHint = {
  category: string;
  productType: string;
};

/**
 * Show All target identities: every known category × the quote object name (product type),
 * plus each existing SKU’s exact category/type so leftover rows still count as expected.
 *
 * Cabinets often live on SKU category Joinery while the quote object is Kitchen — matching
 * only Kitchen + Cabinets misses the rest of the Elevate/Style set.
 */
export function collectShowAllIdentities(args: {
  quoteCategory?: string;
  quoteObjectName?: string;
  lineObjectNames?: string[];
  skuRows?: ShowAllSkuHint[];
}): ShowAllIdentity[] {
  const categories = new Set<string>();
  const showAllTypes = new Set<string>();
  const add = (raw: string | undefined, into: Set<string>) => {
    const t = raw?.trim() ?? "";
    if (!t) return;
    into.add(t);
  };
  add(args.quoteCategory, categories);
  add(args.quoteObjectName, showAllTypes);
  for (const name of args.lineObjectNames ?? []) add(name, showAllTypes);
  for (const sku of args.skuRows ?? []) add(sku.category, categories);

  const seen = new Set<string>();
  const out: ShowAllIdentity[] = [];
  const push = (category: string, productType: string) => {
    const c = category.trim();
    const t = productType.trim();
    if (!c || !t) return;
    const key = `${normalizeSkuPart(c)}|${normalizeSkuPart(t)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ category: c, productType: t });
  };

  for (const category of categories) {
    for (const productType of showAllTypes) {
      push(category, productType);
    }
  }
  for (const sku of args.skuRows ?? []) {
    push(sku.category, sku.productType);
  }
  return out;
}

function skuIdOf(sku: DataSkuMatchable & { skuId?: string }): string {
  return String(sku.skuId ?? "").trim();
}

function productKey(sku: DataSkuMatchable & { skuId?: string }): string {
  const product = sku.product?.trim() ?? "";
  if (product) return normalizeSkuPart(product);
  return skuIdOf(sku).toLowerCase();
}

function isCurrentSku(sku: DataSkuMatchable & { isCurrent?: boolean }): boolean {
  return sku.isCurrent !== false;
}

function skuMatchesAreaColour<T extends DataSkuMatchable>(
  sku: T,
  colour: string,
  colourLookupIndex: ColourLookupIndex | null,
): boolean {
  if (!colour.trim()) return true;
  return (
    filterDataSkusWithCascadeFallback(
      [sku],
      {
        category: sku.category,
        productType: sku.productType,
        elevateLevel: "",
        style: "",
        colour,
      },
      { colourLookupIndex },
    ).length > 0
  );
}

/** One Show All line per catalog product; prefer the SKU that matches area colour. */
export function collapseShowAllSkusToOnePerProduct<T extends DataSkuMatchable & { skuId?: string }>(
  skus: T[],
  colour: string,
  colourLookupIndex: ColourLookupIndex | null,
): T[] {
  const groups = new Map<string, T[]>();
  for (const sku of skus) {
    const id = skuIdOf(sku);
    if (!id) continue;
    const key = productKey(sku);
    const list = groups.get(key) ?? [];
    list.push(sku);
    groups.set(key, list);
  }
  const out: T[] = [];
  for (const group of groups.values()) {
    const colourHits = group.filter((s) => skuMatchesAreaColour(s, colour, colourLookupIndex));
    const pick = colourHits[0] ?? group[0];
    if (pick) out.push(pick);
  }
  out.sort((a, b) =>
    (a.product || skuIdOf(a)).localeCompare(b.product || skuIdOf(b), undefined, {
      sensitivity: "base",
    }),
  );
  return out;
}

/**
 * Catalog SKUs a Show All object should present: Elevate + Style, colour optional.
 * Identities are tried with area colour and with colour open, then collapsed to one row per product.
 */
export function matchShowAllCatalogSkus<T extends DataSkuMatchable & { skuId?: string; isCurrent?: boolean }>(
  catalog: T[],
  identities: ShowAllIdentity[],
  filters: { elevateLevel: string; style: string; colour: string },
  colourLookupIndex: ColourLookupIndex | null,
): T[] {
  const currentOnly = catalog.filter(isCurrentSku);
  const filterSets = [filters, { ...filters, colour: "" }];
  const seen = new Set<string>();
  const matches: T[] = [];
  for (const identity of identities) {
    if (!identity.productType.trim()) continue;
    for (const f of filterSets) {
      const rows = filterDataSkusWithCascadeFallback(
        currentOnly,
        {
          category: identity.category,
          productType: identity.productType,
          elevateLevel: f.elevateLevel,
          style: f.style,
          colour: f.colour,
        },
        { includeAllDimensionSkuRows: true, colourLookupIndex },
      );
      for (const sku of rows) {
        const id = skuIdOf(sku);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        matches.push(sku);
      }
    }
  }
  return collapseShowAllSkusToOnePerProduct(matches, filters.colour, colourLookupIndex);
}
