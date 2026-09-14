import {
  collectShowAllIdentities,
  matchShowAllCatalogSkus,
} from "@/lib/sku/show-all-scope-skus";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

/** True when the current Setup answer has Show All for this quote object. */
export function scopeObjectIsShowAll(
  objectLines: ProjectAreaObjectPublic[],
  quoteObject: QuoteObjectPublic | undefined,
  scope: ScopePublic | undefined,
): boolean {
  const answerid = objectLines[0]?.answerid?.trim();
  if (!scope || !answerid || !quoteObject?.id) return false;
  const answer = scope.answers.find((a) => a.answerid === answerid);
  return answer?.attachedObjectShowAll?.[quoteObject.id] === true;
}

export function lineSkuProductLabel(
  line: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
): string {
  const fromLine = line.skuProduct?.trim();
  if (fromLine) return fromLine;
  const skuId = line.skuId?.trim();
  if (!skuId) return "(no SKU)";
  const sku = catalogSkus.find((s) => s.skuId === skuId);
  return sku?.product?.trim() || skuId;
}

export function expectedShowAllCatalogSkus(
  objectLines: ProjectAreaObjectPublic[],
  quoteObject: QuoteObjectPublic | undefined,
  catalogSkus: DataSkuPublic[],
  filters: { elevateLevel: string; style: string; colour: string },
  colourLookupIndex: ColourLookupIndex | null,
): DataSkuPublic[] {
  const skuRows = objectLines.flatMap((line) => {
    const skuId = line.skuId?.trim();
    const sku = skuId ? catalogSkus.find((s) => s.skuId === skuId) : undefined;
    if (!sku) return [];
    return [{ category: sku.category, productType: sku.productType }];
  });
  const identities = collectShowAllIdentities({
    quoteCategory: quoteObject?.category,
    quoteObjectName: quoteObject?.objectname || objectLines[0]?.objectname || undefined,
    lineObjectNames: objectLines.map((l) => l.objectname ?? ""),
    skuRows,
  });
  return matchShowAllCatalogSkus(catalogSkus, identities, filters, colourLookupIndex);
}

export function missingShowAllExpectedSkus(
  objectLines: ProjectAreaObjectPublic[],
  expected: DataSkuPublic[],
  catalogSkus: DataSkuPublic[],
): DataSkuPublic[] {
  const presentIds = new Set(
    objectLines.map((l) => l.skuId?.trim() ?? "").filter((id) => id.length > 0),
  );
  const presentProducts = new Set(
    objectLines
      .map((l) => normalizeSkuPart(lineSkuProductLabel(l, catalogSkus)))
      .filter((p) => p.length > 0 && p !== "(no sku)"),
  );
  return expected.filter((s) => {
    const id = s.skuId?.trim() ?? "";
    if (id && presentIds.has(id)) return false;
    const product = normalizeSkuPart(s.product);
    if (product && presentProducts.has(product)) return false;
    return true;
  });
}
