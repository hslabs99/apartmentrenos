import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";

function integerObjectId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

export function readTooltipFromQuoteObjectData(data: DocumentData): string {
  return String(data.tooltip ?? "").trim();
}

type LineWithTooltip = { objectid: number; tooltip: string };

/** Fill empty line tooltips from an already-loaded quote-object map (no extra Firestore scan). */
export function applyTemplateTooltipsFromQuoteMap<T extends LineWithTooltip>(
  lines: T[],
  quoteByObjectId: Map<number, DocumentData>,
): T[] {
  return lines.map((l) => {
    if (l.tooltip.trim()) return l;
    const data = quoteByObjectId.get(l.objectid);
    const t = data ? readTooltipFromQuoteObjectData(data) : "";
    return t ? { ...l, tooltip: t } : l;
  });
}

/**
 * Fill empty line tooltips from Setup → Quote Objects (`objectid` → `tooltip`).
 * Pass `quoteByObjectId` when the caller already loaded `quote_objects`.
 */
export async function enrichLinesWithTemplateTooltips<T extends LineWithTooltip>(
  db: Firestore,
  lines: T[],
  quoteByObjectId?: Map<number, DocumentData>,
): Promise<T[]> {
  if (quoteByObjectId) {
    return applyTemplateTooltipsFromQuoteMap(lines, quoteByObjectId);
  }
  const qSnap = await db.collection("quote_objects").get();
  const byObjectId = new Map<number, DocumentData>();
  for (const d of qSnap.docs) {
    if (isQuoteObjectsMetaDocument(d.id)) continue;
    const data = d.data();
    const oid = integerObjectId(data.objectid);
    if (oid === undefined) continue;
    if (!byObjectId.has(oid)) byObjectId.set(oid, data);
  }
  return applyTemplateTooltipsFromQuoteMap(lines, byObjectId);
}
