import type { PrimarySupplierSummary } from "@/lib/client/primary-supplier-by-sku";
import {
  adjustedSupplierPriceExcGst,
  defaultSupplierDiscountPct,
  formatSupplierDiscountPctLabel,
  applySupplierDiscountToPriceExcGst,
  type SupplierDiscountByKey,
} from "@/lib/client/supplier-discount-price";

import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import { cascadeLevelFromPriceLevel } from "@/lib/cascades/cascade-level-from-price-level";
import { filterDataSkusWithCascadeFallback } from "@/lib/sku/match-data-sku-filters";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
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



export function effectiveStyleColourForLine(

  pa: ProjectAreaPublic,

  project: ProjectPublic | null,

  line: ProjectAreaObjectPublic,

): { style: string; colour: string } {

  const style =

    (line.style?.trim() || pa.style?.trim() || project?.defaultstyle?.trim() || "") ?? "";

  const colour =

    (line.colour?.trim() || pa.colour?.trim() || project?.defaultcolour?.trim() || "") ?? "";

  return { style, colour };

}



export function effectiveElevateLevelForLine(

  priceLevels: PriceLevelPublic[],

  line: ProjectAreaObjectPublic,

  pa: ProjectAreaPublic,

  project: ProjectPublic | null,

  cascades?: CascadeRow[],

): string {

  const plId = line.pricelevelid ?? pa.pricelevelid ?? project?.defaultpricelevelid ?? null;

  return cascadeLevelFromPriceLevel(

    priceLevels,

    plId,

    project?.projectfinish,

    cascades,

  );

}



export type AppendSkuMatchContext = {
  /** Parent line category (e.g. Bathroom). */
  parentCategory?: string;
  /** Append spec product name — binds to `data_skus.product` for that slot. */
  appendProductSpec: string;
};

export type ScopeLineSkuMatchOptions = {
  colourLookupIndex?: ColourLookupIndex | null;
  /** Bundled append child: union spec-bound SKUs (style-open) with type cascade matches. */
  appendMatch?: AppendSkuMatchContext;
};

function mergeSkuMatchLists(...lists: DataSkuPublic[][]): DataSkuPublic[] {
  const seen = new Set<string>();
  const merged: DataSkuPublic[] = [];
  for (const list of lists) {
    for (const sku of list) {
      if (seen.has(sku.skuId)) continue;
      seen.add(sku.skuId);
      merged.push(sku);
    }
  }
  merged.sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));
  return merged;
}

function queryCatalogSkus(
  catalogSkus: DataSkuPublic[],
  query: {
    category: string;
    productType: string;
    elevateLevel: string;
    style: string;
    colour: string;
    product?: string;
  },
  colourLookupIndex: ColourLookupIndex | null,
): DataSkuPublic[] {
  const currentOnly = catalogSkus.filter((s) => s.isCurrent !== false);
  return filterDataSkusWithCascadeFallback(
    currentOnly,
    {
      category: query.category,
      productType: query.productType,
      product: query.product,
      elevateLevel: query.elevateLevel,
      style: query.style,
      colour: query.colour,
    },
    { includeAllDimensionSkuRows: true, colourLookupIndex },
  );
}

/** Append spec product only (style-open) — used to auto-select bundled append children. */
export function matchingSkusForAppendSpecOnly(
  catalogSkus: DataSkuPublic[],
  quoteObject: QuoteObjectPublic | undefined,
  filters: { elevateLevel: string; style: string; colour: string },
  append: AppendSkuMatchContext,
  options?: Pick<ScopeLineSkuMatchOptions, "colourLookupIndex">,
): DataSkuPublic[] {
  const category = append.parentCategory?.trim() || quoteObject?.category?.trim() || "";
  const productType = quoteObject?.objectname?.trim() ?? "";
  const appendSpec = append.appendProductSpec.trim();
  if (!category || !productType || !appendSpec) return [];

  const matches = queryCatalogSkus(
    catalogSkus,
    {
      category,
      productType,
      product: appendSpec,
      elevateLevel: filters.elevateLevel,
      style: "",
      colour: filters.colour,
    },
    options?.colourLookupIndex ?? null,
  );
  matches.sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));
  return matches;
}

