import {
  projectLineObjectLabel,
  quoteObjectForProjectLine,
} from "@/lib/client/project-line-quote-object";
import { LABOUR_RATE_CATEGORY } from "@/lib/labour-silo";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";

export function isLabourQuoteObjectCategory(category: string | null | undefined): boolean {
  return (
    (category ?? "").trim().localeCompare(LABOUR_RATE_CATEGORY, undefined, {
      sensitivity: "base",
    }) === 0
  );
}

export function isLabourQuoteObject(q: QuoteObjectPublic | undefined): boolean {
  return q != null && isLabourQuoteObjectCategory(q.category);
}

export function isLabourChecklistLine(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): boolean {
  return isLabourQuoteObject(quoteObjectForProjectLine(row, quoteObjects));
}

/** Product name shown in checklist SKU column for Labour scope objects. */
export function labourChecklistProductLabel(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): string {
  return projectLineObjectLabel(row, quoteObjects);
}
