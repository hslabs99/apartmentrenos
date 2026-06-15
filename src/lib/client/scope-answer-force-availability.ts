import { cascadeLevelFromPriceLevel } from "@/lib/cascades/cascade-level-from-price-level";
import {
  matchingSkusForScopeLine,
  type ScopeLineSkuMatchOptions,
} from "@/lib/client/scope-line-sku-match";
import { isSystemScopeObjectId } from "@/lib/system-scope-types";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopeAnswerPublic, ScopePublic } from "@/types/scope";

export type ScopeSkuFilterContext = {
  elevateLevel: string;
  style: string;
  colour: string;
};

/** Effective tier/style/colour for scope answer availability (area + project defaults). */
export function scopeSkuFiltersForProjectArea(
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  priceLevels: PriceLevelPublic[],
  cascades: CascadeRow[],
): ScopeSkuFilterContext {
  const style = pa.style?.trim() || project?.defaultstyle?.trim() || "";
  const colour = pa.colour?.trim() || project?.defaultcolour?.trim() || "";
  const plId = pa.pricelevelid ?? project?.defaultpricelevelid ?? null;
  const elevateLevel = cascadeLevelFromPriceLevel(
    priceLevels,
    plId,
    project?.projectfinish,
    cascades,
  );
  return { elevateLevel, style, colour };
}

/**
 * True when every Force-marked catalog object on the answer has at least one matching SKU.
 * Answers with no Force objects are always available.
 */
export function isScopeAnswerForceAvailable(
  answer: ScopeAnswerPublic,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
  filters: ScopeSkuFilterContext,
  options?: ScopeLineSkuMatchOptions,
): boolean {
  const forceFlags = answer.attachedObjectForce ?? {};
  const forcedIds = (answer.attachedQuoteObjectIds ?? []).filter(
    (id) => forceFlags[id] === true && !isSystemScopeObjectId(id),
  );
  if (forcedIds.length === 0) return true;

  for (const id of forcedIds) {
    const qObj = quoteObjects.find((q) => q.id === id);
    if (!qObj) return false;
    const matches = matchingSkusForScopeLine(catalogSkus, qObj, filters, options);
    if (matches.length === 0) return false;
  }
  return true;
}

export function scopeAnswerForceAvailabilityById(
  scope: ScopePublic,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
  filters: ScopeSkuFilterContext,
  options?: ScopeLineSkuMatchOptions,
): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const answer of scope.answers) {
    out.set(
      answer.answerid,
      isScopeAnswerForceAvailable(answer, quoteObjects, catalogSkus, filters, options),
    );
  }
  return out;
}

/** Selected scope answer became unavailable under Force rules — clear it. */
export function scopeAnswerNeedsForceClear(
  scope: ScopePublic,
  answerid: string,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
  filters: ScopeSkuFilterContext,
  options?: ScopeLineSkuMatchOptions,
): boolean {
  const answer = scope.answers.find((a) => a.answerid === answerid);
  if (!answer) return false;
  return !isScopeAnswerForceAvailable(answer, quoteObjects, catalogSkus, filters, options);
}
