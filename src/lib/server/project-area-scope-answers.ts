import { FieldValue, type DocumentData, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import { readTooltipFromQuoteObjectData } from "@/lib/server/area-object-tooltip";
import { resolveEffectivePriceLevelId, effectivePriceLevelIdFromData } from "@/lib/server/resolve-effective-price-level";
import { resolveEffectiveStyleColour, effectiveStyleColourFromData } from "@/lib/server/resolve-effective-style-colour";
import {
  resolveEffectiveElevateLevel,
  resolveElevateLevelFromPriceLevelAndFinish,
  projectFinishFromData,
} from "@/lib/server/resolve-effective-elevate-level";
import {
  isPrimarySupplierPriceCacheWarm,
  primarySupplierPriceExcGst,
  primePrimarySupplierPriceCache,
} from "@/lib/server/materialize-line-sku";
import {
  clearDataSkusResolveCache,
  dataSkusResolveCacheCount,
  isDataSkusResolveCacheWarm,
  loadSkuUomBySkuId,
  primeDataSkusResolveCache,
  resolveAllSkusForQuoteObject,
  resolveShowAllSkusForQuoteObject,
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
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";
import { scopeMetricValuesMap } from "@/lib/inherit-m2-source";
import {
  customMeasureForNewProjectLine,
  customUomForScopeShowAllLine,
  effectiveMeasureForLinePricing,
  numOrNull,
  quoteTemplatePricingForPriceLevel,
} from "@/lib/server/quote-object-doc";
import {
  clearColourLookupIndexCache,
  isColourLookupIndexCacheWarm,
  loadColourLookupIndex,
} from "@/lib/server/load-colour-lookup-index";
import {
  type ScopeAnswerTimings,
  timedValue,
} from "@/lib/server/scope-answer-timings";
import { loadSkuCalcM2Fields } from "@/lib/server/sku-calc-m2-fields";
import {
  loadProjectDataByNumericId,
  projectDimensionsFromData,
  type ProjectDimensions,
} from "@/lib/server/project-dimensions";
import { loadLmRunsRollWidthMFromDb } from "@/lib/server/load-lm-runs-roll-width";
import { docToProjectAreaObjectPublic } from "@/lib/server/project-area-object-doc";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
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
import {
  coalesceProjectAreaObjectLines,
  nextProjectAreaLineSortOrder,
  PROJECT_AREA_LINE_SORT_STEP,
} from "@/lib/server/project-area-line-sort";
import {
  loadQuoteDocsByIds,
  loadQuoteMapForNumericObjectIds,
} from "@/lib/server/project-area-seeding";
import { matchesScopeInstance } from "@/lib/scope-instance";
import type { ProjectAreaScopeAnswerPublic } from "@/types/project-area";
import type { QuoteObjectInheritM2Source } from "@/types/quote-object";
import type { ScopeAnswerPublic } from "@/types/scope";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";
import { projectLineHasOrphanSku } from "@/lib/health-check/orphan-refs";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";

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
  timings?: ScopeAnswerTimings,
): Promise<{ removed: number; ids: string[]; nextLineSortOrder: number }> {
  const snap = await timedValue(timings, "deleteLinesQueryMs", () =>
    db
      .collection("projectareaobjects")
      .where("projectid", "==", projectid)
      .where("projectAreaDocId", "==", projectAreaDocId)
      .get(),
  );
  if (timings) timings.deleteLinesScanned = snap.docs.length;
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
  const deleteIds = new Set(toDelete.map((d) => d.id));
  let maxKeptSort = 0;
  for (const d of snap.docs) {
    if (deleteIds.has(d.id) || isProjectAreaObjectsMetaDocument(d.id)) continue;
    const order = readLineSortOrder(d.data().lineSortOrder);
    if (order != null && order > maxKeptSort) maxKeptSort = order;
  }
  const ids: string[] = [];
  await timedValue(timings, "deleteLinesWriteMs", async () => {
    for (let i = 0; i < toDelete.length; i += BATCH_MAX) {
      const slice = toDelete.slice(i, i + BATCH_MAX);
      const batch = db.batch();
      for (const d of slice) {
        batch.delete(d.ref);
        removed += 1;
        ids.push(d.id);
      }
      await batch.commit();
    }
  });
  if (timings) timings.deleteLinesRemoved = removed;
  return {
    removed,
    ids,
    nextLineSortOrder: maxKeptSort + PROJECT_AREA_LINE_SORT_STEP,
  };
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
  /** Wall-clock breakdown (ms). Open DevTools console / Network Server-Timing. */
  timings?: ScopeAnswerTimings;
};

export type ApplyScopeAnswerResult = {
  linesRemoved: number;
  linesAdded: number;
  scopeAnswers: ProjectAreaScopeAnswerPublic[];
  diagnostics: ScopeAnswerDiagnostics;
  removedLineIds: string[];
  addedLines: ProjectAreaObjectPublic[];
  paDataForPublic: DocumentData;
};

export type RepopulateScopeObjectResult = {
  linesRemoved: number;
  linesAdded: number;
  linesKept: number;
};

type ScopeLineCreateSpec = {
  objectid: number;
  quoteObjectDocId?: string;
  quoteData?: DocumentData;
  notes1: string;
  notes2: string;
  sku: { skuId: string; product: string; uom?: string } | null;
  scopeShowAllSku: boolean;
  scopeNoCharge: boolean;
  systemObjectKind?: "blinds";
};

type CollectedScopeLineSpecs = {
  lineSpecs: ScopeLineCreateSpec[];
  scopeInheritByObjectId: Map<number, InheritMeasureSource>;
  scopeInheritMeasureLockedByObjectId: Map<number, boolean>;
  showAllDefaultByObjectId: Map<number, number>;
  effectivePl: number | null;
  noLinesReason?: ScopeAnswerNoLinesReason;
  attachedObjectNames: string[];
  attachedCategories: string[];
  answerTierIds?: number[];
};

async function collectScopeLineSpecsForAnswer(
  db: Firestore,
  args: {
    projectAreaDocId: string;
    projectid: number;
    areaid: number;
    templateAreaDocId: string;
    scopeData: DocumentData;
    answerid: string;
    answer: ScopeAnswerPublic;
    timings?: ScopeAnswerTimings;
    /** When set, skip re-reading area/project for price level / SKU filters. */
    loadedFilters?: {
      effectivePl: number | null;
      style: string;
      colour: string;
      elevateLevel: string;
    };
  },
): Promise<CollectedScopeLineSpecs> {
  const {
    projectAreaDocId,
    projectid,
    areaid,
    templateAreaDocId,
    scopeData,
    answerid,
    answer,
    timings,
    loadedFilters,
  } = args;
  const effectivePl = loadedFilters
    ? loadedFilters.effectivePl
    : await timedValue(timings, "collectEffectivePlMs", () =>
        resolveEffectivePriceLevelId(db, projectAreaDocId, projectid),
      );
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

  let quoteByDocId: Map<string, DocumentData> | null = null;
  const quoteDocById = async (): Promise<Map<string, DocumentData>> => {
    if (quoteByDocId) return quoteByDocId;
    quoteByDocId = await loadQuoteDocsByIds(db, catalogQuoteObjectIds);
    return quoteByDocId;
  };

  const blindsLineSpec = (): ScopeLineCreateSpec => ({
    objectid: 0,
    notes1: "",
    notes2: "",
    sku: null,
    scopeShowAllSku: false,
    scopeNoCharge: false,
    systemObjectKind: "blinds",
  });

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

  if (catalogQuoteObjectIds.length > 0 || hasBlindsSystem) {
    const filters =
      catalogQuoteObjectIds.length > 0
        ? loadedFilters
          ? {
              elevateLevel: loadedFilters.elevateLevel,
              style: loadedFilters.style,
              colour: loadedFilters.colour,
            }
          : await timedValue(timings, "collectSkuFiltersMs", skuFilters)
        : null;
    if (catalogQuoteObjectIds.length > 0) {
      const quotes = await timedValue(timings, "collectQuoteDocsMs", () => quoteDocById());
      if (timings) timings.quoteDocsLoaded = quotes.size;
    }
    const attachedShowAll = answer.attachedObjectShowAll ?? {};
    const attachedShowAllDefault = answer.attachedObjectShowAllDefault ?? {};
    const attachedNoCharge = answer.attachedObjectNoCharge ?? {};
    const attachedInheritM2 = answer.attachedObjectInheritM2Source ?? {};
    const attachedInheritMeasureLocked = answer.attachedObjectInheritMeasureLocked ?? {};
    const processedObjectIds = new Set<number>();
    let blindsQueued = false;

    const appendCatalogObject = async (trimmed: string) => {
      if (!filters) return;
      const quotes = await quoteDocById();
      const data = quotes.get(trimmed);
      if (!data) return;
      const areaTagIds = data.areaTagIds;
      const areaTags = Array.isArray(areaTagIds)
        ? areaTagIds.filter((x): x is string => typeof x === "string" && x.length > 0)
        : [];
      if (areaTags.length > 0 && (!templateAreaDocId || !areaTags.includes(templateAreaDocId))) {
        return;
      }
      const objectid = integerObjectId(data.objectid);
      if (objectid === undefined || processedObjectIds.has(objectid)) return;
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
      const skipZeroSku = suppressZeroSkuRows && !isLabourQuoteObjectData(data);
      if (showAll) {
        const parsed = parseScopeShowAllDefaultQty(attachedShowAllDefault[trimmed]);
        showAllDefaultByObjectId.set(objectid, parsed ?? 1);
      }

      if (showAll) {
        const skus = await resolveAllSkusForQuoteObject(db, data, filters);
        if (skus.length === 0) {
          if (skipZeroSku) return;
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
        if (!resolved && skipZeroSku) return;
        lineSpecs.push({
          ...seed,
          sku: resolved ? { skuId: resolved.skuId, product: resolved.product } : null,
          scopeShowAllSku: false,
          ...lineFlags,
        });
      }
    };

    await timedValue(timings, "collectSkuResolveMs", async () => {
      for (const docId of attachedQuoteObjectIds) {
        const trimmed = docId.trim();
        if (!trimmed) continue;
        if (trimmed === systemScopeObjectId("Blinds")) {
          if (!blindsQueued) {
            lineSpecs.push(blindsLineSpec());
            blindsQueued = true;
          }
          continue;
        }
        if (isSystemScopeObjectId(trimmed)) continue;
        await appendCatalogObject(trimmed);
      }
    });

    if (lineSpecs.length === 0 && !hasBlindsSystem) {
      noLinesReason = suppressZeroSkuRows ? "zero_sku_rows_suppressed" : "no_objects_for_ids";
    }
  } else if (!hasBlindsSystem && attachedObjectNames.length > 0) {
    const linePayloads = await timedValue(timings, "collectSkuResolveMs", () =>
      resolveQuoteObjectLinesForObjectNames(db, attachedObjectNames, templateAreaDocId),
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
    const linePayloads = await timedValue(timings, "collectSkuResolveMs", () =>
      resolveQuoteObjectLinesForCategories(db, attachedCategories, templateAreaDocId),
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
      const legacy = await timedValue(timings, "collectSkuResolveMs", () =>
        resolveLinePayloadsFromLegacyPicks(db, legacyBpl, effectivePl, areaid),
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

  if (hasBlindsSystem && !lineSpecs.some((s) => s.systemObjectKind === "blinds")) {
    lineSpecs.push(blindsLineSpec());
  }

  return {
    lineSpecs,
    scopeInheritByObjectId,
    scopeInheritMeasureLockedByObjectId,
    showAllDefaultByObjectId,
    effectivePl,
    noLinesReason,
    attachedObjectNames,
    attachedCategories,
    answerTierIds,
  };
}

async function materializeScopeLineSpecs(
  db: Firestore,
  args: {
    paData: DocumentData;
    projectAreaDocId: string;
    projectid: number;
    areaid: number;
    scopeDocId: string;
    scopeInstanceId?: string | null;
    answerid: string;
    scopeNumericId: number | null;
    lineSpecs: ScopeLineCreateSpec[];
    scopeInheritByObjectId: Map<number, InheritMeasureSource>;
    scopeInheritMeasureLockedByObjectId: Map<number, boolean>;
    showAllDefaultByObjectId: Map<number, number>;
    metricMap: ReturnType<typeof scopeMetricValuesMap>;
    scopeMetrics: ReturnType<typeof firestoreScopeMetricsToPublic>;
    startingLineSortOrder: number;
    effectivePl: number | null;
    timings?: ScopeAnswerTimings;
    loadedPricing?: {
      style: string;
      colour: string;
      elevateLevel: string;
      projDims: ProjectDimensions;
      lmRunsRollWidthFallback?: number;
    };
  },
): Promise<{ linesAdded: number; newLineDocIds: string[] }> {
  const {
    paData,
    projectAreaDocId,
    projectid,
    areaid,
    scopeDocId,
    answerid,
    scopeNumericId,
    lineSpecs,
    scopeInheritByObjectId,
    scopeInheritMeasureLockedByObjectId,
    showAllDefaultByObjectId,
    metricMap,
    scopeMetrics,
    effectivePl,
    timings,
    loadedPricing,
  } = args;
  const inst = args.scopeInstanceId?.trim();
  const quoteByObjectId = new Map<number, DocumentData>();
  const missingQuoteObjectIds: number[] = [];
  const seenMissing = new Set<number>();
  for (const pl of lineSpecs) {
    if (pl.systemObjectKind) continue;
    if (pl.quoteData) {
      quoteByObjectId.set(pl.objectid, pl.quoteData);
      continue;
    }
    if (pl.objectid && !quoteByObjectId.has(pl.objectid) && !seenMissing.has(pl.objectid)) {
      seenMissing.add(pl.objectid);
      missingQuoteObjectIds.push(pl.objectid);
    }
  }
  const catalogsWallT0 = performance.now();
  const [
    extraQuotes,
    styleColour,
    elevateLevel,
    projDims,
    objectLabourRates,
    contractLabourRates,
    lmRunsRollWidthFallback,
  ] = await Promise.all([
    timedValue(timings, "matExtraQuotesMs", () =>
      loadQuoteMapForNumericObjectIds(db, missingQuoteObjectIds),
    ),
    loadedPricing
      ? Promise.resolve({ style: loadedPricing.style, colour: loadedPricing.colour })
      : timedValue(timings, "matStyleColourMs", () =>
          resolveEffectiveStyleColour(db, projectAreaDocId, projectid),
        ),
    loadedPricing
      ? Promise.resolve(loadedPricing.elevateLevel)
      : timedValue(timings, "matElevateMs", () =>
          resolveEffectiveElevateLevel(db, projectAreaDocId, projectid),
        ),
    loadedPricing
      ? Promise.resolve(loadedPricing.projDims)
      : timedValue(timings, "matDimsMs", () =>
          loadProjectDataByNumericId(db, projectid).then((d) => projectDimensionsFromData(d ?? undefined)),
        ),
    timedValue(timings, "matObjectLabourMs", () => loadAllObjectLabourRates(db)),
    timedValue(timings, "matContractLabourMs", () => loadAllContractLabourRates(db)),
    loadedPricing?.lmRunsRollWidthFallback != null
      ? Promise.resolve(loadedPricing.lmRunsRollWidthFallback)
      : timedValue(timings, "matLmRunsRollWidthMs", () => loadLmRunsRollWidthMFromDb(db)),
    timedValue(timings, "matSkuPrimeMs", () => primeDataSkusResolveCache(db)),
    timedValue(timings, "matSupplierPrimeMs", () => primePrimarySupplierPriceCache(db)),
  ]);
  if (timings) timings.matCatalogsWallMs = Math.round(performance.now() - catalogsWallT0);
  for (const [oid, data] of extraQuotes) {
    if (!quoteByObjectId.has(oid)) quoteByObjectId.set(oid, data);
  }
  const { style: effectiveStyle, colour: effectiveColour } = styleColour;
  const areaM2 = numOrNull(paData.aream2);
  let lineSortOrder = args.startingLineSortOrder;
  let linesAdded = 0;
  const newLineDocIds: string[] = [];
  const BATCH_MAX = 400;
  await timedValue(timings, "matWriteMs", async () => {
    for (let i = 0; i < lineSpecs.length; i += BATCH_MAX) {
      const slice = lineSpecs.slice(i, i + BATCH_MAX);
      const batch = db.batch();
      for (const pl of slice) {
      if (pl.systemObjectKind === "blinds") {
        const newRef = db.collection("projectareaobjects").doc();
        batch.set(newRef, {
          projectid,
          projectAreaDocId,
          objectid: 0,
          areaid,
          lineSortOrder,
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
        newLineDocIds.push(newRef.id);
        linesAdded += 1;
        lineSortOrder += PROJECT_AREA_LINE_SORT_STEP;
        continue;
      }
      const q = pl.quoteData ?? quoteByObjectId.get(pl.objectid);
      const pricing = quoteTemplatePricingForPriceLevel(q, effectivePl);
      const measureCtx = {
        areaM2,
        apartmentTotalM2: projDims.apartmentTotalM2,
        apartmentHardM2: projDims.apartmentHardM2,
        apartmentSoftM2: projDims.apartmentSoftM2,
        lmRunsRollWidthFallback,
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
      let customuom = pricing.customuom;
      if (pl.scopeShowAllSku) {
        let catalogUom: string | undefined;
        if (!String(pl.sku?.uom ?? "").trim()) {
          catalogUom = await loadSkuUomBySkuId(db, pl.sku?.skuId ?? resolvedSku?.skuId);
        }
        customuom = customUomForScopeShowAllLine(pl.sku?.uom, catalogUom);
      }
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
      const newRef = db.collection("projectareaobjects").doc();
      batch.set(newRef, {
        projectid,
        projectAreaDocId,
        objectid: pl.objectid,
        ...(objectName ? { objectname: objectName } : {}),
        areaid,
        lineSortOrder,
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
      newLineDocIds.push(newRef.id);
      linesAdded += 1;
      lineSortOrder += PROJECT_AREA_LINE_SORT_STEP;
    }
    await batch.commit();
    }
  });
  return { linesAdded, newLineDocIds };
}

async function loadCurrentCatalogSkuIdSet(db: Firestore): Promise<Set<string>> {
  const snap = await db.collection(DATA_SKUS_COLLECTION).get();
  const ids = new Set<string>();
  for (const d of snap.docs) {
    if (isDataSkusMetaDocument(d.id)) continue;
    const data = d.data();
    if (data.isCurrent === false) continue;
    ids.add(d.id);
    const skuId = String(data.skuId ?? "").trim();
    if (skuId) ids.add(skuId);
  }
  return ids;
}

function readLineSortOrder(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

async function deleteLineDocsAndBundledChildren(
  db: Firestore,
  areaSnapDocs: QueryDocumentSnapshot[],
  parentIds: Set<string>,
): Promise<number> {
  const toDelete = areaSnapDocs.filter((d) => {
    if (parentIds.has(d.id)) return true;
    const x = d.data();
    const parentId = String(x.bundledFromLineId ?? "").trim();
    return x.linesource === "bundled" && parentId && parentIds.has(parentId);
  });
  let removed = 0;
  const BATCH_MAX = 400;
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

async function findQuoteObjectForObjectId(
  db: Firestore,
  objectid: number,
  attachedQuoteObjectIds: string[],
  preferShowAll: Partial<Record<string, boolean>>,
): Promise<{ docId: string; data: DocumentData } | null> {
  let fallback: { docId: string; data: DocumentData } | null = null;
  for (const docId of attachedQuoteObjectIds) {
    const trimmed = docId.trim();
    if (!trimmed || isSystemScopeObjectId(trimmed)) continue;
    const snap = await db.collection("quote_objects").doc(trimmed).get();
    if (!snap.exists || isQuoteObjectsMetaDocument(snap.id)) continue;
    const data = snap.data() as DocumentData;
    const oid = integerObjectId(data.objectid);
    if (oid !== objectid) continue;
    const hit = { docId: trimmed, data };
    if (preferShowAll[trimmed] === true) return hit;
    if (!fallback) fallback = hit;
  }
  if (fallback) return fallback;
  const byId = await loadQuoteMapForNumericObjectIds(db, [objectid]);
  const data = byId.get(objectid);
  if (!data) return null;
  return { docId: "", data };
}

async function lineSpecsForRepopulateObject(
  db: Firestore,
  args: {
    projectAreaDocId: string;
    projectid: number;
    objectid: number;
    answer: ScopeAnswerPublic;
    existingShowAll: boolean;
    existingSkuIds: string[];
    existingObjectNames: string[];
    scopeInheritByObjectId: Map<number, InheritMeasureSource>;
    scopeInheritMeasureLockedByObjectId: Map<number, boolean>;
    showAllDefaultByObjectId: Map<number, number>;
  },
): Promise<ScopeLineCreateSpec[]> {
  clearDataSkusResolveCache();
  clearColourLookupIndexCache();
  const { style, colour } = await resolveEffectiveStyleColour(
    db,
    args.projectAreaDocId,
    args.projectid,
  );
  const elevateLevel = await resolveEffectiveElevateLevel(
    db,
    args.projectAreaDocId,
    args.projectid,
  );
  const filters = { elevateLevel, style, colour };
  const attachedShowAll = args.answer.attachedObjectShowAll ?? {};
  const attachedShowAllDefault = args.answer.attachedObjectShowAllDefault ?? {};
  const attachedNoCharge = args.answer.attachedObjectNoCharge ?? {};
  const attachedInheritM2 = args.answer.attachedObjectInheritM2Source ?? {};
  const attachedInheritMeasureLocked = args.answer.attachedObjectInheritMeasureLocked ?? {};

  const found = await findQuoteObjectForObjectId(
    db,
    args.objectid,
    args.answer.attachedQuoteObjectIds ?? [],
    attachedShowAll,
  );
  if (!found) return [];

  const trimmed = found.docId;
  const data = found.data;
  const scopeInherit = trimmed ? attachedInheritM2[trimmed] : undefined;
  if (scopeInherit !== undefined && isInheritMeasureSource(scopeInherit)) {
    args.scopeInheritByObjectId.set(args.objectid, scopeInherit);
  }
  if (trimmed && attachedInheritMeasureLocked[trimmed] === false) {
    args.scopeInheritMeasureLockedByObjectId.set(args.objectid, false);
  }

  const seed = {
    objectid: args.objectid,
    quoteObjectDocId: trimmed || undefined,
    quoteData: data,
    notes1: String(data.notes1 ?? ""),
    notes2: String(data.notes2 ?? ""),
  };
  const answerShowAll = trimmed ? attachedShowAll[trimmed] === true : false;
  const showAll = answerShowAll || args.existingShowAll;
  const noCharge = trimmed ? attachedNoCharge[trimmed] === true : false;
  const lineFlags = { scopeNoCharge: noCharge };
  if (showAll) {
    const parsed = trimmed
      ? parseScopeShowAllDefaultQty(attachedShowAllDefault[trimmed])
      : undefined;
    args.showAllDefaultByObjectId.set(args.objectid, parsed ?? 1);
    const skus = await resolveShowAllSkusForQuoteObject(db, data, filters, {
      lineObjectNames: args.existingObjectNames,
      existingSkuIds: args.existingSkuIds,
    });
    if (skus.length === 0) {
      return [{ ...seed, sku: null, scopeShowAllSku: false, ...lineFlags }];
    }
    return skus.map((sku) => ({
      ...seed,
      sku: { skuId: sku.skuId, product: sku.product, uom: sku.uom },
      scopeShowAllSku: true,
      ...lineFlags,
    }));
  }
  const resolved = await resolveSkuForQuoteObject(db, data, filters);
  return [
    {
      ...seed,
      sku: resolved ? { skuId: resolved.skuId, product: resolved.product } : null,
      scopeShowAllSku: false,
      ...lineFlags,
    },
  ];
}

/**
 * Merge catalog SKUs into one quote object on a scope instance.
 * Keeps lines whose skuId is still in the current scope set (including quantity).
 * Drops orphan SKU lines (never keeps orphan quantities) and adds missing SKUs at defaults.
 */
export async function repopulateScopeObjectOnProjectArea(
  db: Firestore,
  projectAreaDocId: string,
  scopeDocId: string,
  objectid: number,
  scopeInstanceId?: string | null,
): Promise<RepopulateScopeObjectResult> {
  if (isProjectAreasMetaDocument(projectAreaDocId)) {
    throw new Error("Invalid project area");
  }
  if (isScopesMetaDocument(scopeDocId)) {
    throw new Error("Invalid scope");
  }
  if (!Number.isInteger(objectid) || objectid <= 0) {
    throw new Error("Invalid object");
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
    throw new Error("Section markers have no objects to repopulate");
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

  const current = parseScopeAnswersFromFirestore(paData.scopeAnswers);
  const entry = current.find(
    (e) =>
      e.scopeDocId === scopeDocId &&
      matchesScopeInstance(e.scopeInstanceId, scopeInstanceId),
  );
  if (!entry) {
    throw new Error("No scope answer to repopulate");
  }
  const answers = firestoreAnswersToPublic(scopeData.answers);
  const answer = answers.find((a) => a.answerid === entry.answerid);
  if (!answer) {
    throw new Error("Unknown scope answer");
  }

  const collected = await collectScopeLineSpecsForAnswer(db, {
    projectAreaDocId,
    projectid,
    areaid,
    templateAreaDocId,
    scopeData,
    answerid: entry.answerid,
    answer,
  });

  const areaSnap = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();
  const existing: {
    id: string;
    skuId: string;
    lineSortOrder: number | null;
    scopeShowAllSku: boolean;
    objectname: string;
    skuProduct: string;
  }[] = [];
  for (const d of areaSnap.docs) {
    if (isProjectAreaObjectsMetaDocument(d.id)) continue;
    const x = d.data();
    if (x.linesource !== "scope") continue;
    if (String(x.scopeDocId ?? "") !== scopeDocId) continue;
    if (!matchesScopeInstance(x.scopeInstanceId as string | null | undefined, scopeInstanceId)) {
      continue;
    }
    if (Number(x.objectid) !== objectid) continue;
    if (x.systemObjectKind === "blinds") continue;
    existing.push({
      id: d.id,
      skuId: String(x.skuId ?? "").trim(),
      lineSortOrder: readLineSortOrder(x.lineSortOrder),
      scopeShowAllSku: x.scopeShowAllSku === true,
      objectname: String(x.objectname ?? "").trim(),
      skuProduct: String(x.skuProduct ?? "").trim(),
    });
  }

  const currentSkuIds = await loadCurrentCatalogSkuIdSet(db);
  const hasOrphan = existing.some((row) =>
    projectLineHasOrphanSku({ skuId: row.skuId || null }, currentSkuIds),
  );

  const existingShowAll =
    existing.some((row) => row.scopeShowAllSku) || existing.length > 1;
  let objectSpecs = await lineSpecsForRepopulateObject(db, {
    projectAreaDocId,
    projectid,
    objectid,
    answer,
    existingShowAll,
    existingSkuIds: existing.map((row) => row.skuId).filter((id) => id.length > 0),
    existingObjectNames: existing.map((row) => row.objectname).filter((n) => n.length > 0),
    scopeInheritByObjectId: collected.scopeInheritByObjectId,
    scopeInheritMeasureLockedByObjectId: collected.scopeInheritMeasureLockedByObjectId,
    showAllDefaultByObjectId: collected.showAllDefaultByObjectId,
  });
  if (objectSpecs.length === 0) {
    objectSpecs = collected.lineSpecs.filter(
      (s) => s.objectid === objectid && s.systemObjectKind !== "blinds",
    );
  }
  if (objectSpecs.length === 0) {
    throw new Error("This object is not on the current scope answer");
  }

  const desiredSkuIds = new Set(
    objectSpecs
      .map((s) => s.sku?.skuId?.trim() ?? "")
      .filter((id) => id.length > 0),
  );
  const presentSkuIds = new Set(existing.map((row) => row.skuId).filter((id) => id.length > 0));
  const presentProducts = new Set(
    existing
      .map((row) => normalizeSkuPart(row.skuProduct))
      .filter((p) => p.length > 0),
  );
  const missingDesired = objectSpecs.some((s) => {
    const id = s.sku?.skuId?.trim() ?? "";
    if (id && presentSkuIds.has(id)) return false;
    const product = normalizeSkuPart(s.sku?.product ?? "");
    if (product && presentProducts.has(product)) return false;
    return id.length > 0 || product.length > 0;
  });
  if (!hasOrphan && !missingDesired) {
    throw new Error("This object already has every current catalog SKU for this Show All / filter set");
  }

  const keepIds = new Set<string>();
  const keptSkuIds = new Set<string>();
  const keptProducts = new Set<string>();
  for (const row of existing) {
    const inCatalog = Boolean(row.skuId && currentSkuIds.has(row.skuId));
    const inDesired = Boolean(row.skuId && desiredSkuIds.has(row.skuId));
    if (inCatalog || inDesired || !row.skuId) {
      keepIds.add(row.id);
      if (row.skuId) keptSkuIds.add(row.skuId);
      const product = normalizeSkuPart(row.skuProduct);
      if (product) keptProducts.add(product);
    }
  }

  const dropIds = new Set(existing.filter((row) => !keepIds.has(row.id)).map((row) => row.id));
  const linesRemoved = await deleteLineDocsAndBundledChildren(db, areaSnap.docs, dropIds);

  const specsToAdd = objectSpecs
    .filter((s) => {
      const id = s.sku?.skuId?.trim() ?? "";
      if (!id || keptSkuIds.has(id)) return false;
      const product = normalizeSkuPart(s.sku?.product ?? "");
      if (product && keptProducts.has(product)) return false;
      return true;
    })
    .map((s) => ({ ...s, objectid }));

  const remainingSorts = existing
    .filter((row) => keepIds.has(row.id))
    .map((row) => row.lineSortOrder)
    .filter((n): n is number => n != null);
  const droppedSorts = existing
    .filter((row) => dropIds.has(row.id))
    .map((row) => row.lineSortOrder)
    .filter((n): n is number => n != null);
  let startingLineSortOrder: number;
  if (remainingSorts.length > 0) {
    startingLineSortOrder = Math.max(...remainingSorts) + PROJECT_AREA_LINE_SORT_STEP;
  } else if (droppedSorts.length > 0) {
    startingLineSortOrder = Math.min(...droppedSorts);
  } else {
    startingLineSortOrder = await nextProjectAreaLineSortOrder(db, projectAreaDocId, projectid);
  }

  const scopeMetrics = firestoreScopeMetricsToPublic(scopeData.scopeMetrics);
  const scopeMetricValues = parseScopeMetricValuesFromFirestore(paData.scopeMetricValues);
  const metricMap = scopeMetricValuesMap(scopeMetricValues);

  const materialized =
    specsToAdd.length > 0
      ? await materializeScopeLineSpecs(db, {
          paData,
          projectAreaDocId,
          projectid,
          areaid,
          scopeDocId,
          scopeInstanceId,
          answerid: entry.answerid,
          scopeNumericId,
          lineSpecs: specsToAdd,
          scopeInheritByObjectId: collected.scopeInheritByObjectId,
          scopeInheritMeasureLockedByObjectId: collected.scopeInheritMeasureLockedByObjectId,
          showAllDefaultByObjectId: collected.showAllDefaultByObjectId,
          metricMap,
          scopeMetrics,
          startingLineSortOrder,
          effectivePl: collected.effectivePl,
        })
      : { linesAdded: 0, newLineDocIds: [] as string[] };
  const linesAdded = materialized.linesAdded;
  if (materialized.newLineDocIds.length > 0) {
    await coalesceProjectAreaObjectLines(
      db,
      projectAreaDocId,
      projectid,
      objectid,
      materialized.newLineDocIds,
      { scopeDocId, scopeInstanceId },
    );
  }

  return {
    linesRemoved,
    linesAdded,
    linesKept: keepIds.size,
  };
}

function answerNeedsSkuCatalog(answer: ScopeAnswerPublic): boolean {
  return (answer.attachedQuoteObjectIds ?? []).some(
    (id) => id.trim().length > 0 && !isSystemScopeObjectId(id.trim()),
  );
}

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
  const timings: ScopeAnswerTimings = {
    skuCacheWasWarm: isDataSkusResolveCacheWarm(),
    supplierCacheWasWarm: isPrimarySupplierPriceCacheWarm(),
    colourLookupCacheWasWarm: isColourLookupIndexCacheWarm(),
    skuCacheCount: dataSkusResolveCacheCount(),
  };
  const applyT0 = performance.now();
  const finish = (
    result: ApplyScopeAnswerResult,
  ): ApplyScopeAnswerResult => {
    timings.applyTotalMs = Math.round(performance.now() - applyT0);
    timings.skuCacheCount = dataSkusResolveCacheCount();
    result.diagnostics = { ...result.diagnostics, timings };
    console.info("[scope-answer timing]", {
      projectAreaDocId,
      scopeDocId,
      answerid,
      linesAdded: result.linesAdded,
      linesRemoved: result.linesRemoved,
      timings,
    });
    return result;
  };

  if (isProjectAreasMetaDocument(projectAreaDocId)) {
    throw new Error("Invalid project area");
  }
  if (isScopesMetaDocument(scopeDocId)) {
    throw new Error("Invalid scope");
  }

  const paRef = db.collection("projectareas").doc(projectAreaDocId);
  const scopeRef = db.collection("scopes").doc(scopeDocId);
  const [paSnap, scopeSnap] = await Promise.all([
    timedValue(timings, "loadProjectAreaMs", () => paRef.get()),
    timedValue(timings, "loadScopeMs", () => scopeRef.get()),
  ]);
  if (!paSnap.exists) throw new Error("Project area not found");
  const paData = paSnap.data() as DocumentData;
  const projectid = Number(paData.projectid);
  const areaid = Number(paData.areaid);
  if (!Number.isInteger(projectid) || !Number.isInteger(areaid)) {
    throw new Error("Invalid project area data");
  }
  if (!scopeSnap.exists) throw new Error("Scope not found");
  const scopeData = scopeSnap.data() as DocumentData;
  if (scopeData.kind === "header" || scopeData.kind === "footer") {
    throw new Error("Section markers have no answers to apply");
  }
  const [tmplSnap, projectData] = await Promise.all([
    timedValue(timings, "loadTemplateAreaMs", () =>
      db.collection("areas").where("areaid", "==", areaid).limit(1).get(),
    ),
    timedValue(timings, "loadProjectMs", () => loadProjectDataByNumericId(db, projectid)),
  ]);
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
  const effectivePl = effectivePriceLevelIdFromData(paData, projectData ?? undefined);
  const { style, colour } = effectiveStyleColourFromData(paData, projectData ?? undefined);
  const projDims = projectDimensionsFromData(projectData ?? undefined);
  const paForPublic = () =>
    ({
      ...paData,
      scopeAnswers: current,
      scopeMetricValues,
    }) as DocumentData;

  if (answerid === null || answerid === "") {
    const deleted = await deleteScopeLinesForScope(
      db,
      projectid,
      projectAreaDocId,
      scopeDocId,
      scopeInstanceId,
      timings,
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
    await timedValue(timings, "updateAnswersMs", () =>
      paRef.update({
        scopeAnswers: current,
        scopeMetricValues,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
    return finish({
      linesRemoved: deleted.removed,
      linesAdded: 0,
      scopeAnswers: current,
      diagnostics: {
        effectivePriceLevelId: effectivePl,
        noLinesReason: "answer_cleared",
      },
      removedLineIds: deleted.ids,
      addedLines: [],
      paDataForPublic: paForPublic(),
    });
  }

  const answer = answers.find((a) => a.answerid === answerid);
  if (!answer) {
    throw new Error("Unknown scope answer");
  }
  const needsSkuCatalog = answerNeedsSkuCatalog(answer);

  const catalogPrime = needsSkuCatalog
    ? timedValue(timings, "primeCatalogsWallMs", () =>
        Promise.all([
          primeDataSkusResolveCache(db),
          primePrimarySupplierPriceCache(db),
          loadAllObjectLabourRates(db),
          loadAllContractLabourRates(db),
          loadColourLookupIndex(db),
        ]),
      )
    : Promise.resolve();

  const [deleted, elevateLevel, , lmRunsRollWidthFallback] = await Promise.all([
    deleteScopeLinesForScope(
      db,
      projectid,
      projectAreaDocId,
      scopeDocId,
      scopeInstanceId,
      timings,
    ),
    needsSkuCatalog
      ? timedValue(timings, "elevateMs", () =>
          resolveElevateLevelFromPriceLevelAndFinish(
            db,
            effectivePl,
            projectFinishFromData(projectData ?? undefined),
          ),
        )
      : Promise.resolve(""),
    catalogPrime,
    timedValue(timings, "lmRunsRollWidthMs", () => loadLmRunsRollWidthMFromDb(db)),
  ]);
  const linesRemoved = deleted.removed;

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
  const [collected] = await Promise.all([
    timedValue(timings, "collectMs", () =>
      collectScopeLineSpecsForAnswer(db, {
        projectAreaDocId,
        projectid,
        areaid,
        templateAreaDocId,
        scopeData,
        answerid,
        answer,
        timings,
        loadedFilters: { effectivePl, style, colour, elevateLevel },
      }),
    ),
    timedValue(timings, "updateAnswersMs", () =>
      paRef.update({
        scopeAnswers: current,
        scopeMetricValues,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ),
  ]);
  if (timings) timings.lineSpecs = collected.lineSpecs.length;
  if (collected.lineSpecs.length === 0) {
    const diag: ScopeAnswerDiagnostics = {
      effectivePriceLevelId: collected.effectivePl,
      noLinesReason: collected.noLinesReason,
      attachedObjectNames:
        collected.attachedObjectNames.length > 0 ? collected.attachedObjectNames : undefined,
      attachedCategories:
        collected.attachedCategories.length > 0 ? collected.attachedCategories : undefined,
      answerTierIds: collected.answerTierIds,
    };
    if (collected.noLinesReason !== "no_objects_configured") {
      console.warn("[applyScopeAnswerToProjectArea] no scope lines materialized", {
        projectAreaDocId,
        scopeDocId,
        answerid,
        ...diag,
      });
    }
    return finish({
      linesRemoved,
      linesAdded: 0,
      scopeAnswers: current,
      diagnostics: diag,
      removedLineIds: deleted.ids,
      addedLines: [],
      paDataForPublic: paForPublic(),
    });
  }

  const metricMap = scopeMetricValuesMap(scopeMetricValues);
  const startingLineSortOrder = deleted.nextLineSortOrder;
  const materialized = await timedValue(timings, "materializeMs", () =>
    materializeScopeLineSpecs(db, {
      paData,
      projectAreaDocId,
      projectid,
      areaid,
      scopeDocId,
      scopeInstanceId,
      answerid,
      scopeNumericId,
      lineSpecs: collected.lineSpecs,
      scopeInheritByObjectId: collected.scopeInheritByObjectId,
      scopeInheritMeasureLockedByObjectId: collected.scopeInheritMeasureLockedByObjectId,
      showAllDefaultByObjectId: collected.showAllDefaultByObjectId,
      metricMap,
      scopeMetrics,
      startingLineSortOrder,
      effectivePl: collected.effectivePl,
      timings,
      loadedPricing: { style, colour, elevateLevel, projDims, lmRunsRollWidthFallback },
    }),
  );
  const quoteByObjectId = new Map<number, DocumentData>();
  for (const spec of collected.lineSpecs) {
    if (spec.quoteData) quoteByObjectId.set(spec.objectid, spec.quoteData);
  }
  const addedLines = await timedValue(timings, "readAddedLinesMs", async () => {
    if (materialized.newLineDocIds.length === 0) return [] as ProjectAreaObjectPublic[];
    const snaps = await db.getAll(
      ...materialized.newLineDocIds.map((id) => db.collection("projectareaobjects").doc(id)),
    );
    return snaps
      .filter((s) => s.exists)
      .map((s) => docToProjectAreaObjectPublic(s.id, s.data()!, quoteByObjectId));
  });

  return finish({
    linesRemoved,
    linesAdded: materialized.linesAdded,
    scopeAnswers: current,
    diagnostics: {
      effectivePriceLevelId: collected.effectivePl,
      attachedObjectNames:
        collected.attachedObjectNames.length > 0 ? collected.attachedObjectNames : undefined,
      attachedCategories:
        collected.attachedCategories.length > 0 ? collected.attachedCategories : undefined,
      answerTierIds: collected.answerTierIds,
    },
    removedLineIds: deleted.ids,
    addedLines,
    paDataForPublic: paForPublic(),
  });
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
