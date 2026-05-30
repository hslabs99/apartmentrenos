import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseLabourHours(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = parseText(v);
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

export function dataObjectLabourRateDocToPublic(
  id: string,
  data: DocumentData,
): DataObjectLabourRatePublic {
  return {
    id,
    category: parseText(data.category),
    productType: parseText(data.productType),
    product: parseText(data.product),
    constructionAssistant: parseLabourHours(data.constructionAssistant),
    leadContractor: parseLabourHours(data.leadContractor),
    electrician: parseLabourHours(data.electrician),
    plumber: parseLabourHours(data.plumber),
    uom: parseText(data.uom),
    comments: parseText(data.comments),
    sheetRow: typeof data.sheetRow === "number" ? data.sheetRow : 0,
    importedAt: tsToIso(data.importedAt as Timestamp | undefined),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
