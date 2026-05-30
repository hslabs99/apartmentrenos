import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { DataSupplierDiscountRangePublic } from "@/types/data-supplier-discount-range-public";

function parseThreshold(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .trim()
    .replace(/^\$/, "")
    .replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

export function dataSupplierDiscountRangeDocToPublic(
  id: string,
  data: DocumentData,
): DataSupplierDiscountRangePublic {
  const rangeName =
    typeof data.rangeName === "number" && Number.isFinite(data.rangeName)
      ? data.rangeName
      : Number(id);
  return {
    id,
    rangeName,
    discount: parseThreshold(data.discount),
    importedAt: tsToIso(data.importedAt as Timestamp | undefined),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
