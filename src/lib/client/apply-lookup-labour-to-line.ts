import { findObjectLabourRateByObjectName } from "@/lib/labour-rate-lookup";
import { lookupHoursFromObjectLabourRate } from "@/lib/labour-hours-scale";
import { LOOKUP_LABOUR_SILO_KEYS } from "@/lib/labour-silo";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

/**
 * Recompute lookup silo hours from cached object labour rates (client-side preview).
 */
export function applyLookupLabourToProjectLine(
  line: ProjectAreaObjectPublic,
  custommeasure: number | null,
  objectName: string,
  objectLabourRates: DataObjectLabourRatePublic[],
  lineUom?: string,
): ProjectAreaObjectPublic {
  const uom = lineUom ?? line.customuom ?? "";
  const { row } = findObjectLabourRateByObjectName(objectLabourRates, objectName);
  if (!row) {
    const cleared = { ...line, custommeasure };
    for (const k of LOOKUP_LABOUR_SILO_KEYS) cleared[k] = null;
    return cleared;
  }
  const scaled = lookupHoursFromObjectLabourRate(row, custommeasure, uom);
  return {
    ...line,
    custommeasure,
    customuom: uom,
    ...scaled,
  };
}
