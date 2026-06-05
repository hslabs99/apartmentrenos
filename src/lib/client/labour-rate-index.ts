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

/** Object name on the line used to look up Object Labour Rates (trimmed). */
export function objectLabourRatesLookupName(objectName: string): string {
  return objectName.trim();
}

export function objectLabourDuplicateTooltip(
  objectName: string,
  skuProduct?: string | null,
): string {
  const typeKey = objectLabourRatesLookupName(objectName) || "(empty)";
  const sku = skuProduct?.trim();
  const skuPart = sku
    ? ` and SKU product "${sku}" (line skuProduct vs labour Product column)`
    : ` (no SKU product on line — only wildcard Product rows apply)`;
  return (
    `Warning: more than one Object Labour Rate row still matches this line. ` +
    `Match keys: Product Type "${typeKey}"${skuPart}, compared trimmed and case-insensitive. ` +
    `Blank, All, or — on Product means any SKU for that object. Dollar amount uses the first match — dedupe the table.`
  );
}

export function labourSiloWarningTitle(
  w: LabourSiloCellWarning,
  objectLabourMatchName?: string,
  skuProduct?: string | null,
): string | undefined {
  const parts: string[] = [];
  if (w.duplicateObjectLabour) {
    parts.push(
      objectLabourMatchName != null
        ? objectLabourDuplicateTooltip(objectLabourMatchName, skuProduct)
        : OBJECT_LABOUR_DUPLICATE_TOOLTIP,
    );
  }
  if (w.missingRate) parts.push(LABOUR_RATE_MISSING_TOOLTIP);
  return parts.length ? parts.join("\n\n") : undefined;
}

export function objectLabourDuplicateForName(
  objectLabourRates: DataObjectLabourRatePublic[],
  objectName: string,
  skuProduct?: string | null,
): boolean {
  return findObjectLabourRateByObjectName(
    objectLabourRates,
    objectName,
    skuProduct,
  ).duplicateMatch;
}

export { OBJECT_LABOUR_DUPLICATE_TOOLTIP, LABOUR_RATE_MISSING_TOOLTIP };
