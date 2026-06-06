import { isBlindsSystemLine } from "@/lib/blinds/blinds-data-utils";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";

export const ORPHAN_QUOTE_OBJECT_LINE_TOOLTIP =
  "This line points to a quote object that no longer exists in Setup → Quote Objects. Remove this line, then add a current object manually.";

export function quoteObjectForProjectLine(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): QuoteObjectPublic | undefined {
  if (isBlindsSystemLine(row)) return undefined;
  return quoteObjects.find((o) => o.objectid === row.objectid);
}

export function isOrphanQuoteObjectLine(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): boolean {
  if (isBlindsSystemLine(row)) return false;
  return quoteObjectForProjectLine(row, quoteObjects) === undefined;
}

function objectNameFromMatchedSku(
  row: ProjectAreaObjectPublic,
  catalogSkus?: DataSkuPublic[],
): string {
  const skuId = row.skuId?.trim();
  if (!skuId || !catalogSkus?.length) return "";
  const hit = catalogSkus.find((s) => s.skuId === skuId);
  return hit?.productType?.trim() ?? "";
}

/** Best display name for a project line (live quote object, snapshot, or SKU product type). */
export function projectLineObjectLabel(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus?: DataSkuPublic[],
): string {
  if (isBlindsSystemLine(row)) {
    return "Blinds";
  }
  const q = quoteObjectForProjectLine(row, quoteObjects);
  const live = q?.objectname?.trim();
  if (live) return live;
  const snap = row.objectname?.trim();
  if (snap) return snap;
  const fromSku = objectNameFromMatchedSku(row, catalogSkus);
  if (fromSku) return fromSku;
  return `Object #${row.objectid}`;
}
