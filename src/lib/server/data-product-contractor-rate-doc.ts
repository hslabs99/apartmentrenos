import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { DataProductContractorRatePublic } from "@/types/data-product-contractor-rate-public";

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseOptionalText(v: unknown): string | null {
  const s = parseText(v);
  return s || null;
}

function parseOptionalMoney(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = parseText(v).replace(/^\$/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

export function dataProductContractorRateDocToPublic(
  id: string,
  data: DocumentData,
): DataProductContractorRatePublic {
  return {
    id,
    productType: parseText(data.productType),
    specification: parseText(data.specification),
    labourDesc: parseOptionalText(data.labourDesc),
    base: parseOptionalMoney(data.base),
    m2: parseOptionalMoney(data.m2),
    lm: parseOptionalMoney(data.lm),
    unit: parseOptionalMoney(data.unit),
    notes: parseOptionalText(data.notes),
    sheetRow: typeof data.sheetRow === "number" ? data.sheetRow : 0,
    importedAt: tsToIso(data.importedAt as Timestamp | undefined),
  };
}
