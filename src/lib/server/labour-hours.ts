import type { DocumentData, Firestore } from "firebase-admin/firestore";
import {
  DATA_OBJECTLABOURRATES_COLLECTION,
  isDataObjectlabourratesMetaDocument,
} from "@/lib/firestore/data-objectlabourrates-collection";
import {
  DATA_LABOURRATES_COLLECTION,
  isDataLabourratesMetaDocument,
} from "@/lib/firestore/data-labourrates-collection";
import {
  emptyLabourHours,
  isLabourLookupManuallyOverridden,
  LABOUR_SILO_KEYS,
  LOOKUP_LABOUR_SILO_KEYS,
  normalizeLabourHourValue,
  readLabourLookupManualOverrides,
  TEMPLATE_LABOUR_SILO_KEYS,
  type LabourHours,
  type LabourLookupManualOverrides,
  type LabourSiloKey,
} from "@/lib/labour-silo";
import {
  contractLabourRateBySiloProduct,
  findObjectLabourRateByObjectName,
  labourSiloCostExcGst,
  skuProductForObjectLabourLookup,
  type ObjectLabourLookup,
} from "@/lib/labour-rate-lookup";
import { dataObjectLabourRateDocToPublic } from "@/lib/server/data-object-labour-rate-doc";
import { dataLabourRateDocToPublic } from "@/lib/server/data-labour-rate-doc";
import { lookupHoursFromObjectLabourRate } from "@/lib/labour-hours-scale";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

export { contractLabourRateBySiloProduct, findObjectLabourRateByObjectName, labourSiloCostExcGst };
export type { ObjectLabourLookup };
export { lookupHoursFromObjectLabourRate } from "@/lib/labour-hours-scale";

export function labourHoursFromQuoteTemplateData(q: DocumentData | undefined): LabourHours {
  if (!q) return emptyLabourHours();
  const pick = (k: LabourSiloKey): number | null =>
    normalizeLabourHourValue(
      typeof q[k] === "number" && Number.isFinite(q[k]) ? (q[k] as number) : null,
    );
  return {
    constructionAssistantHours: null,
    leadContractorHours: null,
    electricianHours: null,
    plumberHours: null,
    generalHours: pick("generalHours"),
    projectManagerHours: pick("projectManagerHours"),
    paintingHours: pick("paintingHours"),
    plasteringHours: pick("plasteringHours"),
  };
}

const LINE_LABOUR_KEYS = [...LABOUR_SILO_KEYS] as const;

export function effectiveLineLabourHours(
  lineData: DocumentData,
  template: LabourHours,
): LabourHours {
  const pick = (k: LabourSiloKey): number | null => {
    if (!Object.prototype.hasOwnProperty.call(lineData, k)) return template[k];
    const v = lineData[k];
    if (v === null) return null;
    return normalizeLabourHourValue(typeof v === "number" ? v : null);
  };
  const out = emptyLabourHours();
  for (const k of LINE_LABOUR_KEYS) out[k] = pick(k);
  return out;
}

export type ApplyProjectLineLabourArgs = {
  objectName: string;
  /** SKU product on the line — narrows object labour rows with a set Product column. */
  skuProduct?: string | null;
  quoteTemplate: DocumentData | undefined;
  objectLabourRates: DataObjectLabourRatePublic[];
  custommeasure: number | null;
  lineUom: string;
  /** Explicit overrides from POST body (template silos only). */
  templateOverrides?: Partial<Pick<LabourHours, (typeof TEMPLATE_LABOUR_SILO_KEYS)[number]>>;
  lookupOverrides?: Partial<
    Pick<LabourHours, (typeof LOOKUP_LABOUR_SILO_KEYS)[number]>
  >;
};

export type ApplyProjectLineLabourResult = {
  hours: LabourHours;
  objectLabourDuplicate: boolean;
};

