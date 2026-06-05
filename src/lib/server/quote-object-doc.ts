import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import { parseProductFromDoc } from "@/lib/legacy-product-field";
import { labourHoursFromQuoteTemplateData } from "@/lib/server/labour-hours";
import type {
  QuoteObjectInheritM2Source,
  QuoteObjectPriceLevelRowPublic,
  QuoteObjectPublic,
} from "@/types/quote-object";

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

export function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

/** UOM for carpet-style lineal metres from area m² and roll width. */
export const LM_RUNS_UOM = "LM-Runs";
export const DEFAULT_LM_RUNS_RUN_WIDTH = 3.2;

/**
 * Rough LM for carpet: assume square room side = √areaM², strips across width =
 * ceil(side / runWidth), LM = strips × side.
 */
export function linearMetersFromAreaM2ForLmRuns(
  areaM2: number,
  runWidth: number,
): number | null {
  if (!(areaM2 > 0) || !(runWidth > 0)) return null;
  const side = Math.sqrt(areaM2);
  const strips = Math.ceil(side / runWidth);
  const lm = strips * side;
  return Math.round(lm * 100) / 100;
}

function effectiveLmRunsRollWidthM(quoteData: DocumentData): number {
  const rw = numOrNull(quoteData.runWidth);
  if (rw != null && rw > 0) return rw;
  return DEFAULT_LM_RUNS_RUN_WIDTH;
}

/** Resolve inherit source from Firestore quote_object (incl. legacy `inheritAreaM2`). */
export function normalizeInheritM2SourceFromDoc(
  quoteData: DocumentData | undefined,
): QuoteObjectInheritM2Source {
  if (!quoteData) return "none";
  const uom = String(quoteData.uom ?? "").trim();
  if (uom !== "M2" && uom !== LM_RUNS_UOM) return "none";
  const srcRaw = String(quoteData.inheritM2Source ?? "").trim();
  if (
    srcRaw === "apartment_total_m2" ||
    srcRaw === "apartment_soft_m2" ||
    srcRaw === "apartment_hard_m2" ||
    srcRaw === "area_m2" ||
    srcRaw === "none"
  ) {
    return srcRaw;
  }
  return quoteData.inheritAreaM2 === true ? "area_m2" : "none";
}

export function quoteObjectUsesInheritedM2(quoteData: DocumentData | undefined): boolean {
  return normalizeInheritM2SourceFromDoc(quoteData) !== "none";
}

/**
 * Stored line measure when materializing a project line. When the template inherits m²,
 * leave `custommeasure` null so checklist keeps resolving from project / area m².
 */
export function customMeasureForNewProjectLine(
  quoteData: DocumentData | undefined,
  templateMeasurement: number | null,
  ctx: {
    areaM2?: number | null;
    apartmentTotalM2?: number | null;
    apartmentSoftM2?: number | null;
    apartmentHardM2?: number | null;
  },
  explicitCustomMeasure?: number | null,
): number | null {
  if (explicitCustomMeasure !== undefined) return explicitCustomMeasure;
  if (quoteObjectUsesInheritedM2(quoteData)) return null;
  return effectiveMeasurementForQuoteLine(quoteData, templateMeasurement, ctx);
}

/** Measure for pricing totals: explicit line override, else inherited / template quantity. */
export function effectiveMeasureForLinePricing(
  quoteData: DocumentData | undefined,
  templateMeasurement: number | null,
  ctx: {
    areaM2?: number | null;
    apartmentTotalM2?: number | null;
    apartmentSoftM2?: number | null;
    apartmentHardM2?: number | null;
  },
  storedCustomMeasure: number | null | undefined,
): number | null {
  if (storedCustomMeasure != null) return storedCustomMeasure;
  return effectiveMeasurementForQuoteLine(quoteData, templateMeasurement, ctx);
}

