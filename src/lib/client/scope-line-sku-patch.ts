import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ScopeLineSkuPick } from "@/lib/client/scope-line-sku-match";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";

/** Line UOM from the selected catalog SKU; undefined when the SKU has none. */
export function customUomFromSkuPick(skuUom: string | null | undefined): string | undefined {
  const raw = String(skuUom ?? "").trim();
  if (!raw) return undefined;
  return mapSkuUomToQuoteUom(raw);
}

/** PATCH body when a scope line SKU (+ supplier priority) is chosen. */
export function patchBodyForScopeLineSku(
  line: ProjectAreaObjectPublic,
  selection: Pick<
    ScopeLineSkuPick,
    "skuId" | "product" | "supplierOption" | "priceExcGst" | "uom"
  >,
  /** Checklist inherit / scope metric measure when `custommeasure` is stored null. */
  measureForPricing?: number | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    skuId: selection.skuId,
    skuProduct: selection.product,
    supplierOption: selection.supplierOption,
  };
  const customuom = customUomFromSkuPick(selection.uom);
  if (customuom) body.customuom = customuom;
  if (line.scopeNoCharge) {
    body.customumprice = 0;
    const measure = line.custommeasure ?? measureForPricing ?? 1;
    if (line.custommeasure == null) {
      body.custommeasure = measure;
    }
    body.totalprice = 0;
    return body;
  }
  const price = selection.priceExcGst;
  if (price == null) return body;

  body.customumprice = price;
  const measure = line.custommeasure ?? measureForPricing ?? null;
  if (measure != null) {
    body.totalprice = measure * price;
  }
  return body;
}

