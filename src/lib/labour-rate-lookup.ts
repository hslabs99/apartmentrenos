import {
  LABOUR_RATE_CATEGORY,
  LABOUR_RATE_PRODUCT_TYPE,
  LABOUR_SILO_RATE_PRODUCT,
  type LabourSiloKey,
} from "@/lib/labour-silo";
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

export type ObjectLabourLookup = {
  row: DataObjectLabourRatePublic | null;
  duplicateMatch: boolean;
};

/**
 * Resolve object labour hours row for a project line.
 * Matches Product Type to the line object name; when Product is set on the labour row,
 * it must match the line SKU product (skuProduct). Wildcard Product rows apply otherwise.
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

  return { row: null, duplicateMatch: false };
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

export function labourSiloCostExcGst(
  hours: number | null,
  rate: DataLabourRatePublic | null,
): number | null {
  if (hours == null || rate == null) return null;
  if (normKey(rate.uom) !== "hour") return null;
  return Math.round(hours * rate.priceExcGst * 100) / 100;
}
