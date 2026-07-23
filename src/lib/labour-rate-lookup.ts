import {
  LABOUR_RATE_CATEGORY,
  LABOUR_RATE_PRODUCT_TYPE,
  LABOUR_SILO_RATE_PRODUCT,
  LOOKUP_LABOUR_SILO_KEYS,
  type LabourSiloKey,
} from "@/lib/labour-silo";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import { isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Empty, All, or em-dash — Product applies to any SKU for that Product Type. */
export function isObjectLabourProductWildcard(product: string): boolean {
  const t = product.trim();
  if (!t) return true;
  if (isAllLookupOrFilterValue(t)) return true;
  if (t === "—" || t === "-" || t === "–") return true;
  return false;
}

type ObjectLabourLookupLine = {
  linesource?: string | null;
  skuId?: string | null;
  skuProduct?: string | null;
};

/**
 * SKU product name used to narrow object labour rows (Product column).
 * Manual / manual2 lines store free-text product — lookup uses Product Type (object) only,
 * same as a standard object row without a catalog SKU link.
 */
export function skuProductForObjectLabourLookup(line: ObjectLabourLookupLine): string | null {
  if (line.skuId?.trim()) return line.skuProduct?.trim() || null;
  const src = line.linesource?.trim();
  if (src === "manual" || src === "manual2") return null;
  return line.skuProduct?.trim() || null;
}

export type ObjectLabourLookup = {
  row: DataObjectLabourRatePublic | null;
  duplicateMatch: boolean;
};

/**
 * Resolve object labour hours row for a project line.
 * Rule (product type = object Description / objectname):
 * 1. Product Type match + Product = line SKU product → use that row
 * 2. Else Product Type match + blank/All/— Product → use that row
 * 3. Else any Product Type match (type-level fallback)
 */
export function findObjectLabourRateByObjectName(
  rows: DataObjectLabourRatePublic[],
  objectName: string,
  skuProduct?: string | null,
): ObjectLabourLookup {
  const typeKey = normKey(objectName);
  if (!typeKey) return { row: null, duplicateMatch: false };

  const byType = rows.filter((r) => normKey(r.productType) === typeKey);
  if (byType.length === 0) return { row: null, duplicateMatch: false };

  const skuKey = normKey(skuProduct ?? "");
  const specific = byType.filter((r) => !isObjectLabourProductWildcard(r.product));
  const wildcards = byType.filter((r) => isObjectLabourProductWildcard(r.product));

  const skuMatches = skuKey
    ? specific.filter((r) => normKey(r.product) === skuKey)
    : [];

  if (skuMatches.length === 1) {
    return { row: skuMatches[0]!, duplicateMatch: false };
  }
  if (skuMatches.length > 1) {
    return { row: skuMatches[0]!, duplicateMatch: true };
  }

  if (wildcards.length === 1) {
    return { row: wildcards[0]!, duplicateMatch: false };
  }
  if (wildcards.length > 1) {
    return { row: wildcards[0]!, duplicateMatch: true };
  }

  // No SKU-specific or wildcard row — use type-level labour (any Product under this type).
  if (byType.length === 1) {
    return { row: byType[0]!, duplicateMatch: false };
  }
  return { row: byType[0]!, duplicateMatch: true };
}

export function contractLabourRateBySiloProduct(
  rates: DataLabourRatePublic[],
  siloKey: LabourSiloKey,
): DataLabourRatePublic | null {
  const product = LABOUR_SILO_RATE_PRODUCT[siloKey];
  const matches = rates.filter(
    (r) =>
      normKey(r.product) === normKey(product) &&
      normKey(r.category) === normKey(LABOUR_RATE_CATEGORY) &&
      normKey(r.productType) === normKey(LABOUR_RATE_PRODUCT_TYPE),
  );
  return matches[0] ?? null;
}

/** Checklist labour scope line: unit price from `data_labourrates.product`. */
export function contractLabourRateByProduct(
  rates: DataLabourRatePublic[],
  product: string,
): DataLabourRatePublic | null {
  const productKey = normKey(product);
  if (!productKey) return null;
  const matches = rates.filter(
    (r) =>
      normKey(r.product) === productKey &&
      normKey(r.category) === normKey(LABOUR_RATE_CATEGORY),
  );
  return matches[0] ?? null;
}

export function labourSiloCostExcGst(
  hours: number | null,
  rate: DataLabourRatePublic | null,
): number | null {
  if (hours == null || rate == null) return null;
  if (normKey(rate.uom) !== "hour") return null;
  return Math.round(hours * rate.priceExcGst * 100) / 100;
}

/** Sum of workbench lookup-silo labour costs for one included line (exc GST). */
export function lineLabourCostExcGst(
  row: ProjectAreaObjectPublic,
  contractRates: DataLabourRatePublic[],
): number {
  if (row.included === false) return 0;
  let total = 0;
  for (const key of LOOKUP_LABOUR_SILO_KEYS) {
    const hours = row[key];
    const rate = contractLabourRateBySiloProduct(contractRates, key);
    const cost = labourSiloCostExcGst(
      typeof hours === "number" && Number.isFinite(hours) && hours > 0 ? hours : null,
      rate,
    );
    if (cost != null) total += cost;
  }
  return Math.round(total * 100) / 100;
}
