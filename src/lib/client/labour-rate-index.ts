import {
  contractLabourRateBySiloProduct,
  findObjectLabourRateByObjectName,
} from "@/lib/labour-rate-lookup";
import {
  LABOUR_RATE_MISSING_TOOLTIP,
  OBJECT_LABOUR_DUPLICATE_TOOLTIP,
  type LabourSiloKey,
} from "@/lib/labour-silo";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

export type LabourSiloCellWarning = {
  missingRate: boolean;
  duplicateObjectLabour: boolean;
};

export function labourSiloCellWarning(
  hours: number | null,
  siloKey: LabourSiloKey,
  contractRates: DataLabourRatePublic[],
  objectLabourDuplicate: boolean,
): LabourSiloCellWarning {
  return {
    missingRate: hours != null && contractLabourRateBySiloProduct(contractRates, siloKey) == null,
    duplicateObjectLabour: objectLabourDuplicate,
  };
}

export function labourSiloWarningTitle(w: LabourSiloCellWarning): string | undefined {
  const parts: string[] = [];
  if (w.duplicateObjectLabour) parts.push(OBJECT_LABOUR_DUPLICATE_TOOLTIP);
  if (w.missingRate) parts.push(LABOUR_RATE_MISSING_TOOLTIP);
  return parts.length ? parts.join(" ") : undefined;
}

export function objectLabourDuplicateForName(
  objectLabourRates: DataObjectLabourRatePublic[],
  objectName: string,
): boolean {
  return findObjectLabourRateByObjectName(objectLabourRates, objectName).duplicateMatch;
}

export { OBJECT_LABOUR_DUPLICATE_TOOLTIP, LABOUR_RATE_MISSING_TOOLTIP };
