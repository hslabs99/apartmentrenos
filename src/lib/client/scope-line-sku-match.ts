import type { PrimarySupplierSummary } from "@/lib/client/primary-supplier-by-sku";

import { filterDataSkusWithCascadeFallback } from "@/lib/sku/match-data-sku-filters";

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

): string {

  const plId = line.pricelevelid ?? pa.pricelevelid ?? project?.defaultpricelevelid ?? null;

  if (plId == null) return "";

  const hit = priceLevels.find((p) => p.pricelevelid === plId);

  return hit?.pricelevel?.trim() ?? "";

}



export function matchingSkusForScopeLine(

  catalogSkus: DataSkuPublic[],

  quoteObject: QuoteObjectPublic | undefined,

  filters: { elevateLevel: string; style: string; colour: string },

): DataSkuPublic[] {

  const category = quoteObject?.category?.trim() ?? "";

  const productType = quoteObject?.objectname?.trim() ?? "";

  if (!category || !productType) return [];



  const currentOnly = catalogSkus.filter((s) => s.isCurrent !== false);

  const matches = filterDataSkusWithCascadeFallback(currentOnly, {

    category,

    productType,

    elevateLevel: filters.elevateLevel,

    style: filters.style,

    colour: filters.colour,

  });

  matches.sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));

  return matches;

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

  priceExcGst: number | null;

};

/** True when the line already reflects this SKU pick (avoids auto-apply loops). */
export function scopeLineMatchesSkuPick(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption" | "customumprice">,
  pick: ScopeLineSkuPick,
): boolean {
  if ((line.skuId ?? "").trim() !== pick.skuId) return false;
  if (line.supplierOption !== pick.supplierOption) return false;
  if (pick.priceExcGst == null) return true;
  if (line.customumprice == null) return false;
  return Math.abs(line.customumprice - pick.priceExcGst) < 1e-6;
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



/** Workbench “All” mode: supplier, SKU description, and price for admin comparison. */
export function scopeLineSkuPickAllModeLabel(
  pick: ScopeLineSkuPick,
  formattedPrice: string,
): string {
  const supplierPart = pick.supplier.trim() || "—";
  const skuPart = pick.product ? `${pick.skuId} · ${pick.product}` : pick.skuId;
  return `[P${pick.supplierOption}] ${supplierPart} · ${skuPart} · ${formattedPrice}`;
}



function pickFromSupplier(

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



/**

 * Workbench dropdown options: default = priority-1 supplier per matching SKU;

 * “All” = every supplier priority row for each matching SKU.

 */

export function buildScopeLineSkuPicks(

  catalogMatches: DataSkuPublic[],

  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,

  includeAllSupplierOptions: boolean,

  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption">,

): ScopeLineSkuPick[] {

  const picks: ScopeLineSkuPick[] = [];



  for (const sku of catalogMatches) {

    const suppliers = suppliersBySkuId[sku.skuId] ?? [];

    if (includeAllSupplierOptions) {

      for (const sup of suppliers) {

        picks.push(pickFromSupplier(sku, sup));

      }

    } else {

      const p1 = suppliers.find(

        (s) => s.supplierOption === PREFERRED_SUPPLIER_OPTION,

      );

      if (p1) picks.push(pickFromSupplier(sku, p1));

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

    if (sku && sup) picks.push(pickFromSupplier(sku, sup));

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


