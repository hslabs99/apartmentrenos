import { matchingSkusForScopeLine, type ScopeLineSkuMatchOptions } from "@/lib/client/scope-line-sku-match";
import { isLabourQuoteObject } from "@/lib/client/labour-checklist-line";
import { isSystemScopeObjectId } from "@/lib/system-scope-types";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import type { ScopeSkuFilterContext } from "@/lib/client/scope-answer-force-availability";

/**
 * True when this answer has Suppress 0 SKU Rows on and current scope lines
 * do not match which attached objects have catalog SKUs at the active filters.
 */
export function scopeAnswerNeedsZeroSkuRowSync(
  scope: ScopePublic,
  answerid: string,
  scopeLines: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
  filters: ScopeSkuFilterContext,
  options?: ScopeLineSkuMatchOptions,
): boolean {
  const answer = scope.answers.find((a) => a.answerid === answerid);
  if (!answer || answer.suppressZeroSkuRows !== true) return false;

  for (const id of answer.attachedQuoteObjectIds ?? []) {
    const trimmed = id.trim();
    if (!trimmed || isSystemScopeObjectId(trimmed)) continue;
    const qObj = quoteObjects.find((q) => q.id === trimmed);
    if (!qObj) continue;

    const hasLine = scopeLines.some((l) => l.objectid === qObj.objectid);
    const shouldHaveLine =
      isLabourQuoteObject(qObj) ||
      matchingSkusForScopeLine(catalogSkus, qObj, filters, options).length > 0;
    if (hasLine !== shouldHaveLine) return true;
  }

  return false;
}