export function skuProductMatchesAppendSpec(
  sku: DataSkuPublic,
  appendProductSpec: string,
): boolean {
  const spec = appendProductSpec.trim();
  if (!spec) return false;
  return normalizeSkuPart(sku.product) === normalizeSkuPart(spec);
}

export function matchingSkusForScopeLine(

  catalogSkus: DataSkuPublic[],

  quoteObject: QuoteObjectPublic | undefined,

  filters: { elevateLevel: string; style: string; colour: string },

  options?: ScopeLineSkuMatchOptions,

): DataSkuPublic[] {

  const category =
    options?.appendMatch?.parentCategory?.trim() || quoteObject?.category?.trim() || "";

  const productType = quoteObject?.objectname?.trim() ?? "";

  if (!category || !productType) return [];

  const colourLookupIndex = options?.colourLookupIndex ?? null;
  const appendSpec = options?.appendMatch?.appendProductSpec?.trim() ?? "";

  if (appendSpec) {
    const specMatches = matchingSkusForAppendSpecOnly(
      catalogSkus,
      quoteObject,
      filters,
      { parentCategory: category, appendProductSpec: appendSpec },
      { colourLookupIndex },
    );
    const typeMatches = queryCatalogSkus(
      catalogSkus,
      {
        category,
        productType,
        elevateLevel: filters.elevateLevel,
        style: filters.style,
        colour: filters.colour,
      },
      colourLookupIndex,
    );
    return mergeSkuMatchLists(specMatches, typeMatches);
  }

  return queryCatalogSkus(
    catalogSkus,
    {
      category,
      productType,
      elevateLevel: filters.elevateLevel,
      style: filters.style,
      colour: filters.colour,
    },
    colourLookupIndex,
  );

}



export function skuOptionLabel(sku: DataSkuPublic): string {

  const prod = sku.product?.trim();

  return prod ? `${sku.skuId} · ${prod}` : sku.skuId;

}



/** One selectable workbench SKU row (catalog SKU + a specific supplier priority). */

export type ScopeLineSkuPick = {

  skuId: string;

  product: string;

  supplierOption: number;

  supplier: string;

  /** Supplier model / description (Data_SKU supplier col). */
  model: string;

  /** Supplier’s own SKU/code (sheet “SKU” column) — not `skuId`. */
  supplierSku: string;

  /** Supplier product URL (Data_SKU supplier col). */
  link: string;

  priceExcGst: number | null;

  /** Default supplier discount % applied to retail SKU price (when &gt; 0). */
  discountPctApplied: number | null;

};

/** True when the line already reflects this SKU pick (avoids auto-apply loops). */
export function scopeLineMatchesSkuPick(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption" | "customumprice" | "totalprice">,
  pick: ScopeLineSkuPick,
): boolean {
  if ((line.skuId ?? "").trim() !== pick.skuId) return false;
  if (line.supplierOption !== pick.supplierOption) return false;
  if (line.totalprice == null) return false;
  if (pick.priceExcGst == null) return true;
  if (line.customumprice == null) return false;
  if (Math.abs(line.customumprice - pick.priceExcGst) >= 1e-6) return false;
  return true;
}

/** Fill missing pick unit price from supplier rows or the line's stored price. */
export function scopeLineSkuPickWithResolvedPrice(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption" | "customumprice">,
  pick: ScopeLineSkuPick,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): ScopeLineSkuPick {
  if (pick.priceExcGst != null) return pick;
  const price = resolveScopeLineSkuUnitPriceExcGst(line, suppliersBySkuId, supplierDiscountByKey);
  if (price == null) return pick;
  return { ...pick, priceExcGst: price };
}



const PICK_VALUE_SEP = "::";



export function encodeScopeLineSkuPickValue(

  skuId: string,

  supplierOption: number,

): string {

  return `${skuId}${PICK_VALUE_SEP}${supplierOption}`;

}



export function decodeScopeLineSkuPickValue(

  value: string,

): { skuId: string; supplierOption: number } | null {

  const i = value.lastIndexOf(PICK_VALUE_SEP);

  if (i < 0) return null;

  const skuId = value.slice(0, i);

  const supplierOption = Number(value.slice(i + PICK_VALUE_SEP.length));

  if (!skuId || !isValidSupplierOption(supplierOption)) return null;

  return { skuId, supplierOption };

}



