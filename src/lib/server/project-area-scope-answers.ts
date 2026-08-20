import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import { readTooltipFromQuoteObjectData } from "@/lib/server/area-object-tooltip";
import { resolveEffectivePriceLevelId } from "@/lib/server/resolve-effective-price-level";
import { resolveEffectiveStyleColour } from "@/lib/server/resolve-effective-style-colour";
import { resolveEffectiveElevateLevel } from "@/lib/server/resolve-effective-elevate-level";
import { primarySupplierPriceExcGst } from "@/lib/server/materialize-line-sku";
import {
  resolveAllSkusForQuoteObject,
  resolveSkuForQuoteObject,
} from "@/lib/server/resolve-sku-for-quote-object";
import {
  resolveQuoteObjectLinesForCategories,
  resolveQuoteObjectLinesForObjectNames,
} from "@/lib/server/scope-answer-categories";
import {
  firestoreAnswersToPublic,
  firestoreLegacyByPriceLevel,
  firestoreScopeMetricsToPublic,
  type LegacyScopeAnswerPriceLevel,
} from "@/lib/server/scope-doc";
import {
  parseScopeMetricValuesFromFirestore,
  pruneScopeMetricValuesForAnswer,
} from "@/lib/server/scope-metric-values";
import type { InheritMeasureSource } from "@/types/scope-metric";
import { isInheritMeasureSource } from "@/lib/scope-metrics";
import { parseScopeShowAllDefaultQty } from "@/types/scope";
import { scopeMetricValuesMap } from "@/lib/inherit-m2-source";
import {
  customMeasureForNewProjectLine,
  effectiveMeasureForLinePricing,
  numOrNull,
  quoteTemplatePricingForPriceLevel,
  resolveScopeShowAllLineCustomUom,
} from "@/lib/server/quote-object-doc";
import { loadSkuCalcM2Fields } from "@/lib/server/sku-calc-m2-fields";
import { loadProjectDimensionsByProjectId } from "@/lib/server/project-dimensions";
import {
  applyProjectLineLabourHours,
  labourHoursToFirestore,
  loadAllContractLabourRates,
  loadAllObjectLabourRates,
} from "@/lib/server/labour-hours";
import {
  isLabourQuoteObjectData,
  labourLineCatalogFields,
} from "@/lib/server/labour-checklist-line";
import { emptyLabourHours } from "@/lib/labour-silo";
import {
  BLINDS_DEFAULT_MEASURE,
  BLINDS_DEFAULT_UOM,
} from "@/lib/blinds/blinds-defaults";
import { isSystemScopeObjectId, systemScopeObjectId } from "@/lib/system-scope-types";
import { matchesScopeInstance } from "@/lib/scope-instance";
import type { ProjectAreaScopeAnswerPublic } from "@/types/project-area";
import type { QuoteObjectInheritM2Source } from "@/types/quote-object";

export function parseScopeAnswersFromFirestore(raw: unknown): ProjectAreaScopeAnswerPublic[] {
  if (!Array.isArray(raw)) return [];
  const out: ProjectAreaScopeAnswerPublic[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const scopeDocId = String(rec.scopeDocId ?? "").trim();
    const answerid = String(rec.answerid ?? "").trim();
    const scopeInstanceIdRaw = rec.scopeInstanceId;
    const scopeInstanceId =
      typeof scopeInstanceIdRaw === "string" && scopeInstanceIdRaw.trim()
        ? scopeInstanceIdRaw.trim()
        : null;
    if (!scopeDocId || !answerid) continue;
    out.push({
      scopeDocId,
      answerid,
      ...(scopeInstanceId ? { scopeInstanceId } : {}),
    });
  }
  return out;
}

function integerObjectId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

async function loadQuoteByObjectIdMap(
  db: Firestore,
): Promise<Map<number, DocumentData>> {
  const quoteObjectsSnap = await db.collection("quote_objects").get();
  const quoteByObjectId = new Map<number, DocumentData>();
  quoteObjectsSnap.docs.forEach((d) => {
    if (isQuoteObjectsMetaDocument(d.id)) return;
    const data = d.data();
    const oid = integerObjectId(data.objectid);
    if (oid !== undefined) quoteByObjectId.set(oid, data);
  });
  return quoteByObjectId;
}