export function calcTotal(
  measurement: number | null | undefined,
  uomprice: number | null | undefined,
  totalprice: number | null | undefined,
): number | null {
  if (measurement != null && uomprice != null) {
    return measurement * uomprice;
  }
  return totalprice ?? null;
}

export {
  effectiveLineLabourHours,
  labourHoursFromQuoteTemplateData,
} from "@/lib/server/labour-hours";
export { normalizeLabourHourValue as normalizeLoadValue } from "@/lib/labour-silo";

function rowHasAnyData(r: {
  uomprice: number | null;
  totalprice: number | null;
  spec1: string;
  spec2: string;
  spec3: string;
}): boolean {
  return (
    r.uomprice != null ||
    r.totalprice != null ||
    r.spec1.trim() !== "" ||
    r.spec2.trim() !== "" ||
    r.spec3.trim() !== ""
  );
}

/** Parse Firestore `priceLevelRows` (or legacy absent → []). */
export function parsePriceLevelRows(raw: unknown): QuoteObjectPriceLevelRowPublic[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<number, QuoteObjectPriceLevelRowPublic>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const pricelevelid = Number(rec.pricelevelid);
    if (!Number.isInteger(pricelevelid)) continue;
    const uomprice = numOrNull(rec.uomprice) ?? null;
    const totalprice = numOrNull(rec.totalprice) ?? null;
    const row: QuoteObjectPriceLevelRowPublic = {
      pricelevelid,
      uomprice,
      totalprice,
      spec1: String(rec.spec1 ?? ""),
      spec2: String(rec.spec2 ?? ""),
      spec3: String(rec.spec3 ?? ""),
    };
    if (!rowHasAnyData(row)) continue;
    map.set(pricelevelid, row);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
}

/** Lowest pricelevelid row with data; else lowest id row; else null. */
export function representativePriceLevelRow(
  rows: QuoteObjectPriceLevelRowPublic[],
): QuoteObjectPriceLevelRowPublic | null {
  if (rows.length === 0) return null;
  const withData = rows.filter(rowHasAnyData);
  const pool = withData.length > 0 ? withData : rows;
  return pool.reduce((a, b) => (a.pricelevelid <= b.pricelevelid ? a : b));
}

/**
 * Effective line quantity for pricing: M2 + inherit uses checklist `aream2`; `LM-Runs` uses
 * rough carpet LM from `aream2` and `runWidth` when area m² is set, else template measurement.
 * Otherwise returns `templateMeasurement`.
 */
export function effectiveMeasurementForQuoteLine(
  quoteData: DocumentData | undefined,
  templateMeasurement: number | null,
  ctx: {
    areaM2?: number | null;
    apartmentTotalM2?: number | null;
    apartmentSoftM2?: number | null;
    apartmentHardM2?: number | null;
  },
): number | null {
  if (!quoteData) return templateMeasurement;
  const uom = String(quoteData.uom ?? "").trim();
  if (uom === "M2") {
    const src = normalizeInheritM2SourceFromDoc(quoteData);
    if (src === "area_m2") return numOrNull(ctx.areaM2) ?? null;
    if (src === "apartment_total_m2") return numOrNull(ctx.apartmentTotalM2) ?? null;
    if (src === "apartment_soft_m2") return numOrNull(ctx.apartmentSoftM2) ?? null;
    if (src === "apartment_hard_m2") return numOrNull(ctx.apartmentHardM2) ?? null;
    return templateMeasurement;
  }
  if (uom === LM_RUNS_UOM) {
    const rw = effectiveLmRunsRollWidthM(quoteData);
    const src = normalizeInheritM2SourceFromDoc(quoteData);
    const baseM2 =
      src === "area_m2"
        ? numOrNull(ctx.areaM2)
        : src === "apartment_total_m2"
          ? numOrNull(ctx.apartmentTotalM2)
          : src === "apartment_soft_m2"
            ? numOrNull(ctx.apartmentSoftM2)
            : src === "apartment_hard_m2"
              ? numOrNull(ctx.apartmentHardM2)
              : numOrNull(ctx.areaM2);

    if (baseM2 != null && baseM2 > 0) {
      return linearMetersFromAreaM2ForLmRuns(baseM2, rw);
    }
    return templateMeasurement;
  }
  return templateMeasurement;
}