export function scopeLineSkuPickLabel(

  pick: ScopeLineSkuPick,

  options?: { showPriorityPrefix?: boolean },

): string {

  const base = pick.product ? `${pick.skuId} · ${pick.product}` : pick.skuId;

  if (!options?.showPriorityPrefix) return base;

  return `[P${pick.supplierOption}] ${base}`;

}



/** Checklist SKU dropdown text — product description only (`skuId` remains on the pick value). */

export function scopeLineSkuPickDescriptionLabel(

  pick: Pick<ScopeLineSkuPick, "skuId" | "product">,

): string {

  const desc = pick.product.trim();

  return desc || pick.skuId;

}



/** Hover text: object type, description, supplier details, then supplier SKU (not catalog skuId). */

export function scopeLineSkuPickHoverTitle(

  pick: Pick<ScopeLineSkuPick, "product" | "supplier" | "model" | "supplierSku">,

  objectType: string,

): string {

  const lines: string[] = [];

  const type = objectType.trim();

  if (type) lines.push(`Object type: ${type}`);

  const desc = pick.product.trim();

  if (desc) lines.push(`Description: ${desc}`);

  const supplier = pick.supplier.trim();

  const model = pick.model.trim();

  if (supplier && model) lines.push(`Supplier: ${supplier} — ${model}`);

  else if (model) lines.push(`Supplier: ${model}`);

  else if (supplier) lines.push(`Supplier: ${supplier}`);

  const supplierSku = pick.supplierSku.trim();

  if (supplierSku) lines.push(`Supplier SKU: ${supplierSku}`);

  return lines.join("\n");

}



/** Workbench “All” mode: supplier, SKU description, and price for admin comparison. */
export function scopeLineSkuPickAllModeLabel(
  pick: ScopeLineSkuPick,
  formattedPrice: string,
): string {
  const supplierPart = pick.supplier.trim() || "—";
  const desc = pick.product.trim() || "—";
  return `[P${pick.supplierOption}] ${supplierPart} · ${desc} · ${formattedPrice}`;
}



/** Priority 1 supplier, else lowest valid option on file. */
export function preferredSupplierForSku(
  suppliers: DataSkuSupplierPublic[],
): DataSkuSupplierPublic | undefined {
  const valid = suppliers.filter((s) => isValidSupplierOption(s.supplierOption));
  if (!valid.length) return undefined;
  return (
    valid.find((s) => s.supplierOption === PREFERRED_SUPPLIER_OPTION) ??
    [...valid].sort((a, b) => a.supplierOption - b.supplierOption)[0]
  );
}

/** Unit price (ex GST) for workbench display when the line has not been priced yet. */
export function resolveScopeLineSkuUnitPriceExcGst(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption" | "customumprice">,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): number | null {
  if (line.customumprice != null) return line.customumprice;
  const row = resolveScopeLineSupplier(line, suppliersBySkuId);
  if (!row) return null;
  const pct = defaultSupplierDiscountPct(row.supplier, supplierDiscountByKey);
  return applySupplierDiscountToPriceExcGst(row.priceExcGst, pct);
}

/** Supplier row used for pricing on this line (explicit option, else priority 1). */
export function resolveScopeLineSupplier(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption">,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): DataSkuSupplierPublic | null {
  const skuId = line.skuId?.trim();
  if (!skuId) return null;
  const suppliers = suppliersBySkuId[skuId] ?? [];
  const opt = line.supplierOption;
  if (opt != null && isValidSupplierOption(opt)) {
    const exact = suppliers.find((s) => s.supplierOption === opt);
    if (exact) return exact;
  }
  return preferredSupplierForSku(suppliers) ?? null;
}

