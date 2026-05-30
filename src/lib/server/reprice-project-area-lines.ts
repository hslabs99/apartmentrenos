import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import {
  effectiveMeasurementForQuoteLine,
  numOrNull,
  quoteTemplatePricingForPriceLevel,
} from "@/lib/server/quote-object-doc";
import { loadQuoteByObjectIdMap } from "@/lib/server/project-area-seeding";
import { loadProjectDimensionsByProjectId } from "@/lib/server/project-dimensions";
import {
  resolveEffectivePriceLevelId,
  resolveLineEffectivePriceLevelId,
} from "@/lib/server/resolve-effective-price-level";

/** Unit price and line total from quote template + area tier + optional line `pricelevelid` override. */
export function projectAreaLineTierPrices(args: {
  lineData: DocumentData;
  quoteData: DocumentData | undefined;
  areaEffectivePriceLevelId: number | null;
  /** Checklist area m²; used when the quote object inherits area M2 and the line has no measure. */
  areaM2?: number | null;
  apartmentTotalM2?: number | null;
  apartmentHardM2?: number | null;
  apartmentSoftM2?: number | null;
}): { customumprice: number | null; totalprice: number | null } {
  const {
    lineData,
    quoteData,
    areaEffectivePriceLevelId,
    areaM2,
    apartmentTotalM2,
    apartmentHardM2,
    apartmentSoftM2,
  } = args;
  const lineOverride = numOrNull(lineData.pricelevelid);
  const pl = resolveLineEffectivePriceLevelId(areaEffectivePriceLevelId, lineOverride);
  const pricing = quoteTemplatePricingForPriceLevel(quoteData, pl);
  const templateMeasure = effectiveMeasurementForQuoteLine(
    quoteData,
    pricing.measurement,
    { areaM2, apartmentTotalM2, apartmentHardM2, apartmentSoftM2 },
  );
  const existingMeasure = numOrNull(lineData.custommeasure);
  const custommeasure =
    existingMeasure != null ? existingMeasure : templateMeasure;
  const customumprice = pricing.customumprice;
  let totalprice: number | null;
  if (custommeasure != null && customumprice != null) {
    totalprice = custommeasure * customumprice;
  } else {
    totalprice = pricing.totalprice;
  }
  return { customumprice, totalprice };
}

function integerObjectId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

/**
 * Re-applies quote_object tier pricing to every line in a project area instance (`projectAreaDocId`).
 * Keeps each line's current measure when set; updates unit price and line total from the effective tier.
 */
export async function repriceProjectAreaLinesForEffectiveTier(
  db: Firestore,
  projectAreaDocId: string,
): Promise<{ updated: number }> {
  const paSnap = await db.collection("projectareas").doc(projectAreaDocId).get();
  if (!paSnap.exists) return { updated: 0 };
  const pa = paSnap.data() as DocumentData;
  const projectid = Number(pa.projectid);
  if (!Number.isInteger(projectid)) return { updated: 0 };

  const areaM2 = numOrNull(pa.aream2);
  const projDims = await loadProjectDimensionsByProjectId(db, projectid);

  const areaPl = await resolveEffectivePriceLevelId(db, projectAreaDocId, projectid);
  const quoteByObjectId = await loadQuoteByObjectIdMap(db);

  const lines = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();

  let updated = 0;
  const BATCH_MAX = 400;
  for (let i = 0; i < lines.docs.length; i += BATCH_MAX) {
    const slice = lines.docs.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const doc of slice) {
      const data = doc.data();
      const objectid = integerObjectId(data.objectid);
      if (objectid === undefined) continue;
      const q = quoteByObjectId.get(objectid);
      const { customumprice, totalprice } = projectAreaLineTierPrices({
        lineData: data,
        quoteData: q,
        areaEffectivePriceLevelId: areaPl,
        areaM2,
        apartmentTotalM2: projDims.apartmentTotalM2,
        apartmentHardM2: projDims.apartmentHardM2,
        apartmentSoftM2: projDims.apartmentSoftM2,
      });
      batch.update(doc.ref, {
        customumprice,
        totalprice,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated += 1;
    }
    await batch.commit();
  }

  return { updated };
}
