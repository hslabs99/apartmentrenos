import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ScopeLineSkuPick } from "@/lib/client/scope-line-sku-match";

/** PATCH body when a scope line SKU (+ supplier priority) is chosen. */
export function patchBodyForScopeLineSku(
  line: ProjectAreaObjectPublic,
  selection: Pick<
    ScopeLineSkuPick,
    "skuId" | "product" | "supplierOption" | "priceExcGst"
  >,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    skuId: selection.skuId,
    skuProduct: selection.product,
    supplierOption: selection.supplierOption,
  };
  const price = selection.priceExcGst;
  if (price == null) return body;

  body.customumprice = price;
  const measure = line.custommeasure ?? 1;
  if (line.custommeasure == null) {
    body.custommeasure = measure;
  }
  body.totalprice = measure * price;
  return body;
}
