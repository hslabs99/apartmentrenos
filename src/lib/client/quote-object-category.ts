import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";

export function quoteObjectCategory(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): string {
  const q = quoteObjects.find((o) => o.objectid === row.objectid);
  return q?.category?.trim() ?? "";
}
