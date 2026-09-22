import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { matchesScopeInstance } from "@/lib/scope-instance";
import {
  measureLockedByScopeMetricInherit,
  resolveScopeLineInheritMeasureLocked,
  resolveScopeLineInheritMeasureSource,
  resolveScopeMetricIdFromInherit,
} from "@/lib/inherit-m2-source";
import { scopeMetricValuesMap } from "@/lib/inherit-m2-source";
import {
  effectiveMeasureForLinePricing,
  numOrNull,
  quoteTemplatePricingForPriceLevel,
  docToQuoteObjectPublic,
} from "@/lib/server/quote-object-doc";
import {
  firestoreAnswersToPublic,
  firestoreScopeMetricsToPublic,
} from "@/lib/server/scope-doc";
import { effectivePriceLevelIdFromData } from "@/lib/server/resolve-effective-price-level";
import { loadProjectDimensionsByProjectId } from "@/lib/server/project-dimensions";
import { loadLmRunsRollWidthMFromDb } from "@/lib/server/load-lm-runs-roll-width";
import { loadQuoteDocsByIds, loadQuoteMapForNumericObjectIds } from "@/lib/server/project-area-seeding";
import { primarySupplierPriceExcGst } from "@/lib/server/materialize-line-sku";
import { loadSkuCalcM2FieldsBySkuIds } from "@/lib/server/sku-calc-m2-fields";
import type { ProjectAreaScopeMetricValuePublic } from "@/types/scope-metric";
import type { ScopeMetricPublic } from "@/types/scope-metric";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

export function parseScopeMetricValuesFromFirestore(
  raw: unknown,
): ProjectAreaScopeMetricValuePublic[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectAreaScopeMetricValuePublic[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const scopeDocId = String(rec.scopeDocId ?? "").trim();
    const metricid = String(rec.metricid ?? "").trim();
    if (!scopeDocId || !metricid) continue;
    const scopeInstanceIdRaw = rec.scopeInstanceId;
    const scopeInstanceId =
      typeof scopeInstanceIdRaw === "string" && scopeInstanceIdRaw.trim()
        ? scopeInstanceIdRaw.trim()
        : null;
    const value = numOrNull(rec.value) ?? null;
    out.push({ scopeDocId, scopeInstanceId, metricid, value });
  }
  return out;
}

export { upsertScopeMetricValue } from "@/lib/scope-metrics";

/** Drop metric values for a scope instance that are not visible for the chosen answer. */
export function pruneScopeMetricValuesForAnswer(
  current: ProjectAreaScopeMetricValuePublic[],
  scopeDocId: string,
  scopeInstanceId: string | null | undefined,
  scopeMetrics: ScopeMetricPublic[],
  answerid: string | null,
): ProjectAreaScopeMetricValuePublic[] {
  const docId = scopeDocId.trim();
  const visible = answerid
    ? new Set(
        scopeMetrics
          .filter((m) => m.answerids.includes(answerid))
          .map((m) => m.metricid),
      )
    : new Set<string>();
  return current.filter((v) => {
    if (v.scopeDocId !== docId) return true;
    if (!matchesScopeInstance(v.scopeInstanceId, scopeInstanceId)) return true;
    return visible.has(v.metricid);
  });
}

