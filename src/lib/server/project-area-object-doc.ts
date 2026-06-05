import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import {
  effectiveLineLabourHours,
  labourHoursFromQuoteTemplateData,
} from "@/lib/server/labour-hours";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";

function integerObjectId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function calcTotal(
  custommeasure: number | null | undefined,
  customumprice: number | null | undefined,
  totalprice: number | null | undefined,
): number | null {
  if (custommeasure != null && customumprice != null) return custommeasure * customumprice;
  return totalprice ?? null;
}

function readIncluded(data: DocumentData): boolean {
  return data.included !== false;
}

type LineSource = ProjectAreaObjectPublic["linesource"];

function readLineSource(data: DocumentData): LineSource {
  const s = data.linesource;
  if (s === "scope" || s === "manual" || s === "bundled") return s;
  return "default";
}

function readBundledAppendSlot(v: unknown): 1 | 2 | 3 | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.trim()) : null;
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

function readSystemObjectKind(
  data: DocumentData,
): ProjectAreaObjectPublic["systemObjectKind"] {
  return data.systemObjectKind === "blinds" ? "blinds" : null;
}

/**
 * Maps a Firestore `projectareaobjects` document to the public shape.
 * When `quoteByObjectId` is provided, template labour hours missing on the document
 * inherit from Setup → Quote Objects (same objectid).
 */
export function docToProjectAreaObjectPublic(
  id: string,
  data: DocumentData,
  quoteByObjectId?: Map<number, DocumentData>,
): ProjectAreaObjectPublic {
  const custommeasure = numOrNull(data.custommeasure);
  const customumprice = numOrNull(data.customumprice);
  const linesource = readLineSource(data);
  const oid = integerObjectId(data.objectid);
  const q = oid !== undefined ? quoteByObjectId?.get(oid) : undefined;
  const snapshotObjectname =
    typeof data.objectname === "string" && data.objectname.trim()
      ? data.objectname.trim()
      : null;
  const quoteObjectname = q ? String(q.objectname ?? "").trim() : "";
  const tmpl = labourHoursFromQuoteTemplateData(q);
  const hours = effectiveLineLabourHours(data, tmpl);
  const pad = data.projectAreaDocId;
  return {
    id,
    projectid: Number(data.projectid ?? 0),
    projectAreaDocId: typeof pad === "string" && pad.trim() ? pad.trim() : null,
    objectid: Number(data.objectid ?? 0),
    objectname: snapshotObjectname || quoteObjectname || null,
    areaid: Number(data.areaid ?? 0),
    linesource,
    scopeDocId:
      linesource === "scope" ? String(data.scopeDocId ?? "") || null : null,
    answerid: linesource === "scope" ? String(data.answerid ?? "") || null : null,
    scopeid: numOrNull(data.scopeid) ?? null,
    systemObjectKind: readSystemObjectKind(data),
    blindType: typeof data.blindType === "string" && data.blindType.trim() ? data.blindType.trim() : null,
    blindDropMm: numOrNull(data.blindDropMm) ?? null,
    blindWidthMm: numOrNull(data.blindWidthMm) ?? null,
    blindColour:
      typeof data.blindColour === "string" && data.blindColour.trim()
        ? data.blindColour.trim()
        : null,
    bundledFromLineId:
      typeof data.bundledFromLineId === "string" && data.bundledFromLineId.trim()
        ? data.bundledFromLineId.trim()
        : null,
    bundledAppendSlot: readBundledAppendSlot(data.bundledAppendSlot),
    included: readIncluded(data),
    pricelevelid: numOrNull(data.pricelevelid) ?? null,
    style: typeof data.style === "string" && data.style.trim() ? data.style.trim() : null,
    colour: typeof data.colour === "string" && data.colour.trim() ? data.colour.trim() : null,
    skuId: typeof data.skuId === "string" && data.skuId.trim() ? data.skuId.trim() : null,
    skuProduct:
      typeof data.skuProduct === "string" && data.skuProduct.trim() ? data.skuProduct.trim() : null,
    scopeShowAllSku: data.scopeShowAllSku === true,
    scopeNoCharge: data.scopeNoCharge === true,
    supplierOption: (() => {
      const n =
        typeof data.supplierOption === "number"
          ? data.supplierOption
          : typeof data.supplierOption === "string" && data.supplierOption.trim()
            ? Number(data.supplierOption.trim())
            : null;
      return isValidSupplierOption(n) ? n : null;
    })(),
    dateadded: tsToIso(data.dateadded as Timestamp | undefined),
    custommeasure,
    customuom: String(data.customuom ?? ""),
    customumprice,
    totalprice: calcTotal(custommeasure, customumprice, numOrNull(data.totalprice)),
    notes1: String(data.notes1 ?? ""),
    notes2: String(data.notes2 ?? ""),
    tooltip: String(data.tooltip ?? ""),
    constructionAssistantHours: hours.constructionAssistantHours,
    leadContractorHours: hours.leadContractorHours,
    electricianHours: hours.electricianHours,
    plumberHours: hours.plumberHours,
    generalHours: hours.generalHours,
    projectManagerHours: hours.projectManagerHours,
    paintingHours: hours.paintingHours,
    plasteringHours: hours.plasteringHours,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
