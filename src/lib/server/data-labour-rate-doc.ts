import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parsePriceExcGst(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = parseText(v).replace(/^\$/, "").replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

export function dataLabourRateDocToPublic(id: string, data: DocumentData): DataLabourRatePublic {
  return {
    id,
    category: parseText(data.category),
    productType: parseText(data.productType),
    product: parseText(data.product),
    priceExcGst: parsePriceExcGst(data.priceExcGst),
    uom: parseText(data.uom),
    sheetRow: typeof data.sheetRow === "number" ? data.sheetRow : 0,
    importedAt: tsToIso(data.importedAt as Timestamp | undefined),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
