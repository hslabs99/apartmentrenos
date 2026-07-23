import {
  effectiveElevateLevelForLine,
  effectiveStyleColourForLine,
  matchingSkusForAppendSpecOnly,
  matchingSkusForScopeLine,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import {
  adjustedSupplierPriceExcGst,
  type SupplierDiscountByKey,
} from "@/lib/client/supplier-discount-price";
import {
  appendSlotsFromDataSku,
  appendSpecForSlot,
  type DataSkuAppendSlotRef,
} from "@/lib/sku/data-sku-append-slots";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";
import {
  isValidSupplierOption,
  PREFERRED_SUPPLIER_OPTION,
} from "@/lib/sku/supplier-option";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
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
  resolveError: string | null;
};

type AppendResolveContext = {
  parentCategory: string;
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  line: ProjectAreaObjectPublic;
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  priceLevels: PriceLevelPublic[];
  cascades?: CascadeRow[];
  quoteObjects: QuoteObjectPublic[];
  preferredSupplierOption: number | null;
  supplierDiscountByKey: SupplierDiscountByKey;
  colourLookupIndex?: ColourLookupIndex | null;
};

function pickFromSkuAndSupplier(
  sku: DataSkuPublic,
  sup: DataSkuSupplierPublic,
  supplierDiscountByKey: SupplierDiscountByKey,
): ScopeLineSkuPick {
  const { priceExcGst, discountPctApplied } = adjustedSupplierPriceExcGst(
    sup,
    supplierDiscountByKey,
  );
  return {
    skuId: sku.skuId,
    product: sku.product?.trim() ?? "",
    supplierOption: sup.supplierOption,
    supplier: sup.supplier.trim(),
    model: sup.model.trim(),
    link: sup.link.trim(),
    priceExcGst,
    discountPctApplied,
  };
}