/**
 * Line UOM when materializing a project line. Quote template UOM wins when set (e.g. `LM-Runs`
 * carpet formula); catalog SKU UOM (often plain `LM`) is only used when the template has none.
 */
export function resolveProjectLineCustomUom(
  templateUom: string,
  skuUom: string | null | undefined,
  explicitUom?: string,
): string {
  if (explicitUom !== undefined) return explicitUom;
  const fromTemplate = String(templateUom ?? "").trim();
  if (fromTemplate) return fromTemplate;
  return String(skuUom ?? "").trim();
}

/**
 * Line pricing from a quote_object template for a given price level (project / area).
 * Falls back to legacy top-level fields or representative tier when tier missing.
 */
export function quoteTemplatePricingForPriceLevel(
  q: DocumentData | undefined,
  pricelevelid: number | null | undefined,
): {
  measurement: number | null;
  customuom: string;
  customumprice: number | null;
  totalprice: number | null;
} {
  if (!q) {
    return { measurement: null, customuom: "", customumprice: null, totalprice: null };
  }
  const measurement = numOrNull(q.measurement) ?? null;
  const customuom = String(q.uom ?? "");
  const rows = parsePriceLevelRows(q.priceLevelRows);
  let uomprice: number | null = null;
  let storedTotal: number | null = null;

  if (pricelevelid != null && Number.isInteger(pricelevelid)) {
    const row = rows.find((r) => r.pricelevelid === pricelevelid);
    if (row) {
      uomprice = row.uomprice;
      storedTotal = row.totalprice;
    }
  }

  if (uomprice == null) {
    if (rows.length > 0) {
      const leg = legacyFieldsFromPriceRows(measurement, rows);
      uomprice = leg.uomprice ?? null;
      storedTotal = leg.totalprice ?? null;
    } else {
      uomprice = numOrNull(q.uomprice) ?? null;
      storedTotal = numOrNull(q.totalprice) ?? null;
    }
  }

  const totalprice = calcTotal(measurement, uomprice, storedTotal);
  return { measurement, customuom, customumprice: uomprice, totalprice };
}

export function legacyFieldsFromPriceRows(
  measurement: number | null | undefined,
  rows: QuoteObjectPriceLevelRowPublic[],
): Pick<QuoteObjectPublic, "uomprice" | "totalprice" | "spec1" | "spec2" | "spec3"> {
  const rep = representativePriceLevelRow(rows);
  if (!rep) {
    return {
      uomprice: null,
      totalprice: null,
      spec1: "",
      spec2: "",
      spec3: "",
    };
  }
  const uomprice = rep.uomprice;
  return {
    uomprice,
    totalprice: calcTotal(measurement, uomprice, rep.totalprice),
    spec1: rep.spec1,
    spec2: rep.spec2,
    spec3: rep.spec3,
  };
}

function parseAreaTagIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.trim() !== "") out.push(x);
  }
  return out;
}