export function applyProjectLineLabourHours(
  args: ApplyProjectLineLabourArgs,
): ApplyProjectLineLabourResult {
  const tmpl = labourHoursFromQuoteTemplateData(args.quoteTemplate);
  const { row, duplicateMatch } = findObjectLabourRateByObjectName(
    args.objectLabourRates,
    args.objectName,
    args.skuProduct,
  );

  let lookup = emptyLabourHours();
  if (row) {
    const scaled = lookupHoursFromObjectLabourRate(row, args.custommeasure, args.lineUom);
    lookup = { ...lookup, ...scaled };
  }

  if (args.lookupOverrides) {
    for (const k of LOOKUP_LABOUR_SILO_KEYS) {
      if (args.lookupOverrides[k] !== undefined) {
        lookup[k] = normalizeLabourHourValue(args.lookupOverrides[k]);
      }
    }
  }

  const hours = emptyLabourHours();
  for (const k of LOOKUP_LABOUR_SILO_KEYS) hours[k] = lookup[k];
  for (const k of TEMPLATE_LABOUR_SILO_KEYS) {
    hours[k] =
      args.templateOverrides?.[k] !== undefined
        ? normalizeLabourHourValue(args.templateOverrides[k])
        : tmpl[k];
  }

  return { hours, objectLabourDuplicate: duplicateMatch };
}

export function recalcLookupLabourHoursOnLine(
  lineData: DocumentData,
  objectName: string,
  objectLabourRates: DataObjectLabourRatePublic[],
  custommeasure: number | null,
  lineUom: string,
  skuProduct?: string | null,
  manualOverrides?: LabourLookupManualOverrides | null,
): { patch: Partial<LabourHours>; objectLabourDuplicate: boolean } {
  // Rates not loaded — do not clear existing hours.
  if (objectLabourRates.length === 0) {
    return { patch: {}, objectLabourDuplicate: false };
  }
  const overrides =
    manualOverrides ?? readLabourLookupManualOverrides(lineData.labourLookupManualOverrides);
  const skuForLookup = skuProductForObjectLabourLookup({
    linesource: typeof lineData.linesource === "string" ? lineData.linesource : null,
    skuId: typeof lineData.skuId === "string" ? lineData.skuId : null,
    skuProduct:
      skuProduct !== undefined
        ? skuProduct?.trim() || null
        : String(lineData.skuProduct ?? "").trim() || null,
  });
  const { row, duplicateMatch } = findObjectLabourRateByObjectName(
    objectLabourRates,
    objectName,
    skuForLookup,
  );
  const patch: Partial<LabourHours> = {};
  if (!row) {
    for (const k of LOOKUP_LABOUR_SILO_KEYS) {
      if (!isLabourLookupManuallyOverridden(overrides, k)) patch[k] = null;
    }
    return { patch, objectLabourDuplicate: duplicateMatch };
  }
  const scaled = lookupHoursFromObjectLabourRate(row, custommeasure, lineUom);
  for (const k of LOOKUP_LABOUR_SILO_KEYS) {
    if (!isLabourLookupManuallyOverridden(overrides, k)) {
      patch[k] = scaled[k];
    }
  }
  return { patch, objectLabourDuplicate: duplicateMatch };
}

export async function loadAllObjectLabourRates(
  db: Firestore,
): Promise<DataObjectLabourRatePublic[]> {
  const snap = await db.collection(DATA_OBJECTLABOURRATES_COLLECTION).get();
  return snap.docs
    .filter((d) => !isDataObjectlabourratesMetaDocument(d.id))
    .map((d) => dataObjectLabourRateDocToPublic(d.id, d.data()))
    .sort((a, b) => a.productType.localeCompare(b.productType));
}

export async function loadAllContractLabourRates(
  db: Firestore,
): Promise<DataLabourRatePublic[]> {
  const snap = await db.collection(DATA_LABOURRATES_COLLECTION).get();
  return snap.docs
    .filter((d) => !isDataLabourratesMetaDocument(d.id))
    .map((d) => dataLabourRateDocToPublic(d.id, d.data()));
}

export function labourHoursToFirestore(hours: LabourHours): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const k of LABOUR_SILO_KEYS) out[k] = hours[k];
  return out;
}
