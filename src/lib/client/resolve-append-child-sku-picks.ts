import {
  effectiveElevateLevelForLine,
  effectiveStyleColourForLine,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import { filterDataSkusWithCascadeFallback } from "@/lib/sku/match-data-sku-filters";
import { appendSlotsFromDataSku, type DataSkuAppendSlotRef } from "@/lib/sku/data-sku-append-slots";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";
import {
  isValidSupplierOption,
  PREFERRED_SUPPLIER_OPTION,
} from "@/lib/sku/supplier-option";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";

export type ResolvedAppendChild = {
  slot: DataSkuAppendSlotRef["slot"];
  productType: string;
  product: string;
  pick: ScopeLineSkuPick | null;
  quoteObjectDocId: string | null;
};

function pickFromSkuAndSupplier(
  sku: DataSkuPublic,
  sup: DataSkuSupplierPublic,
): ScopeLineSkuPick {
  return {
    skuId: sku.skuId,
    product: sku.product?.trim() ?? "",
    supplierOption: sup.supplierOption,
    supplier: sup.supplier.trim(),
    priceExcGst: sup.priceExcGst,
  };
}

function preferredSupplierPick(
  sku: DataSkuPublic,
  suppliers: DataSkuSupplierPublic[],
  preferredOption: number | null,
): ScopeLineSkuPick | null {
  if (suppliers.length === 0) return null;
  let sup: DataSkuSupplierPublic | undefined;
  if (preferredOption != null && isValidSupplierOption(preferredOption)) {
    sup = suppliers.find((s) => s.supplierOption === preferredOption);
  }
  sup ??= suppliers.find((s) => s.supplierOption === PREFERRED_SUPPLIER_OPTION);
  sup ??= suppliers[0];
  return sup ? pickFromSkuAndSupplier(sku, sup) : null;
}

export function findQuoteObjectForAppend(
  quoteObjects: QuoteObjectPublic[],
  category: string,
  productType: string,
): QuoteObjectPublic | undefined {
  const cat = normalizeSkuPart(category);
  const pt = normalizeSkuPart(productType);
  if (!cat || !pt) return undefined;
  return quoteObjects.find(
    (q) =>
      normalizeSkuPart(q.category) === cat && normalizeSkuPart(q.objectname) === pt,
  );
}

/**
 * Resolve bundled child SKU picks for append slots on the parent catalog row.
 * Uses category from the parent line’s quote object, append type + spec, and the
 * same tier / style / colour cascade as the primary scope line.
 */
export function resolveAppendChildSkuPicks(args: {
  parentSku: DataSkuPublic;
  parentCategory: string;
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  line: ProjectAreaObjectPublic;
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  priceLevels: PriceLevelPublic[];
  quoteObjects: QuoteObjectPublic[];
  preferredSupplierOption: number | null;
}): ResolvedAppendChild[] {
  const { style, colour } = effectiveStyleColourForLine(args.pa, args.project, args.line);
  const elevateLevel = effectiveElevateLevelForLine(args.priceLevels, args.line, args.pa, args.project);
  const category = args.parentCategory.trim();
  const currentOnly = args.catalogSkus.filter((s) => s.isCurrent !== false);
  const slots = appendSlotsFromDataSku(args.parentSku);

  return slots.map((slot) => {
    const matches = filterDataSkusWithCascadeFallback(currentOnly, {
      category,
      productType: slot.productType,
      product: slot.product,
      elevateLevel,
      style,
      colour,
    });
    matches.sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));
    const sku = matches[0];
    const pick = sku
      ? preferredSupplierPick(
          sku,
          args.suppliersBySkuId[sku.skuId] ?? [],
          args.preferredSupplierOption,
        )
      : null;
    const qo = findQuoteObjectForAppend(args.quoteObjects, category, slot.productType);
    return {
      slot: slot.slot,
      productType: slot.productType,
      product: slot.product,
      pick,
      quoteObjectDocId: qo?.id ?? null,
    };
  });
}
