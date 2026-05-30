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

/**
 * Fill empty line tooltips from Setup → Quote Objects (`objectid` → `tooltip`).
 */
export async function enrichLinesWithTemplateTooltips<T extends LineWithTooltip>(
  db: Firestore,
  lines: T[],
): Promise<T[]> {
  const qSnap = await db.collection("quote_objects").get();
  const byObjectId = new Map<number, string>();
  for (const d of qSnap.docs) {
    if (isQuoteObjectsMetaDocument(d.id)) continue;
    const data = d.data();
    const oid = integerObjectId(data.objectid);
    if (oid === undefined) continue;
    const t = readTooltipFromQuoteObjectData(data);
    if (t && !byObjectId.has(oid)) byObjectId.set(oid, t);
  }
  return lines.map((l) => {
    if (l.tooltip.trim()) return l;
    const t = byObjectId.get(l.objectid) ?? "";
    return { ...l, tooltip: t };
  });
}