/** Workbench Supplier column label (supplier name + priority, optional discount). */
export function resolveScopeLineSupplierLabel(
  line: Pick<
    ProjectAreaObjectPublic,
    "skuId" | "supplierOption" | "manualSupplier" | "manualSupplierSku"
  >,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): string {
  const row = resolveScopeLineSupplier(line, suppliersBySkuId);
  if (row) {
    const name = row.supplier.trim();
    const priorityLabel = `P${row.supplierOption}`;
    const pct = defaultSupplierDiscountPct(row.supplier, supplierDiscountByKey);
    const pctLabel = formatSupplierDiscountPctLabel(pct);
    if (!name) return priorityLabel;
    if (pctLabel) return `${name} (${priorityLabel}, ${pctLabel})`;
    return `${name} (${priorityLabel})`;
  }
  const manual = line.manualSupplier?.trim();
  if (manual) return manual;
  return "—";
}

export function resolveScopeLineSupplierTitle(
  line: Pick<
    ProjectAreaObjectPublic,
    "skuId" | "supplierOption" | "manualSupplier" | "manualSupplierSku"
  >,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): string | undefined {
  const row = resolveScopeLineSupplier(line, suppliersBySkuId);
  if (row) {
    const parts = [`Priority ${row.supplierOption}`];
    if (row.supplier.trim()) parts.push(row.supplier.trim());
    const pct = defaultSupplierDiscountPct(row.supplier, supplierDiscountByKey);
    if (pct > 0) {
      parts.push(
        `Discount ${formatSupplierDiscountPctLabel(pct)} applied to retail ex-GST`,
      );
      if (row.priceExcGst != null) {
        parts.push(`Retail: $${row.priceExcGst.toFixed(2)}`);
      }
    }
    if (row.supplierSku.trim()) parts.push(`Code: ${row.supplierSku.trim()}`);
    const override = line.manualSupplierSku?.trim();
    if (override && override !== row.supplierSku.trim()) {
      parts.push(`Code override: ${override}`);
    }
    if (row.model.trim()) parts.push(`Model: ${row.model.trim()}`);
    return parts.join(" · ");
  }
  const manual = line.manualSupplier?.trim();
  if (manual) {
    const code = line.manualSupplierSku?.trim();
    return code ? `${manual} · Code: ${code}` : manual;
  }
  return undefined;
}

function pickFromSupplier(
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
    supplierSku: sup.supplierSku.trim(),
    link: sup.link.trim(),
    priceExcGst,
    discountPctApplied,
  };
}

/** Match `data_skus.product` (case-insensitive) and return the first current catalog row. */
export function matchCatalogSkuByProductName(
  productName: string,
  catalogSkus: DataSkuPublic[],
): DataSkuPublic | null {
  const key = productName.trim().toLowerCase();
  if (!key) return null;

  const matches = catalogSkus
    .filter((s) => s.isCurrent !== false && (s.product?.trim().toLowerCase() ?? "") === key)
    .sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));

  return matches[0] ?? null;
}

/** Supplier row on a catalog SKU matched by supplier name (case-insensitive). */
export function findSupplierRowByName(
  skuId: string,
  supplierName: string,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): DataSkuSupplierPublic | null {
  const skuKey = skuId.trim();
  const supplierKey = supplierName.trim().toLowerCase();
  if (!skuKey || !supplierKey) return null;

  const rows = (suppliersBySkuId[skuKey] ?? []).filter(
    (s) => s.supplier.trim().toLowerCase() === supplierKey,
  );
  if (!rows.length) return null;
  return preferredSupplierForSku(rows) ?? rows[0];
}

/** Match `data_skus.product` (case-insensitive) and return priority-1 supplier pick. */
export function preferredSkuPickForProductName(
  productName: string,
  catalogSkus: DataSkuPublic[],
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): ScopeLineSkuPick | null {
  const key = productName.trim().toLowerCase();
  if (!key) return null;

  const matches = catalogSkus
    .filter((s) => s.isCurrent !== false && (s.product?.trim().toLowerCase() ?? "") === key)
    .sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));

  const sku = matches[0];
  if (!sku) return null;

  const sup = preferredSupplierForSku(suppliersBySkuId[sku.skuId] ?? []);
  if (!sup) {
    return {
      skuId: sku.skuId,
      product: sku.product?.trim() ?? "",
      supplierOption: 1,
      supplier: "",
      model: "",
      supplierSku: "",
      link: "",
      priceExcGst: null,
      discountPctApplied: null,
    };
  }
  return pickFromSupplier(sku, sup, supplierDiscountByKey);
}

