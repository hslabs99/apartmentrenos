import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { matchesScopeInstance } from "@/lib/scope-instance";
import {
  measureLockedByScopeMetricInherit,
  resolveScopeLineInheritMeasureLocked,
  resolveScopeLineInheritMeasureSource,
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
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { resolveEffectivePriceLevelId } from "@/lib/server/resolve-effective-price-level";
import { loadProjectDimensionsByProjectId } from "@/lib/server/project-dimensions";
import { loadQuoteByObjectIdMap } from "@/lib/server/project-area-seeding";
import { primarySupplierPriceExcGst } from "@/lib/server/materialize-line-sku";
import { loadSkuCalcM2Fields } from "@/lib/server/sku-calc-m2-fields";
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

export function upsertScopeMetricValue(
  current: ProjectAreaScopeMetricValuePublic[],
  entry: ProjectAreaScopeMetricValuePublic,
): ProjectAreaScopeMetricValuePublic[] {
  const scopeDocId = entry.scopeDocId.trim();
  const metricid = entry.metricid.trim();
  const inst = entry.scopeInstanceId?.trim() || null;
  const next = current.filter(
    (v) =>
      !(
        v.scopeDocId === scopeDocId &&
        matchesScopeInstance(v.scopeInstanceId, inst) &&
        v.metricid === metricid
      ),
  );
  next.push({
    scopeDocId,
    scopeInstanceId: inst,
    metricid,
    value: entry.value ?? null,
  });
  return next;
}

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
): Promise<{ updated: number }> {
  const paSnap = await db.collection("projectareas").doc(projectAreaDocId).get();
  if (!paSnap.exists) return { updated: 0 };
  const pa = paSnap.data() as DocumentData;
  const projectid = Number(pa.projectid);
  if (!Number.isInteger(projectid)) return { updated: 0 };

  const scopeSnap = await db.collection("scopes").doc(scopeDocId.trim()).get();
  const scopeData = scopeSnap.exists ? scopeSnap.data()! : null;
  const scopeForResolve: Pick<ScopePublic, "answers" | "scopeMetrics"> = {
    answers: firestoreAnswersToPublic(scopeData?.answers),
    scopeMetrics: scopeMetrics.length
      ? scopeMetrics
      : firestoreScopeMetricsToPublic(scopeData?.scopeMetrics),
  };

  let quoteObjectsForResolve: QuoteObjectPublic[] = [];
  const quoteSnap = await db.collection("quote_objects").get();
  for (const doc of quoteSnap.docs) {
    if (isQuoteObjectsMetaDocument(doc.id)) continue;
    quoteObjectsForResolve.push(docToQuoteObjectPublic(doc.id, doc.data()));
  }

  const areaM2 = numOrNull(pa.aream2);
  const projDims = await loadProjectDimensionsByProjectId(db, projectid);
  const areaPl = await resolveEffectivePriceLevelId(db, projectAreaDocId, projectid);
  const quoteByObjectId = await loadQuoteByObjectIdMap(db);
  const metricMap = scopeMetricValuesMap(scopeMetricValues);

  const lines = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();

  let updated = 0;
  const batch = db.batch();
  for (const doc of lines.docs) {
    const data = doc.data();
    if (String(data.linesource ?? "") !== "scope") continue;
    if (String(data.scopeDocId ?? "") !== scopeDocId.trim()) continue;
    if (!matchesScopeInstance(data.scopeInstanceId as string | null | undefined, scopeInstanceId)) {
      continue;
    }
    const objectid = numOrNull(data.objectid);
    if (objectid == null || !Number.isInteger(objectid)) continue;
    const q = quoteByObjectId.get(objectid);
    const pricing = quoteTemplatePricingForPriceLevel(q, areaPl);
    const measureCtx = {
      areaM2,
      apartmentTotalM2: projDims.apartmentTotalM2,
      apartmentHardM2: projDims.apartmentHardM2,
      apartmentSoftM2: projDims.apartmentSoftM2,
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
    const skuCalcM2 = await loadSkuCalcM2Fields(db, skuId || null);
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