export function docToQuoteObjectPublic(id: string, data: DocumentData): QuoteObjectPublic {
  const measurement = numOrNull(data.measurement);
  const priceLevelRows = parsePriceLevelRows(data.priceLevelRows);
  const legacy =
    priceLevelRows.length > 0
      ? legacyFieldsFromPriceRows(measurement, priceLevelRows)
      : {
          uomprice: numOrNull(data.uomprice) ?? null,
          totalprice: calcTotal(
            measurement,
            numOrNull(data.uomprice) ?? null,
            numOrNull(data.totalprice) ?? null,
          ),
          spec1: String(data.spec1 ?? ""),
          spec2: String(data.spec2 ?? ""),
          spec3: String(data.spec3 ?? ""),
        };
  const so = data.sortOrder;
  return {
    id,
    sortOrder: typeof so === "number" && Number.isFinite(so) ? so : null,
    objectid: numOrNull(data.objectid),
    objectname: String(data.objectname ?? ""),
    product: parseProductFromDoc(data),
    objecttype: String(data.objecttype ?? ""),
    category: String(data.category ?? ""),
    areaTagIds: parseAreaTagIds(data.areaTagIds),
    uom: String(data.uom ?? ""),
    inheritM2Source:
      typeof data.inheritM2Source === "string" &&
      (data.inheritM2Source === "none" ||
        data.inheritM2Source === "apartment_total_m2" ||
        data.inheritM2Source === "apartment_soft_m2" ||
        data.inheritM2Source === "apartment_hard_m2" ||
        data.inheritM2Source === "area_m2")
        ? data.inheritM2Source
        : data.inheritAreaM2 === true
          ? "area_m2"
          : "none",
    inheritAreaM2: data.inheritAreaM2 === true,
    runWidth:
      String(data.uom ?? "").trim() === LM_RUNS_UOM
        ? (() => {
            const rw = numOrNull(data.runWidth);
            return rw != null && rw > 0 ? rw : null;
          })()
        : null,
    defaultAreaM2:
      String(data.uom ?? "").trim() === LM_RUNS_UOM
        ? (() => {
            const m = numOrNull(data.defaultAreaM2);
            return m != null && m > 0 ? m : null;
          })()
        : null,
    measurement,
    uomprice: legacy.uomprice,
    totalprice: legacy.totalprice,
    spec1: legacy.spec1,
    spec2: legacy.spec2,
    spec3: legacy.spec3,
    priceLevelRows,
    ...(() => {
      const h = labourHoursFromQuoteTemplateData(data);
      return {
        generalHours: h.generalHours,
        projectManagerHours: h.projectManagerHours,
        paintingHours: h.paintingHours,
        plasteringHours: h.plasteringHours,
      };
    })(),
    notes1: String(data.notes1 ?? ""),
    notes2: String(data.notes2 ?? ""),
    tooltip: String(data.tooltip ?? ""),
    systemObject: String(data.systemObject ?? "").trim() || undefined,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

export type PriceLevelRowInput = {
  pricelevelid: number;
  uomprice?: number | null;
  totalprice?: number | null;
  spec1?: string;
  spec2?: string;
  spec3?: string;
};

/** Normalize client rows → stored array + Firestore top-level pricing fields. */
export function priceRowsAndLegacyTopLevel(
  measurement: number | null | undefined,
  rows: PriceLevelRowInput[],
): {
  priceLevelRows: QuoteObjectPriceLevelRowPublic[];
  firestorePatch: Record<string, unknown>;
} {
  const map = new Map<number, QuoteObjectPriceLevelRowPublic>();
  for (const r of rows) {
    if (!Number.isInteger(r.pricelevelid)) continue;
    const uomprice = r.uomprice !== undefined ? r.uomprice : null;
    const totalprice = r.totalprice !== undefined ? r.totalprice : null;
    const row: QuoteObjectPriceLevelRowPublic = {
      pricelevelid: r.pricelevelid,
      uomprice: uomprice ?? null,
      totalprice: totalprice ?? null,
      spec1: String(r.spec1 ?? ""),
      spec2: String(r.spec2 ?? ""),
      spec3: String(r.spec3 ?? ""),
    };
    if (!rowHasAnyData(row)) continue;
    map.set(r.pricelevelid, row);
  }
  const priceLevelRows = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
  const leg = legacyFieldsFromPriceRows(measurement, priceLevelRows);
  return {
    priceLevelRows,
    firestorePatch: {
      priceLevelRows,
      uomprice: leg.uomprice,
      totalprice: leg.totalprice,
      spec1: leg.spec1,
      spec2: leg.spec2,
      spec3: leg.spec3,
    },
  };
}