function preferredSupplierPick(
  sku: DataSkuPublic,
  suppliers: DataSkuSupplierPublic[],
  preferredOption: number | null,
  supplierDiscountByKey: SupplierDiscountByKey,
): ScopeLineSkuPick | null {
  if (suppliers.length === 0) return null;
  let sup: DataSkuSupplierPublic | undefined;
  if (preferredOption != null && isValidSupplierOption(preferredOption)) {
    sup = suppliers.find((s) => s.supplierOption === preferredOption);
  }
  sup ??= suppliers.find((s) => s.supplierOption === PREFERRED_SUPPLIER_OPTION);
  sup ??= suppliers[0];
  return sup ? pickFromSkuAndSupplier(sku, sup, supplierDiscountByKey) : null;
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

function matchAppendSpecSkus(
  ctx: AppendResolveContext,
  slot: DataSkuAppendSlotRef,
): DataSkuPublic[] {
  const { style, colour } = effectiveStyleColourForLine(ctx.pa, ctx.project, ctx.line);
  const elevateLevel = effectiveElevateLevelForLine(
    ctx.priceLevels,
    ctx.line,
    ctx.pa,
    ctx.project,
    ctx.cascades,
  );
  const qo = findQuoteObjectForAppend(ctx.quoteObjects, ctx.parentCategory, slot.productType);
  const spec = slot.product.trim();
  if (!spec) return [];
  return matchingSkusForAppendSpecOnly(
    ctx.catalogSkus,
    qo,
    { elevateLevel, style, colour },
    { parentCategory: ctx.parentCategory.trim(), appendProductSpec: spec },
    { colourLookupIndex: ctx.colourLookupIndex ?? null },
  );
}

function resolveAppendSlot(
  ctx: AppendResolveContext,
  slot: DataSkuAppendSlotRef,
): ResolvedAppendChild {
  const qo = findQuoteObjectForAppend(ctx.quoteObjects, ctx.parentCategory, slot.productType);
  if (!qo) {
    return {
      slot: slot.slot,
      productType: slot.productType,
      product: slot.product,
      pick: null,
      quoteObjectDocId: null,
      resolveError: `No quote object for append type "${slot.productType}".`,
    };
  }

  if (!slot.product.trim()) {
    return {
      slot: slot.slot,
      productType: slot.productType,
      product: slot.product,
      pick: null,
      quoteObjectDocId: qo.id,
      resolveError: null,
    };
  }

  const matches = matchAppendSpecSkus(ctx, slot);
  if (matches.length === 0) {
    return {
      slot: slot.slot,
      productType: slot.productType,
      product: slot.product,
      pick: null,
      quoteObjectDocId: qo.id,
      resolveError: `No SKU matches append spec "${slot.product}" for ${slot.productType}.`,
    };
  }
  if (matches.length > 1) {
    return {
      slot: slot.slot,
      productType: slot.productType,
      product: slot.product,
      pick: null,
      quoteObjectDocId: qo.id,
      resolveError: `${matches.length} SKUs match append spec "${slot.product}" — select one manually.`,
    };
  }
  const sku = matches[0]!;
  const pick = preferredSupplierPick(
    sku,
    ctx.suppliersBySkuId[sku.skuId] ?? [],
    ctx.preferredSupplierOption,
    ctx.supplierDiscountByKey,
  );
  if (!pick) {
    return {
      slot: slot.slot,
      productType: slot.productType,
      product: slot.product,
      pick: null,
      quoteObjectDocId: qo.id,
      resolveError: `Matched SKU ${sku.skuId} has no supplier option.`,
    };
  }

  return {
    slot: slot.slot,
    productType: slot.productType,
    product: slot.product,
    pick,
    quoteObjectDocId: qo.id,
    resolveError: null,
  };
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
  cascades?: CascadeRow[];
  quoteObjects: QuoteObjectPublic[];
  preferredSupplierOption: number | null;
  supplierDiscountByKey?: SupplierDiscountByKey;
  colourLookupIndex?: ColourLookupIndex | null;
}): ResolvedAppendChild[] {
  const ctx: AppendResolveContext = {
    parentCategory: args.parentCategory,
    catalogSkus: args.catalogSkus,
    suppliersBySkuId: args.suppliersBySkuId,
    line: args.line,
    pa: args.pa,
    project: args.project,
    priceLevels: args.priceLevels,
    cascades: args.cascades,
    quoteObjects: args.quoteObjects,
    preferredSupplierOption: args.preferredSupplierOption,
    supplierDiscountByKey: args.supplierDiscountByKey ?? new Map(),
    colourLookupIndex: args.colourLookupIndex ?? null,
  };
  const slots = appendSlotsFromDataSku(args.parentSku);
  return slots.map((slot) => resolveAppendSlot(ctx, slot));
}

/** Tooltip when append spec could not auto-select a SKU (child line has no skuId). */
export function bundledAppendSkuPickerHint(args: {
  parentLine: ProjectAreaObjectPublic;
  childLine: ProjectAreaObjectPublic;
  parentSku: DataSkuPublic | undefined;
  parentCategory: string;
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  priceLevels: PriceLevelPublic[];
  cascades?: CascadeRow[];
  quoteObjects: QuoteObjectPublic[];
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  preferredSupplierOption?: number | null;
  supplierDiscountByKey?: SupplierDiscountByKey;
  colourLookupIndex?: ColourLookupIndex | null;
}): string | null {
  if (args.childLine.skuId?.trim()) return null;
  const slot = args.childLine.bundledAppendSlot;
  if (slot == null || !args.parentSku) return null;
  const spec = appendSpecForSlot(args.parentSku, slot);
  if (!spec) return null;

  const slots = appendSlotsFromDataSku(args.parentSku);
  const slotRef = slots.find((s) => s.slot === slot);
  if (!slotRef) return null;

  const resolved = resolveAppendSlot(
    {
      parentCategory: args.parentCategory,
      catalogSkus: args.catalogSkus,
      suppliersBySkuId: args.suppliersBySkuId,
      line: args.parentLine,
      pa: args.pa,
      project: args.project,
      priceLevels: args.priceLevels,
      cascades: args.cascades,
      quoteObjects: args.quoteObjects,
      preferredSupplierOption: args.preferredSupplierOption ?? null,
      supplierDiscountByKey: args.supplierDiscountByKey ?? new Map(),
      colourLookupIndex: args.colourLookupIndex ?? null,
    },
    slotRef,
  );
  return resolved.resolveError;
}
