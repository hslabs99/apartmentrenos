import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parsePct(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 0 && v <= 1) return Math.round(v * 10000) / 100;
    return v;
  }
  const s = parseText(v).replace(/%$/, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalPct(v: unknown): number | null {
  if (v == null) return null;
  if (v === "") return null;
  const n = parsePct(v);
  if (v === 0 || v === "0") return 0;
  if (!parseText(v) && typeof v !== "number") return null;
  return n;
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

/** Read supplier doc; supports legacy `defaultDiscountPct` + `bands` shape. */
export function dataSupplierDiscountDocToPublic(
  id: string,
  data: DocumentData,
): DataSupplierDiscountPublic {
  const comment = parseText(data.comment);
  let defaultPct = parseOptionalPct(data.default);
  if (defaultPct == null && data.defaultDiscountPct != null) {
    defaultPct = parsePct(data.defaultDiscountPct);
  }
  if (defaultPct == null) defaultPct = 0;

  let range1 = parseOptionalPct(data.range1);
  let range2 = parseOptionalPct(data.range2);
  let range3 = parseOptionalPct(data.range3);
  let range4 = parseOptionalPct(data.range4);

  if (range1 == null && Array.isArray(data.bands)) {
    const bands = data.bands as { minOrderValue?: number; discountPct?: number }[];
    const sorted = [...bands].sort(
      (a, b) => (a.minOrderValue ?? 0) - (b.minOrderValue ?? 0),
    );
    const pcts = sorted.map((b) => parsePct(b.discountPct));
    range1 = pcts[0] ?? null;
    range2 = pcts[1] ?? null;
    range3 = pcts[2] ?? null;
    range4 = pcts[3] ?? null;
  }

  return {
    id,
    supplier: parseText(data.supplier),
    default: defaultPct,
    range1,
    range2,
    range3,
    range4,
    ...(comment ? { comment } : {}),
    sheetRow: typeof data.sheetRow === "number" ? data.sheetRow : 0,
    importedAt: tsToIso(data.importedAt as Timestamp | undefined),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
