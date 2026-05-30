import { normalizeLabourHourValue, type LabourHours } from "@/lib/labour-silo";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

function isM2Uom(uom: string): boolean {
  const u = normKey(uom);
  return u === "m2" || u === "m²" || u === "sqm";
}

function isUnitStyleUom(uom: string): boolean {
  const u = normKey(uom);
  if (!u || isM2Uom(u)) return false;
  return true;
}

export function scaleTableLabourHours(
  tableHours: number,
  labourUom: string,
  custommeasure: number | null,
  lineUom: string,
): number | null {
  if (!(tableHours > 0) && tableHours !== 0) return normalizeLabourHourValue(tableHours);
  const measure =
    custommeasure != null && Number.isFinite(custommeasure) && custommeasure > 0
      ? custommeasure
      : null;
  const rateUom = labourUom.trim() || lineUom.trim();
  if (isM2Uom(rateUom)) {
    if (measure == null) return normalizeLabourHourValue(tableHours);
    return normalizeLabourHourValue(tableHours * measure);
  }
  if (isUnitStyleUom(rateUom) || isUnitStyleUom(lineUom)) {
    if (measure == null) return normalizeLabourHourValue(tableHours);
    return normalizeLabourHourValue(tableHours * measure);
  }
  return normalizeLabourHourValue(tableHours);
}

/** Scale object labour rate row hours for a project line measure + UOM. */
export function lookupHoursFromObjectLabourRate(
  rate: DataObjectLabourRatePublic,
  custommeasure: number | null,
  lineUom: string,
): Pick<
  LabourHours,
  | "constructionAssistantHours"
  | "leadContractorHours"
  | "electricianHours"
  | "plumberHours"
> {
  const uom = rate.uom || lineUom;
  return {
    constructionAssistantHours: scaleTableLabourHours(
      rate.constructionAssistant,
      uom,
      custommeasure,
      lineUom,
    ),
    leadContractorHours: scaleTableLabourHours(
      rate.leadContractor,
      uom,
      custommeasure,
      lineUom,
    ),
    electricianHours: scaleTableLabourHours(rate.electrician, uom, custommeasure, lineUom),
    plumberHours: scaleTableLabourHours(rate.plumber, uom, custommeasure, lineUom),
  };
}
