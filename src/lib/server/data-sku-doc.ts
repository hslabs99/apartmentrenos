import type { DocumentData } from "firebase-admin/firestore";
import { parseProductFromDoc } from "@/lib/legacy-product-field";
import type { PrimarySupplierSummary } from "@/lib/client/primary-supplier-by-sku";
import type { DataSkuPublic } from "@/types/data-sku-public";

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

function parseCalculatedM2(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function dataSkuDocToPublic(
  id: string,
  data: DocumentData,
  supplierCount = 0,
  primarySupplier: PrimarySupplierSummary | null = null,
): DataSkuPublic {
  const skuId = parseText(data.skuId) || id;
  return {
    id: skuId,
    skuId,
    category: parseText(data.category),
    productType: parseText(data.productType),
    product: parseProductFromDoc(data),
    elevateLevel: parseText(data.elevateLevel),
    style: parseText(data.style),
    colourOptions: parseText(data.colourOptions),
    uom: parseText(data.uom),
    append1Type: parseText(data.append1Type),
    append1Spec: parseText(data.append1Spec),
    append2Type: parseText(data.append2Type),
    append2Spec: parseText(data.append2Spec),
    append3Type: parseText(data.append3Type),
    append3Spec: parseText(data.append3Spec),
    sheetWidth: parseText(data.sheetWidth),
    stockAvailable: parseText(data.stockAvailable),
    leadTime: parseText(data.leadTime),
    location: parseText(data.location),
    comments: parseText(data.comments),
    sourceSheetRows: parseSourceSheetRows(data.sourceSheetRows),
    isCurrent: data.isCurrent === true,
    calcM2: data.calcM2 === true,
    calculatedM2: parseCalculatedM2(data.calculatedM2),
    supplierCount,
    primarySupplier,
  };
}