export async function repriceScopeInstanceLines(
  db: Firestore,
  projectAreaDocId: string,
  scopeDocId: string,
  scopeInstanceId: string | null | undefined,
  scopeMetrics: ScopeMetricPublic[],
  scopeMetricValues: ProjectAreaScopeMetricValuePublic[],
  opts?: {
    metricid?: string;
    paData?: DocumentData;
    scopeData?: DocumentData | null;
  },
): Promise<{ updated: number }> {
  const pa =
    opts?.paData ??
    ((await db.collection("projectareas").doc(projectAreaDocId).get()).data() as
      | DocumentData
      | undefined);
  if (!pa) return { updated: 0 };
  const projectid = Number(pa.projectid);
  if (!Number.isInteger(projectid)) return { updated: 0 };

  let scopeData = opts?.scopeData;
  if (scopeData === undefined) {
    const scopeSnap = await db.collection("scopes").doc(scopeDocId.trim()).get();
    scopeData = scopeSnap.exists ? scopeSnap.data()! : null;
  }
  const scopeForResolve: Pick<ScopePublic, "answers" | "scopeMetrics"> = {
    answers: firestoreAnswersToPublic(scopeData?.answers),
    scopeMetrics: scopeMetrics.length
      ? scopeMetrics
      : firestoreScopeMetricsToPublic(scopeData?.scopeMetrics),
  };

  const lines = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();

  const instanceLines = lines.docs.filter((doc) => {
    const data = doc.data();
    if (String(data.linesource ?? "") !== "scope") return false;
    if (String(data.scopeDocId ?? "") !== scopeDocId.trim()) return false;
    return matchesScopeInstance(
      data.scopeInstanceId as string | null | undefined,
      scopeInstanceId,
    );
  });
  if (instanceLines.length === 0) return { updated: 0 };

  const quoteDocIds = new Set<string>();
  for (const answer of scopeForResolve.answers) {
    for (const id of answer.attachedQuoteObjectIds ?? []) {
      const trimmed = id.trim();
      if (trimmed) quoteDocIds.add(trimmed);
    }
  }
  const quoteDocs = await loadQuoteDocsByIds(db, quoteDocIds);
  const quoteObjectsForResolve: QuoteObjectPublic[] = [];
  const quoteByObjectId = new Map<number, DocumentData>();
  for (const [id, data] of quoteDocs) {
    quoteObjectsForResolve.push(docToQuoteObjectPublic(id, data));
    const objectid = numOrNull(data.objectid);
    if (objectid != null && Number.isInteger(objectid)) quoteByObjectId.set(objectid, data);
  }
  const extraQuotes = await loadQuoteMapForNumericObjectIds(
    db,
    instanceLines.map((doc) => numOrNull(doc.data().objectid)),
  );
  for (const [objectid, data] of extraQuotes) {
    if (!quoteByObjectId.has(objectid)) quoteByObjectId.set(objectid, data);
  }

  const metricFilter = opts?.metricid?.trim() ?? "";
  const matching = instanceLines.filter((doc) => {
    if (!metricFilter) return true;
    const data = doc.data();
    const objectid = numOrNull(data.objectid);
    if (objectid == null || !Number.isInteger(objectid)) return false;
    const inherit = resolveScopeLineInheritMeasureSource(
      {
        linesource: "scope",
        scopeDocId: scopeDocId.trim(),
        answerid: String(data.answerid ?? ""),
        objectid,
      },
      scopeForResolve as ScopePublic,
      quoteObjectsForResolve,
    );
    return resolveScopeMetricIdFromInherit(inherit) === metricFilter;
  });
  if (matching.length === 0) return { updated: 0 };

  const skuCalcById = await loadSkuCalcM2FieldsBySkuIds(
    db,
    matching.map((doc) => String(doc.data().skuId ?? "")),
  );

  const areaM2 = numOrNull(pa.aream2);
  const [projDims, projSnap, lmRunsRollWidthFallback] = await Promise.all([
    loadProjectDimensionsByProjectId(db, projectid),
    db.collection("projects").where("projectid", "==", projectid).limit(1).get(),
    loadLmRunsRollWidthMFromDb(db),
  ]);
  const areaPl = effectivePriceLevelIdFromData(pa, projSnap.docs[0]?.data());
  const metricMap = scopeMetricValuesMap(scopeMetricValues);

  let updated = 0;
  const batch = db.batch();
  for (const doc of matching) {
    const data = doc.data();
    const objectid = numOrNull(data.objectid);
    if (objectid == null || !Number.isInteger(objectid)) continue;
    const q = quoteByObjectId.get(objectid);
    const pricing = quoteTemplatePricingForPriceLevel(q, areaPl);
    const measureCtx = {
      areaM2,
      apartmentTotalM2: projDims.apartmentTotalM2,
      apartmentHardM2: projDims.apartmentHardM2,
      apartmentSoftM2: projDims.apartmentSoftM2,
      lmRunsRollWidthFallback,
    };
    const storedMeasure = numOrNull(data.custommeasure);
    const lineInheritCtx = {
      linesource: "scope" as const,
      scopeDocId: scopeDocId.trim(),
      answerid: String(data.answerid ?? ""),
      objectid,
    };
    const scopeInheritMeasureSource = resolveScopeLineInheritMeasureSource(
      lineInheritCtx,
      scopeForResolve as ScopePublic,
      quoteObjectsForResolve,
    );
    const scopeInheritMeasureLocked = resolveScopeLineInheritMeasureLocked(
      lineInheritCtx,
      scopeForResolve as ScopePublic,
      quoteObjectsForResolve,
    );
    const skuId = String(data.skuId ?? "").trim();
    const skuCalcM2 = skuId ? (skuCalcById.get(skuId) ?? null) : null;
    const measureForPricing = effectiveMeasureForLinePricing(
      q,
      pricing.measurement,
      measureCtx,
      storedMeasure,
      scopeInheritMeasureSource,
      metricMap,
      scopeForResolve.scopeMetrics ?? scopeMetrics,
      skuCalcM2,
      scopeInheritMeasureLocked,
    );
    let customumprice = numOrNull(data.customumprice) ?? pricing.customumprice;
    if (customumprice == null && skuId && data.scopeNoCharge !== true) {
      const fromSupplier = await primarySupplierPriceExcGst(db, skuId);
      if (fromSupplier != null) customumprice = fromSupplier;
    }
    let totalprice: number | null;
    if (data.scopeNoCharge === true) {
      totalprice = 0;
    } else if (measureForPricing != null && customumprice != null) {
      totalprice = measureForPricing * customumprice;
    } else {
      totalprice = pricing.totalprice;
    }
    const patch: Record<string, unknown> = {
      totalprice,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (
      measureLockedByScopeMetricInherit(
        scopeInheritMeasureSource,
        scopeInheritMeasureLocked,
      )
    ) {
      patch.custommeasure = null;
    }
    if (customumprice != null && numOrNull(data.customumprice) == null && skuId) {
      patch.customumprice = customumprice;
    }
    batch.update(doc.ref, patch);
    updated += 1;
  }
  if (updated > 0) await batch.commit();
  return { updated };
}

export function loadScopeMetricsFromScopeDoc(scopeData: DocumentData): ScopeMetricPublic[] {
  return firestoreScopeMetricsToPublic(scopeData.scopeMetrics);
}