/** Supplier label for a SKU pick (same as workbench supplier column). */
export function scopeLineSkuPickSupplierLabel(pick: ScopeLineSkuPick): string {
  const name = pick.supplier.trim();
  return name || `P${pick.supplierOption}`;
}

/**

 * Workbench dropdown options: default = priority-1 supplier per matching SKU;

 * “All” = every supplier priority row for each matching SKU.

 */

export function buildScopeLineSkuPicks(
  catalogMatches: DataSkuPublic[],
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  includeAllSupplierOptions: boolean,
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption">,
  supplierDiscountByKey: SupplierDiscountByKey = new Map(),
): ScopeLineSkuPick[] {

  const picks: ScopeLineSkuPick[] = [];



  for (const sku of catalogMatches) {

    const suppliers = suppliersBySkuId[sku.skuId] ?? [];

    if (includeAllSupplierOptions) {

      for (const sup of suppliers) {

        picks.push(pickFromSupplier(sku, sup, supplierDiscountByKey));

      }

    } else {
      const sup = preferredSupplierForSku(suppliers);
      if (sup) {
        picks.push(pickFromSupplier(sku, sup, supplierDiscountByKey));
      } else {
        picks.push({
          skuId: sku.skuId,
          product: sku.product?.trim() ?? "",
          supplierOption: PREFERRED_SUPPLIER_OPTION,
          supplier: "",
          model: "",
          supplierSku: "",
          link: "",
          priceExcGst: null,
          discountPctApplied: null,
        });
      }
    }

  }



  picks.sort((a, b) => {

    const bySku = a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" });

    if (bySku !== 0) return bySku;

    return a.supplierOption - b.supplierOption;

  });



  const selSku = line.skuId?.trim();

  const selOpt = line.supplierOption;

  if (

    selSku &&

    selOpt != null &&

    isValidSupplierOption(selOpt) &&

    !picks.some((p) => p.skuId === selSku && p.supplierOption === selOpt)

  ) {

    const sku = catalogMatches.find((m) => m.skuId === selSku);

    const sup = (suppliersBySkuId[selSku] ?? []).find((s) => s.supplierOption === selOpt);

    if (sku && sup) picks.push(pickFromSupplier(sku, sup, supplierDiscountByKey));

    picks.sort((a, b) => {

      const bySku = a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" });

      if (bySku !== 0) return bySku;

      return a.supplierOption - b.supplierOption;

    });

  }



  return picks;

}



export function activeScopeLineSkuPickValue(

  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption">,

  picks: ScopeLineSkuPick[],

): string {

  const selSku = line.skuId?.trim();

  if (selSku) {

    const opt = line.supplierOption;

    if (opt != null && isValidSupplierOption(opt)) {

      const exact = picks.find((p) => p.skuId === selSku && p.supplierOption === opt);

      if (exact) return encodeScopeLineSkuPickValue(exact.skuId, exact.supplierOption);

    }

    const forSku = picks.filter((p) => p.skuId === selSku);

    if (forSku.length === 1) {

      return encodeScopeLineSkuPickValue(forSku[0]!.skuId, forSku[0]!.supplierOption);

    }

    const p1 = forSku.find((p) => p.supplierOption === PREFERRED_SUPPLIER_OPTION);

    if (p1) return encodeScopeLineSkuPickValue(p1.skuId, p1.supplierOption);

  }

  if (picks.length === 1) {

    const only = picks[0]!;

    return encodeScopeLineSkuPickValue(only.skuId, only.supplierOption);

  }

  return "";

}



/** @deprecated Use buildScopeLineSkuPicks — kept for label helper compatibility. */

export function scopeLineSkuOptionLabel(

  sku: DataSkuPublic,

  primarySupplierBySkuId: Record<string, PrimarySupplierSummary>,

  options?: { showPriorityPrefix?: boolean },

): string {

  const base = skuOptionLabel(sku);

  if (!options?.showPriorityPrefix) return base;

  const opt = primarySupplierBySkuId[sku.skuId]?.supplierOption;

  if (opt == null || !isValidSupplierOption(opt)) return base;

  return `[P${opt}] ${base}`;

}


