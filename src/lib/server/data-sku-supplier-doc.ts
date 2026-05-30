import type { DocumentData } from "firebase-admin/firestore";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";

function parseNumberOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseSourceSheetRows(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n) => typeof n === "number" && Number.isFinite(n))
    .map((n) => Math.round(n as number));
}

export function dataSkuSupplierDocToPublic(
  id: string,
  data: DocumentData,
): DataSkuSupplierPublic {
  const supplierOption = parseNumberOrNull(data.supplierOption);
  return {
    id,
    skuId: parseText(data.skuId),
    supplierOption: isValidSupplierOption(supplierOption) ? supplierOption : 0,
    supplier: parseText(data.supplier),
    model: parseText(data.model),
    supplierSku: parseText(data.supplierSku),
    link: parseText(data.link),
    priceIncGst: parseNumberOrNull(data.priceIncGst),
    priceExcGst: parseNumberOrNull(data.priceExcGst),
    sourceSheetRows: parseSourceSheetRows(data.sourceSheetRows),
  };
}
