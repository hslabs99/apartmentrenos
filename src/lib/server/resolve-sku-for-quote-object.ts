import type { DocumentData, Firestore } from "firebase-admin/firestore";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";
import {
  LABOUR_PREPARE_OBJECT_PRODUCT_TYPE,
  LABOUR_RATE_CATEGORY,
} from "@/lib/labour-silo";
import {
  filterDataSkusWithCascadeFallback,
  type DataSkuFilterFields,
} from "@/lib/sku/match-data-sku-filters";
import { loadColourLookupIndex } from "@/lib/server/load-colour-lookup-index";
import {
  collectShowAllIdentities,
  matchShowAllCatalogSkus,
  type ShowAllSkuHint,
} from "@/lib/sku/show-all-scope-skus";

export type ResolvedSkuForQuoteObject = {
  skuId: string;
  product: string;
  uom: string;
} | null;

type SkuRow = {
  skuId: string;
  category: string;
  productType: string;
  product: string;
  elevateLevel: string;
  style: string;
  colourOptions: string;
  uom: string;
  isCurrent: boolean;
};

let skuCache: SkuRow[] | null = null;

async function loadCurrentSkus(db: Firestore): Promise<SkuRow[]> {
  if (skuCache) return skuCache;
  const snap = await db.collection(DATA_SKUS_COLLECTION).get();
  const rows: SkuRow[] = [];
  for (const doc of snap.docs) {
    if (isDataSkusMetaDocument(doc.id)) continue;
    const data = doc.data() as DocumentData;
    if (data.isCurrent === false) continue;
    const skuId = String(data.skuId ?? "").trim();
    if (!skuId) continue;
    rows.push({
      skuId,
      category: String(data.category ?? ""),
      productType: String(data.productType ?? ""),
      product: String(data.product ?? ""),
      elevateLevel: String(data.elevateLevel ?? ""),
      style: String(data.style ?? ""),
      colourOptions: String(data.colourOptions ?? ""),
      uom: String(data.uom ?? ""),
      isCurrent: data.isCurrent !== false,
    });
  }
  skuCache = rows;
  return rows;
}

/** Clear in-process SKU cache (tests / after import). */
export function clearDataSkusResolveCache(): void {
  skuCache = null;
}

/** Catalog UOM for a SKU id (empty when missing). Uses the same cache as SKU resolve. */
export async function loadSkuUomBySkuId(
  db: Firestore,
  skuId: string | null | undefined,
): Promise<string> {
  const id = String(skuId ?? "").trim();
  if (!id) return "";
  const skus = await loadCurrentSkus(db);
  const hit = skus.find((s) => s.skuId === id);
  return hit?.uom.trim() ?? "";
}

/**
 * One SKU per quote object line: category + productType (objectname) + elevate + style + colour.
 * Product on the SKU row is not filtered (any product value may match).
 */
export async function resolveSkuForQuoteObject(
  db: Firestore,
  quoteObjectData: DocumentData | undefined,
  filters: Omit<DataSkuFilterFields, "category" | "productType">,
): Promise<ResolvedSkuForQuoteObject> {
  const matches = await matchingSkusForQuoteObjectData(db, quoteObjectData, filters);
  if (matches.length !== 1) return null;
  const hit = matches[0]!;
  return {
    skuId: hit.skuId,
    product: hit.product.trim(),
    uom: hit.uom.trim(),
  };
}

/** All current SKUs matching a quote object and project filters (Show All expansion). */
export async function resolveAllSkusForQuoteObject(
  db: Firestore,
  quoteObjectData: DocumentData | undefined,
  filters: Omit<DataSkuFilterFields, "category" | "productType">,
): Promise<{ skuId: string; product: string; uom: string }[]> {
  const matches = await matchingSkusForQuoteObjectData(db, quoteObjectData, filters);
  return matches.map((hit) => ({
    skuId: hit.skuId,
    product: hit.product.trim(),
    uom: hit.uom.trim(),
  }));
}

/**
 * Show All expansion: Elevate + Style (colour optional), unioning quote-object identity
 * with categories/types from SKUs already on the object.
 */
export async function resolveShowAllSkusForQuoteObject(
  db: Firestore,
  quoteObjectData: DocumentData | undefined,
  filters: Omit<DataSkuFilterFields, "category" | "productType">,
  extra?: {
    lineObjectNames?: string[];
    skuHints?: ShowAllSkuHint[];
    existingSkuIds?: string[];
  },
): Promise<{ skuId: string; product: string; uom: string }[]> {
  const skus = await loadCurrentSkus(db);
  const hints = [...(extra?.skuHints ?? [])];
  if (extra?.existingSkuIds?.length) {
    const want = new Set(extra.existingSkuIds.map((id) => id.trim()).filter(Boolean));
    for (const sku of skus) {
      if (!want.has(sku.skuId)) continue;
      hints.push({ category: sku.category, productType: sku.productType });
    }
  }
  const category = String(quoteObjectData?.category ?? "").trim();
  const objectname = String(quoteObjectData?.objectname ?? "").trim();
  const identities = collectShowAllIdentities({
    quoteCategory: category,
    quoteObjectName: objectname,
    lineObjectNames: extra?.lineObjectNames,
    skuRows: hints,
  });
  if (identities.length === 0) return [];

  const colourLookupIndex = await loadColourLookupIndex(db);
  const matches = matchShowAllCatalogSkus(skus, identities, filters, colourLookupIndex);
  return matches.map((hit) => ({
    skuId: hit.skuId,
    product: hit.product.trim(),
    uom: hit.uom.trim(),
  }));
}

async function matchingSkusForQuoteObjectData(
  db: Firestore,
  quoteObjectData: DocumentData | undefined,
  filters: Omit<DataSkuFilterFields, "category" | "productType" | "product">,
): Promise<SkuRow[]> {
  const category = String(quoteObjectData?.category ?? "").trim();
  const objectname = String(quoteObjectData?.objectname ?? "").trim();
  if (!category || !objectname) return [];

  const isLabourObject =
    category.localeCompare(LABOUR_RATE_CATEGORY, undefined, { sensitivity: "base" }) === 0;
  const fullFilters: DataSkuFilterFields = isLabourObject
    ? {
        category,
        productType: LABOUR_PREPARE_OBJECT_PRODUCT_TYPE,
        product: objectname,
        elevateLevel: filters.elevateLevel,
        style: filters.style,
        colour: filters.colour,
      }
    : {
        category,
        productType: objectname,
        elevateLevel: filters.elevateLevel,
        style: filters.style,
        colour: filters.colour,
      };

  const skus = await loadCurrentSkus(db);
  const colourLookupIndex = await loadColourLookupIndex(db);
  const matches = filterDataSkusWithCascadeFallback(skus, fullFilters, {
    includeAllDimensionSkuRows: true,
    colourLookupIndex,
  });
  matches.sort((a, b) => a.skuId.localeCompare(b.skuId));
  return matches;
}
