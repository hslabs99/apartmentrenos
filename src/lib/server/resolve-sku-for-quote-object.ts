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