/** Legacy: only the row matching effective PL; no fallback. */
function pickExactPriceLevelRow(
  byPriceLevel: LegacyScopeAnswerPriceLevel[],
  effectivePl: number | null,
): { objectPickOrder: string[] } | null {
  if (effectivePl == null || !Number.isInteger(effectivePl)) return null;
  const hit = byPriceLevel.find((r) => r.pricelevelid === effectivePl);
  if (!hit) return null;
  const order =
    hit.objectPickOrder.length > 0
      ? hit.objectPickOrder
      : [
          ...hit.areaObjectDocIds.map((id) => `ao:${id}`),
          ...hit.quoteObjectDocIds.map((id) => `qo:${id}`),
        ];
  if (order.length === 0) return null;
  return { objectPickOrder: order };
}

async function resolveAreaObjectSeedLine(
  db: Firestore,
  areaObjectDocId: string,
  expectedAreaid: number,
): Promise<{ objectid: number; notes1: string; notes2: string } | null> {
  if (isAreaObjectsMetaDocument(areaObjectDocId)) return null;
  const snap = await db.collection("areaobjects").doc(areaObjectDocId).get();
  if (!snap.exists) return null;
  const data = snap.data() as DocumentData;
  if (Number(data.areaid) !== expectedAreaid) return null;
  const objectid = integerObjectId(data.objectid);
  if (objectid === undefined) return null;
  return {
    objectid,
    notes1: String(data.notes3 ?? ""),
    notes2: String(data.notes4 ?? ""),
  };
}

async function resolveQuoteObjectNotesAndId(
  db: Firestore,
  quoteObjectDocId: string,
): Promise<{ objectid: number; notes1: string; notes2: string } | null> {
  if (isQuoteObjectsMetaDocument(quoteObjectDocId)) return null;
  const snap = await db.collection("quote_objects").doc(quoteObjectDocId).get();
  if (!snap.exists) return null;
  const data = snap.data() as DocumentData;
  const objectid = integerObjectId(data.objectid);
  if (objectid === undefined) return null;
  return {
    objectid,
    notes1: String(data.notes1 ?? ""),
    notes2: String(data.notes2 ?? ""),
  };
}

async function resolveLinePayloadsFromLegacyPicks(
  db: Firestore,
  byPriceLevel: LegacyScopeAnswerPriceLevel[],
  effectivePl: number | null,
  areaid: number,
): Promise<{
  linePayloads: { objectid: number; notes1: string; notes2: string }[];
  noLinesReason?: ScopeAnswerNoLinesReason;
  answerTierIds?: number[];
}> {
  const answerTierIds = byPriceLevel.map((r) => r.pricelevelid);
  const row = pickExactPriceLevelRow(byPriceLevel, effectivePl);
  if (!row) {
    const noLinesReason: ScopeAnswerNoLinesReason =
      effectivePl == null
        ? "no_effective_price_level"
        : "no_answer_row_for_effective_tier";
    return { linePayloads: [], noLinesReason, answerTierIds };
  }
  const linePayloads: { objectid: number; notes1: string; notes2: string }[] = [];
  const seenAoDoc = new Set<string>();
  const seenQoDoc = new Set<string>();
  for (const pickId of row.objectPickOrder) {
    if (pickId.startsWith("ao:")) {
      const docId = pickId.slice(3);
      if (!docId || seenAoDoc.has(docId)) continue;
      seenAoDoc.add(docId);
      const line = await resolveAreaObjectSeedLine(db, docId, areaid);
      if (line) linePayloads.push(line);
    } else if (pickId.startsWith("qo:")) {
      const docId = pickId.slice(3);
      if (!docId || seenQoDoc.has(docId)) continue;
      seenQoDoc.add(docId);
      const line = await resolveQuoteObjectNotesAndId(db, docId);
      if (line) linePayloads.push(line);
    }
  }
  if (linePayloads.length === 0) {
    return {
      linePayloads: [],
      noLinesReason: "no_resolvable_line_picks",
      answerTierIds,
    };
  }
  return { linePayloads, answerTierIds };
}

