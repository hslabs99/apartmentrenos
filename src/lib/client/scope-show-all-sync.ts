import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

/**
 * True when the scope answer has Show All on attached objects but project lines
 * were not expanded (single row with SKU dropdown instead of one row per SKU).
 */
export function scopeAnswerNeedsShowAllLineSync(
  scope: ScopePublic,
  answerid: string,
  scopeLines: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
): boolean {
  const answer = scope.answers.find((a) => a.answerid === answerid);
  if (!answer?.attachedObjectShowAll) return false;

  for (const [quoteObjectDocId, showAll] of Object.entries(answer.attachedObjectShowAll)) {
    if (!showAll) continue;
    const qObj = quoteObjects.find((q) => q.id === quoteObjectDocId);
    if (!qObj) continue;

    const lines = scopeLines.filter((l) => l.objectid === qObj.objectid);
    if (lines.length === 0) continue;

    // One locked Show All row is a valid expansion (catalog may match a single SKU).
    // A leftover dropdown row (`scopeShowAllSku` not set) still needs a re-apply.
    if (lines.some((l) => l.scopeShowAllSku !== true)) return true;
  }

  return false;
}
