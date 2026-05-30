import type { DocumentData } from "firebase-admin/firestore";
import { BLIND_WIDTH_MM_VALUES, blindWidthFieldName } from "@/lib/google/blinds-width-columns";
import type { BlindWidthField } from "@/lib/google/blinds-width-columns";
import type { DataBlindFooterPublic } from "@/types/data-blind-public";
import type { DataBlindPublic } from "@/types/data-blind-public";
import type { DataBlindTypePublic } from "@/types/data-blind-public";

export function dataBlindDocToPublic(
  docId: string,
  data: DocumentData,
): DataBlindPublic {
  const prices: Partial<Record<BlindWidthField, number>> = {};
  for (const w of BLIND_WIDTH_MM_VALUES) {
    const key = blindWidthFieldName(w);
    const v = data[key];
    if (typeof v === "number" && Number.isFinite(v)) prices[key] = v;
  }

  return {
    id: docId,
    type: String(data.type ?? ""),
    typeSlug: String(data.typeSlug ?? ""),
    dropMm: Number(data.dropMm ?? 0),
    minChainDropMm:
      data.minChainDropMm == null ? null : Number(data.minChainDropMm),
    sourceSheetRow: Number(data.sourceSheetRow ?? 0),
    prices,
  };
}

export function dataBlindTypeDocToPublic(
  docId: string,
  data: DocumentData,
): DataBlindTypePublic {
  return {
    id: docId,
    typeName: String(data.typeName ?? ""),
    typeSlug: String(data.typeSlug ?? docId),
    priceSheetDate: data.priceSheetDate != null ? String(data.priceSheetDate) : null,
    productLabel: String(data.productLabel ?? ""),
    colourMaterial: String(data.colourMaterial ?? ""),
    priceMultiplier:
      data.priceMultiplier == null ? null : Number(data.priceMultiplier),
    gstInclusive: Boolean(data.gstInclusive),
    widthMinMm: data.widthMinMm == null ? null : Number(data.widthMinMm),
    widthMaxMm: data.widthMaxMm == null ? null : Number(data.widthMaxMm),
    hasMinChainDropColumn: Boolean(data.hasMinChainDropColumn),
    sheetGid: Number(data.sheetGid ?? 0),
    headerRow1Based: Number(data.headerRow1Based ?? 0),
    dataStartRow1Based: Number(data.dataStartRow1Based ?? 0),
  };
}

export function dataBlindFooterDocToPublic(
  docId: string,
  data: DocumentData,
): DataBlindFooterPublic {
  return {
    id: docId,
    type: String(data.type ?? ""),
    typeSlug: String(data.typeSlug ?? ""),
    sortOrder: Number(data.sortOrder ?? 0),
    noteText: String(data.noteText ?? ""),
    impactPct: data.impactPct == null ? null : Number(data.impactPct),
    sourceSheetRow: Number(data.sourceSheetRow ?? 0),
  };
}
