import {
  LABOUR_RATE_CATEGORY,
  LABOUR_RATE_PRODUCT_TYPE,
  LABOUR_SILO_RATE_PRODUCT,
  type LabourSiloKey,
} from "@/lib/labour-silo";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

export type ObjectLabourLookup = {
  row: DataObjectLabourRatePublic | null;
  duplicateMatch: boolean;
};

export function findObjectLabourRateByObjectName(
  rows: DataObjectLabourRatePublic[],
  objectName: string,
): ObjectLabourLookup {
  const key = normKey(objectName);
  if (!key) return { row: null, duplicateMatch: false };
  const matches = rows.filter((r) => normKey(r.productType) === key);
  if (matches.length === 0) return { row: null, duplicateMatch: false };
  return { row: matches[0]!, duplicateMatch: matches.length > 1 };
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
