import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseOptionalMoney(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = parseText(v).replace(/^\$/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseQuantity(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(parseText(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

export function dataBuildingElementDocToPublic(
  id: string,
  data: DocumentData,
): DataBuildingElementPublic {
  const rawLines = Array.isArray(data.lines) ? data.lines : [];
  const lines = rawLines.map((line) => {
    const row = line as Record<string, unknown>;
    return {
      category: parseText(row.category),
      skuProduct: parseText(row.skuProduct),
      lineUom: parseText(row.lineUom),
      unitPrice: parseOptionalMoney(row.unitPrice),
      quantity: parseQuantity(row.quantity),
      sheetRow: typeof row.sheetRow === "number" ? row.sheetRow : 0,
    };
  });

  return {
    id,
    skuName: parseText(data.skuName),
    element: parseText(data.element),
    size: parseText(data.size),
    type: parseText(data.type),
    quantityUom: parseText(data.quantityUom),
    sheetColumn: parseText(data.sheetColumn),
    headerSheetRow: typeof data.headerSheetRow === "number" ? data.headerSheetRow : 0,
    lines,
    importedAt: tsToIso(data.importedAt as Timestamp | undefined),
  };
}