async function deleteScopeLinesForScope(
  db: Firestore,
  projectid: number,
  projectAreaDocId: string,
  scopeDocId: string,
  scopeInstanceId?: string | null,
): Promise<number> {
  const snap = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();
  let removed = 0;
  const BATCH_MAX = 400;
  const scopeLineIds = new Set<string>();
  for (const d of snap.docs) {
    const x = d.data();
    if (
      x.linesource === "scope" &&
      String(x.scopeDocId ?? "") === scopeDocId &&
      matchesScopeInstance(x.scopeInstanceId as string | null | undefined, scopeInstanceId)
    ) {
      scopeLineIds.add(d.id);
    }
  }
  const toDelete = snap.docs.filter((d) => {
    const x = d.data();
    if (scopeLineIds.has(d.id)) return true;
    const parentId = String(x.bundledFromLineId ?? "").trim();
    return x.linesource === "bundled" && parentId && scopeLineIds.has(parentId);
  });
  for (let i = 0; i < toDelete.length; i += BATCH_MAX) {
    const slice = toDelete.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const d of slice) {
      batch.delete(d.ref);
      removed += 1;
    }
    await batch.commit();
  }
  return removed;
}

/** Why scope lines were not materialized (when answer was chosen but linesAdded is 0). */
export type ScopeAnswerNoLinesReason =
  | "answer_cleared"
  | "no_effective_price_level"
  | "no_categories_configured"
  | "no_objects_configured"
  | "no_objects_in_categories"
  | "no_objects_for_names"
  | "no_objects_for_ids"
  | "zero_sku_rows_suppressed"
  | "no_answer_row_for_effective_tier"
  | "no_resolvable_line_picks";

export type ScopeAnswerDiagnostics = {
  effectivePriceLevelId: number | null;
  noLinesReason?: ScopeAnswerNoLinesReason;
  attachedCategories?: string[];
  attachedObjectNames?: string[];
  /** Legacy price-level rows on the answer (pre-category scopes). */
  answerTierIds?: number[];
};

export type ApplyScopeAnswerResult = {
  linesRemoved: number;
  linesAdded: number;
  scopeAnswers: ProjectAreaScopeAnswerPublic[];
  diagnostics: ScopeAnswerDiagnostics;
};

/**
 * Removes existing lines for this scope on the project area, updates stored answers,
 * then inserts lines from attached quote object categories (pricing uses effective price level).
 */
