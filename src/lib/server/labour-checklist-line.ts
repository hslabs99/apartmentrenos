import type { DocumentData } from "firebase-admin/firestore";
import { contractLabourRateByProduct } from "@/lib/labour-rate-lookup";
import { LABOUR_RATE_CATEGORY } from "@/lib/labour-silo";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

export function isLabourQuoteObjectData(data: DocumentData | undefined): boolean {
  const category = String(data?.category ?? "").trim();
  return (
    category.localeCompare(LABOUR_RATE_CATEGORY, undefined, { sensitivity: "base" }) === 0
  );
}

export type LabourLineCatalogFields = {
  skuId: null;
  skuProduct: string | null;
  customumprice: number | null;
  customuom: string | null;
};

/** Labour checklist lines use product name + contract rate; no catalog SKU. */
export function labourLineCatalogFields(
  quoteData: DocumentData | undefined,
  contractRates: DataLabourRatePublic[],
  options?: { scopeNoCharge?: boolean },
): LabourLineCatalogFields | null {
  if (!isLabourQuoteObjectData(quoteData)) return null;
  const product = String(quoteData?.objectname ?? "").trim();
  if (!product) {
    return { skuId: null, skuProduct: null, customumprice: null, customuom: null };
  }
  if (options?.scopeNoCharge) {
    return { skuId: null, skuProduct: product, customumprice: 0, customuom: null };
  }
  const rate = contractLabourRateByProduct(contractRates, product);
  return {
    skuId: null,
    skuProduct: product,
    customumprice: rate?.priceExcGst ?? null,
    customuom: rate ? mapSkuUomToQuoteUom(rate.uom) : null,
  };
}