export async function applyScopeAnswerToProjectArea(
  db: Firestore,
  projectAreaDocId: string,
  scopeDocId: string,
  answerid: string | null,
  scopeInstanceId?: string | null,
): Promise<ApplyScopeAnswerResult> {
  if (isProjectAreasMetaDocument(projectAreaDocId)) {
    throw new Error("Invalid project area");
  }
  if (isScopesMetaDocument(scopeDocId)) {
    throw new Error("Invalid scope");
  }

  const paRef = db.collection("projectareas").doc(projectAreaDocId);
  const paSnap = await paRef.get();
  if (!paSnap.exists) throw new Error("Project area not found");
  const paData = paSnap.data() as DocumentData;
  const projectid = Number(paData.projectid);
  const areaid = Number(paData.areaid);
  if (!Number.isInteger(projectid) || !Number.isInteger(areaid)) {
    throw new Error("Invalid project area data");
  }

  const scopeRef = db.collection("scopes").doc(scopeDocId);
  const scopeSnap = await scopeRef.get();
  if (!scopeSnap.exists) throw new Error("Scope not found");
  const scopeData = scopeSnap.data() as DocumentData;
  if (scopeData.kind === "header" || scopeData.kind === "footer") {
    throw new Error("Section markers have no answers to apply");
  }
  const tmplSnap = await db.collection("areas").where("areaid", "==", areaid).limit(1).get();
  const templateAreaDocId = tmplSnap.docs[0]?.id ?? "";
  const extraRaw = paData.extraScopeDocIds;
  const isManualExtra =
    Array.isArray(extraRaw) && extraRaw.some((x) => x === scopeDocId);

  const tagIds = scopeData.areaDocIds;
  let belongs = false;
  if (isManualExtra) {
    belongs = true;
  } else if (Array.isArray(tagIds) && tagIds.length > 0) {
    belongs = Boolean(templateAreaDocId && tagIds.includes(templateAreaDocId));
  } else {
    const scopeAreaid = Number(scopeData.areaid ?? NaN);
    belongs = scopeAreaid === areaid;
  }
  if (!belongs) {
    throw new Error("Scope does not belong to this template area");
  }
  const rawSid = scopeData.scopeid;
  const scopeNumericId =
    typeof rawSid === "number" && Number.isInteger(rawSid) ? rawSid : null;

  let current = parseScopeAnswersFromFirestore(paData.scopeAnswers);
  const answers = firestoreAnswersToPublic(scopeData.answers);
  const scopeMetrics = firestoreScopeMetricsToPublic(scopeData.scopeMetrics);
  let scopeMetricValues = parseScopeMetricValuesFromFirestore(paData.scopeMetricValues);

  if (answerid === null || answerid === "") {
    const linesRemoved = await deleteScopeLinesForScope(
      db,
      projectid,
      projectAreaDocId,
      scopeDocId,
      scopeInstanceId,
    );
    current = current.filter(
      (e) =>
        !(
          e.scopeDocId === scopeDocId &&
          matchesScopeInstance(e.scopeInstanceId, scopeInstanceId)
        ),
    );
    scopeMetricValues = pruneScopeMetricValuesForAnswer(
      scopeMetricValues,
      scopeDocId,
      scopeInstanceId,
      scopeMetrics,
      null,
    );
    await paRef.update({
      scopeAnswers: current,
      scopeMetricValues,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const clearedPl = await resolveEffectivePriceLevelId(db, projectAreaDocId, projectid);
    return {
      linesRemoved,
      linesAdded: 0,
      scopeAnswers: current,
      diagnostics: {
        effectivePriceLevelId: clearedPl,
        noLinesReason: "answer_cleared",
      },
    };
  }

  const answer = answers.find((a) => a.answerid === answerid);
  if (!answer) {
    throw new Error("Unknown scope answer");
  }

  const linesRemoved = await deleteScopeLinesForScope(
    db,
    projectid,
    projectAreaDocId,
    scopeDocId,
    scopeInstanceId,
  );

  current = current.filter(
    (e) =>
      !(
        e.scopeDocId === scopeDocId &&
        matchesScopeInstance(e.scopeInstanceId, scopeInstanceId)
      ),
  );
  const nextAnswer: ProjectAreaScopeAnswerPublic = { scopeDocId, answerid };
  const inst = scopeInstanceId?.trim();
  if (inst) nextAnswer.scopeInstanceId = inst;
  current.push(nextAnswer);
  scopeMetricValues = pruneScopeMetricValuesForAnswer(
    scopeMetricValues,
    scopeDocId,
    scopeInstanceId,
    scopeMetrics,
    answerid,
  );
  await paRef.update({
    scopeAnswers: current,
    scopeMetricValues,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const metricMap = scopeMetricValuesMap(scopeMetricValues);
  const effectivePl = await resolveEffectivePriceLevelId(db, projectAreaDocId, projectid);
  const attachedQuoteObjectIds = answer.attachedQuoteObjectIds ?? [];
  const attachedObjectNames = answer.attachedObjectNames ?? [];
  const attachedCategories = answer.attachedCategories ?? [];
  const hasBlindsSystem = attachedQuoteObjectIds.some(
    (id) => id.trim() === systemScopeObjectId("Blinds"),
  );
  const catalogQuoteObjectIds = attachedQuoteObjectIds.filter(
    (id) => !isSystemScopeObjectId(id),
  );
  const suppressZeroSkuRows = answer.suppressZeroSkuRows === true;

  type ScopeLineCreateSpec = {
    objectid: number;
    quoteObjectDocId?: string;
    quoteData?: DocumentData;
    notes1: string;
    notes2: string;
    sku: { skuId: string; product: string; uom?: string } | null;
    scopeShowAllSku: boolean;
    scopeNoCharge: boolean;
  };

  let lineSpecs: ScopeLineCreateSpec[] = [];
  let noLinesReason: ScopeAnswerNoLinesReason | undefined;
  let answerTierIds: number[] | undefined;
  const scopeInheritByObjectId = new Map<number, InheritMeasureSource>();
  const scopeInheritMeasureLockedByObjectId = new Map<number, boolean>();
  const showAllDefaultByObjectId = new Map<number, number>();

  const skuFilters = async () => {
    const { style, colour } = await resolveEffectiveStyleColour(db, projectAreaDocId, projectid);
    const elevateLevel = await resolveEffectiveElevateLevel(db, projectAreaDocId, projectid);
    return { elevateLevel, style, colour };
  };

  if (catalogQuoteObjectIds.length > 0) {
    const filters = await skuFilters();
    const attachedShowAll = answer.attachedObjectShowAll ?? {};
    const attachedShowAllDefault = answer.attachedObjectShowAllDefault ?? {};
    const attachedNoCharge = answer.attachedObjectNoCharge ?? {};
    const attachedInheritM2 = answer.attachedObjectInheritM2Source ?? {};
    const attachedInheritMeasureLocked = answer.attachedObjectInheritMeasureLocked ?? {};
    const processedObjectIds = new Set<number>();

    for (const docId of catalogQuoteObjectIds) {
      const trimmed = docId.trim();
      if (!trimmed) continue;
      const snap = await db.collection("quote_objects").doc(trimmed).get();
      if (!snap.exists || isQuoteObjectsMetaDocument(snap.id)) continue;
      const data = snap.data() as DocumentData;
      const areaTagIds = data.areaTagIds;
      const areaTags = Array.isArray(areaTagIds)
        ? areaTagIds.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [];
      if (areaTags.length > 0 && (!templateAreaDocId || !areaTags.includes(templateAreaDocId))) {
        continue;
      }
      const objectid = integerObjectId(data.objectid);
      if (objectid === undefined || processedObjectIds.has(objectid)) continue;
      processedObjectIds.add(objectid);

      const scopeInherit = attachedInheritM2[trimmed];
      if (scopeInherit !== undefined && isInheritMeasureSource(scopeInherit)) {
        scopeInheritByObjectId.set(objectid, scopeInherit);
      }
      if (attachedInheritMeasureLocked[trimmed] === false) {
        scopeInheritMeasureLockedByObjectId.set(objectid, false);
      }

      const seed = {
        objectid,
        quoteObjectDocId: trimmed,
        quoteData: data,
        notes1: String(data.notes1 ?? ""),
        notes2: String(data.notes2 ?? ""),
      };
      const showAll = attachedShowAll[trimmed] === true;
      const noCharge = attachedNoCharge[trimmed] === true;
      const lineFlags = { scopeNoCharge: noCharge };
      const skipZeroSku =
        suppressZeroSkuRows && !isLabourQuoteObjectData(data);
      if (showAll) {
        const parsed = parseScopeShowAllDefaultQty(attachedShowAllDefault[trimmed]);
        showAllDefaultByObjectId.set(objectid, parsed ?? 1);
      }

      if (showAll) {
        const skus = await resolveAllSkusForQuoteObject(db, data, filters);
        if (skus.length === 0) {
          if (skipZeroSku) continue;
          lineSpecs.push({ ...seed, sku: null, scopeShowAllSku: false, ...lineFlags });
        } else {
          for (const sku of skus) {
            lineSpecs.push({
              ...seed,
              sku: { skuId: sku.skuId, product: sku.product, uom: sku.uom },
              scopeShowAllSku: true,
              ...lineFlags,
            });
          }
        }
      } else {
        const resolved = await resolveSkuForQuoteObject(db, data, filters);
        if (!resolved && skipZeroSku) continue;
        lineSpecs.push({
          ...seed,
          sku: resolved ? { skuId: resolved.skuId, product: resolved.product } : null,
          scopeShowAllSku: false,
          ...lineFlags,
        });
      }
    }

    if (lineSpecs.length === 0 && !hasBlindsSystem) {
      noLinesReason = suppressZeroSkuRows ? "zero_sku_rows_suppressed" : "no_objects_for_ids";
    }
  } else if (!hasBlindsSystem && attachedObjectNames.length > 0) {
    const linePayloads = await resolveQuoteObjectLinesForObjectNames(
      db,
      attachedObjectNames,
      templateAreaDocId,
    );
    lineSpecs = linePayloads.map((pl) => ({
      ...pl,
      sku: null as { skuId: string; product: string } | null,
      scopeShowAllSku: false,
      scopeNoCharge: false,
    }));
    if (lineSpecs.length === 0) {
      noLinesReason = "no_objects_for_names";
    }
  } else if (!hasBlindsSystem && attachedCategories.length > 0) {
    const linePayloads = await resolveQuoteObjectLinesForCategories(
      db,
      attachedCategories,
      templateAreaDocId,
    );
    lineSpecs = linePayloads.map((pl) => ({
      ...pl,
      sku: null as { skuId: string; product: string } | null,
      scopeShowAllSku: false,
      scopeNoCharge: false,
    }));
    if (lineSpecs.length === 0) {
      noLinesReason = "no_objects_in_categories";
    }
  } else if (!hasBlindsSystem) {
    const rawAnswers = scopeData.answers;
    let legacyBpl: LegacyScopeAnswerPriceLevel[] = [];
    if (Array.isArray(rawAnswers)) {
      for (const item of rawAnswers) {
        if (typeof item !== "object" || item === null) continue;
        const rec = item as Record<string, unknown>;
        if (String(rec.answerid ?? "") !== answerid) continue;
        legacyBpl = firestoreLegacyByPriceLevel(rec.byPriceLevel);
        break;
      }
    }
    if (legacyBpl.length === 0) {
      noLinesReason = "no_objects_configured";
    } else {
      const legacy = await resolveLinePayloadsFromLegacyPicks(
        db,
        legacyBpl,
        effectivePl,
        areaid,
      );
      lineSpecs = legacy.linePayloads.map((pl) => ({
        ...pl,
        sku: null as { skuId: string; product: string } | null,
        scopeShowAllSku: false,
        scopeNoCharge: false,
      }));
      noLinesReason = legacy.noLinesReason;
      answerTierIds = legacy.answerTierIds;
    }
  }

  if (lineSpecs.length === 0 && !hasBlindsSystem) {
    const diag: ScopeAnswerDiagnostics = {
      effectivePriceLevelId: effectivePl,
      noLinesReason,
      attachedObjectNames:
        attachedObjectNames.length > 0 ? attachedObjectNames : undefined,
      attachedCategories: attachedCategories.length > 0 ? attachedCategories : undefined,
      answerTierIds,
    };
    console.warn("[applyScopeAnswerToProjectArea] no scope lines materialized", {
      projectAreaDocId,
      scopeDocId,
      answerid,
      ...diag,
    });
    return { linesRemoved, linesAdded: 0, scopeAnswers: current, diagnostics: diag };
  }

  const quoteByObjectId = await loadQuoteByObjectIdMap(db);
  const { style: effectiveStyle, colour: effectiveColour } = await resolveEffectiveStyleColour(
    db,
    projectAreaDocId,
    projectid,
  );
  const elevateLevel = await resolveEffectiveElevateLevel(db, projectAreaDocId, projectid);
  const areaM2 = numOrNull(paData.aream2);
  const projDims = await loadProjectDimensionsByProjectId(db, projectid);
  const objectLabourRates = await loadAllObjectLabourRates(db);
  const contractLabourRates = await loadAllContractLabourRates(db);
  let linesAdded = 0;
  const BATCH_MAX = 400;
  if (lineSpecs.length > 0) {
  for (let i = 0; i < lineSpecs.length; i += BATCH_MAX) {
    const slice = lineSpecs.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const pl of slice) {
      const q = pl.quoteData ?? quoteByObjectId.get(pl.objectid);
      const pricing = quoteTemplatePricingForPriceLevel(q, effectivePl);
      const measureCtx = {
        areaM2,
        apartmentTotalM2: projDims.apartmentTotalM2,
        apartmentHardM2: projDims.apartmentHardM2,
        apartmentSoftM2: projDims.apartmentSoftM2,
      };
      const scopeInheritMeasureSource = scopeInheritByObjectId.get(pl.objectid);
      const scopeInheritMeasureLocked = scopeInheritMeasureLockedByObjectId.get(pl.objectid);
      const tooltip = q ? readTooltipFromQuoteObjectData(q) : "";
      const objectName = q ? String(q.objectname ?? "").trim() : "";
      const labourCatalog = labourLineCatalogFields(q, contractLabourRates, {
        scopeNoCharge: pl.scopeNoCharge,
      });
      let resolvedSku: { skuId: string | null; product: string | null } | null = pl.sku
        ? { skuId: pl.sku.skuId, product: pl.sku.product }
        : null;
      if (labourCatalog) {
        resolvedSku = { skuId: null, product: labourCatalog.skuProduct };
      } else if (!resolvedSku && !pl.scopeShowAllSku) {
        const hit = await resolveSkuForQuoteObject(db, q, {
          elevateLevel,
          style: effectiveStyle,
          colour: effectiveColour,
        });
        resolvedSku = hit ? { skuId: hit.skuId, product: hit.product } : null;
      }
      const skuCalcM2 = await loadSkuCalcM2Fields(db, resolvedSku?.skuId);
      const showAllDefaultQty = pl.scopeShowAllSku
        ? showAllDefaultByObjectId.get(pl.objectid)
        : undefined;
      const explicitShowAllMeasure =
        showAllDefaultQty != null ? showAllDefaultQty : undefined;
      const custommeasure = customMeasureForNewProjectLine(
        q,
        pricing.measurement,
        measureCtx,
        explicitShowAllMeasure,
        scopeInheritMeasureSource,
        metricMap,
        scopeMetrics,
        skuCalcM2,
        scopeInheritMeasureLocked,
      );
      const measureForPricing = effectiveMeasureForLinePricing(
        q,
        pricing.measurement,
        measureCtx,
        custommeasure,
        scopeInheritMeasureSource,
        metricMap,
        scopeMetrics,
        skuCalcM2,
        scopeInheritMeasureLocked,
      );
      let customumprice = pricing.customumprice;
      let customuom =
        pl.scopeShowAllSku && pl.sku?.uom?.trim()
          ? resolveScopeShowAllLineCustomUom(pl.sku.uom)
          : pricing.customuom;
      let totalprice: number | null;
      if (pl.scopeNoCharge) {
        customumprice = 0;
        totalprice = 0;
      } else if (labourCatalog) {
        if (labourCatalog.customumprice != null) customumprice = labourCatalog.customumprice;
        if (labourCatalog.customuom) customuom = labourCatalog.customuom;
        if (measureForPricing != null && customumprice != null) {
          totalprice = measureForPricing * customumprice;
        } else {
          totalprice = null;
        }
      } else if (measureForPricing != null && customumprice != null) {
        totalprice = measureForPricing * customumprice;
      } else {
        totalprice = pricing.totalprice;
      }
      if (
        resolvedSku?.skuId &&
        customumprice == null &&
        !pl.scopeNoCharge &&
        !labourCatalog
      ) {
        const supplierPrice = await primarySupplierPriceExcGst(db, resolvedSku.skuId);
        if (supplierPrice != null) {
          customumprice = supplierPrice;
          if (measureForPricing != null) {
            totalprice = measureForPricing * supplierPrice;
          }
        }
      }
      const { hours: labourHours } = applyProjectLineLabourHours({
        objectName,
        skuProduct: resolvedSku?.product ?? null,
        quoteTemplate: q,
        objectLabourRates,
        custommeasure: measureForPricing,
        lineUom: customuom,
      });
      batch.set(db.collection("projectareaobjects").doc(), {
        projectid,
        projectAreaDocId,
        objectid: pl.objectid,
        ...(objectName ? { objectname: objectName } : {}),
        areaid,
        linesource: "scope",
        scopeDocId,
        ...(inst ? { scopeInstanceId: inst } : {}),
        answerid,
        scopeid: scopeNumericId,
        skuId: resolvedSku?.skuId ?? null,
        skuProduct: resolvedSku?.product ?? null,
        scopeShowAllSku: pl.scopeShowAllSku ? true : null,
        scopeNoCharge: pl.scopeNoCharge ? true : null,
        dateadded: FieldValue.serverTimestamp(),
        custommeasure,
        customuom,
        customumprice,
        totalprice,
        notes1: pl.notes1,
        notes2: pl.notes2,
        tooltip,
        ...labourHoursToFirestore(labourHours),
        included: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      linesAdded += 1;
    }
    await batch.commit();
  }
  }

  if (hasBlindsSystem) {
    await db.collection("projectareaobjects").doc().set({
      projectid,
      projectAreaDocId,
      objectid: 0,
      areaid,
      linesource: "scope",
      systemObjectKind: "blinds",
      scopeDocId,
      ...(inst ? { scopeInstanceId: inst } : {}),
      answerid,
      scopeid: scopeNumericId,
      skuId: null,
      skuProduct: null,
      dateadded: FieldValue.serverTimestamp(),
      custommeasure: BLINDS_DEFAULT_MEASURE,
      customuom: BLINDS_DEFAULT_UOM,
      customumprice: null,
      totalprice: null,
      blindType: null,
      blindDropMm: null,
      blindWidthMm: null,
      blindColour: null,
      notes1: "",
      notes2: "",
      tooltip: "",
      ...labourHoursToFirestore(emptyLabourHours()),
      included: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    linesAdded += 1;
  }

  return {
    linesRemoved,
    linesAdded,
    scopeAnswers: current,
    diagnostics: {
      effectivePriceLevelId: effectivePl,
      attachedObjectNames:
        attachedObjectNames.length > 0 ? attachedObjectNames : undefined,
      attachedCategories: attachedCategories.length > 0 ? attachedCategories : undefined,
      answerTierIds,
    },
  };
}

async function deleteAllScopeLinesForScopeDoc(
  db: Firestore,
  projectid: number,
  projectAreaDocId: string,
  scopeDocId: string,
): Promise<number> {
  const snap = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();
  let removed = 0;
  const BATCH_MAX = 400;
  const scopeLineIds = new Set<string>();
  for (const d of snap.docs) {
    const x = d.data();
    if (x.linesource === "scope" && String(x.scopeDocId ?? "") === scopeDocId) {
      scopeLineIds.add(d.id);
    }
  }
  const toDelete = snap.docs.filter((d) => {
    const x = d.data();
    if (scopeLineIds.has(d.id)) return true;
    const parentId = String(x.bundledFromLineId ?? "").trim();
    return x.linesource === "bundled" && parentId && scopeLineIds.has(parentId);
  });
  for (let i = 0; i < toDelete.length; i += BATCH_MAX) {
    const slice = toDelete.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const d of slice) {
      batch.delete(d.ref);
      removed += 1;
    }
    await batch.commit();
  }
  return removed;
}

/** Remove stale scope question data from a project area (no template-tag check). */
export async function purgeScopeQuestionFromProjectArea(
  db: Firestore,
  projectAreaDocId: string,
  scopeDocId: string,
): Promise<{ linesRemoved: number; scopeAnswers: ProjectAreaScopeAnswerPublic[] }> {
  if (isProjectAreasMetaDocument(projectAreaDocId)) {
    throw new Error("Invalid project area");
  }
  const docId = scopeDocId.trim();
  if (!docId || isScopesMetaDocument(docId)) {
    throw new Error("Invalid scope");
  }

  const paRef = db.collection("projectareas").doc(projectAreaDocId);
  const paSnap = await paRef.get();
  if (!paSnap.exists) throw new Error("Project area not found");
  const paData = paSnap.data() as DocumentData;
  const projectid = Number(paData.projectid);
  if (!Number.isInteger(projectid)) throw new Error("Invalid project area data");

  const linesRemoved = await deleteAllScopeLinesForScopeDoc(
    db,
    projectid,
    projectAreaDocId,
    docId,
  );

  let current = parseScopeAnswersFromFirestore(paData.scopeAnswers);
  current = current.filter((e) => e.scopeDocId !== docId);

  let scopeMetricValues = parseScopeMetricValuesFromFirestore(paData.scopeMetricValues);
  scopeMetricValues = scopeMetricValues.filter((v) => v.scopeDocId !== docId);

  const extraRaw = paData.extraScopeDocIds;
  let extraUpdate: string[] | ReturnType<typeof FieldValue.delete> | undefined;
  if (Array.isArray(extraRaw) && extraRaw.some((x) => x === docId)) {
    const nextExtra = extraRaw.filter((x) => x !== docId);
    extraUpdate = nextExtra.length > 0 ? nextExtra : FieldValue.delete();
  }

  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  update.scopeAnswers = current.length > 0 ? current : FieldValue.delete();
  update.scopeMetricValues =
    scopeMetricValues.length > 0 ? scopeMetricValues : FieldValue.delete();
  if (extraUpdate !== undefined) update.extraScopeDocIds = extraUpdate;

  await paRef.update(update);
  return { linesRemoved, scopeAnswers: current };
}
