import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import { isAreasQuestionsMetaDocument } from "@/lib/firestore/areasquestions-collection";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { compareTemplateDocs } from "@/lib/server/template-sort-order";
import { purgeStaleAreaLinesBeforeSeed } from "@/lib/server/project-area-line-backfill";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import {
  ensureAreaNumericId,
  ensureProjectNumericId,
} from "@/lib/server/resolve-ids";
import {
  customMeasureForNewProjectLine,
  effectiveMeasureForLinePricing,
  quoteTemplatePricingForPriceLevel,
} from "@/lib/server/quote-object-doc";
import {
  applyProjectLineLabourHours,
  labourHoursToFirestore,
  loadAllObjectLabourRates,
} from "@/lib/server/labour-hours";
import { readTooltipFromQuoteObjectData } from "@/lib/server/area-object-tooltip";
import { resolveEffectivePriceLevelId } from "@/lib/server/resolve-effective-price-level";
import { loadProjectDimensionsByProjectId } from "@/lib/server/project-dimensions";
import { loadLmRunsRollWidthMFromDb } from "@/lib/server/load-lm-runs-roll-width";

function integerObjectId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

export async function loadQuoteByObjectIdMap(
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

const QUOTE_OBJECT_IN_CHUNK = 30;
const QUOTE_OBJECT_GETALL_CHUNK = 100;

function addQuoteSnapToObjectIdMap(
  map: Map<number, DocumentData>,
  docs: { id: string; data: () => DocumentData }[],
): void {
  for (const d of docs) {
    if (isQuoteObjectsMetaDocument(d.id)) continue;
    const data = d.data();
    const oid = integerObjectId(data.objectid);
    if (oid !== undefined && !map.has(oid)) map.set(oid, data);
  }
}

/**
 * Quote-object templates for the given numeric objectids. Avoids scanning the full catalog.
 * Looks up both number and string `objectid` (legacy mixed types). Empty map on query errors.
 */
export async function loadQuoteMapForNumericObjectIds(
  db: Firestore,
  objectids: Iterable<number | undefined | null>,
): Promise<Map<number, DocumentData>> {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const raw of objectids) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw === 0) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    ids.push(raw);
  }
  const map = new Map<number, DocumentData>();
  if (ids.length === 0) return map;

  const col = db.collection("quote_objects");
  const queries: Promise<{ docs: { id: string; data: () => DocumentData }[] } | null>[] = [];
  for (let i = 0; i < ids.length; i += QUOTE_OBJECT_IN_CHUNK) {
    const chunk = ids.slice(i, i + QUOTE_OBJECT_IN_CHUNK);
    queries.push(col.where("objectid", "in", chunk).get().catch(() => null));
    queries.push(col.where("objectid", "in", chunk.map(String)).get().catch(() => null));
  }
  const snaps = await Promise.all(queries);
  for (const snap of snaps) {
    if (!snap) continue;
    addQuoteSnapToObjectIdMap(map, snap.docs);
  }
  return map;
}

/**
 * One quote-object template for a line PATCH/GET. Avoids scanning the full catalog.
 * Quote lookup must never fail the caller’s write — returns an empty map on error.
 */
export async function loadQuoteMapForNumericObjectId(
  db: Firestore,
  objectid: number | undefined,
): Promise<Map<number, DocumentData>> {
  if (objectid === undefined || !Number.isInteger(objectid) || objectid === 0) {
    return new Map();
  }
  return loadQuoteMapForNumericObjectIds(db, [objectid]);
}

/** Quote-object documents by Firestore doc id (no catalog scan). */
export async function loadQuoteDocsByIds(
  db: Firestore,
  docIds: Iterable<string>,
): Promise<Map<string, DocumentData>> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of docIds) {
    const id = raw.trim();
    if (!id || isQuoteObjectsMetaDocument(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  const map = new Map<string, DocumentData>();
  if (ids.length === 0) return map;

  for (let i = 0; i < ids.length; i += QUOTE_OBJECT_GETALL_CHUNK) {
    const refs = ids
      .slice(i, i + QUOTE_OBJECT_GETALL_CHUNK)
      .map((id) => db.collection("quote_objects").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists || isQuoteObjectsMetaDocument(snap.id)) continue;
      map.set(snap.id, snap.data() as DocumentData);
    }
  }
  return map;
}

export type ProjectAreaSeedPayload = {
  areanotes1?: string;
  areanotes2?: string;
  aream2?: number | null;
  /** Per-area ceiling height override (m); null uses project default. */
  ceilingheightm?: number | null;
  areafinish?: string;
  /** Per-area price level override; null uses project default when seeding. */
  pricelevelid?: number | null;
  /** Per-area Style override; null uses project default. */
  style?: string | null;
  /** Per-area Colour override; null uses project default. */
  colour?: string | null;
  /** Optional instance label (e.g. "Bedroom 2"). */
  displayName?: string | null;
};

export type AddProjectAreaOptions = {
  /** Reuse across multiple adds to avoid re-reading quote_objects. */
  quoteByObjectId?: Map<number, DocumentData>;
};

type TradeSnapshot = { lookupid: number; lookupvalue: string };

function integerId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

async function seedProjectAreaAnswersFromTemplateQuestions(args: {
  db: Firestore;
  projectid: number;
  projectAreaDocId: string;
  areaid: number;
}): Promise<{ seededAnswerCount: number }> {
  const { db, projectid, projectAreaDocId, areaid } = args;

  const existingSnap = await db
    .collection("projectareaanswers")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();
  const existing = new Set<number>();
  for (const d of existingSnap.docs) {
    const qid = integerId(d.data()?.areaQuestionId);
    if (qid != null) existing.add(qid);
  }

  const tradesSnap = await db.collection("lookups").where("lookuptype", "==", "Trades").get();
  const tradeLabelById = new Map<number, string>();
  for (const d of tradesSnap.docs) {
    if (isLookupsMetaDocument(d.id)) continue;
    const data = d.data();
    const id = integerId(data.lookupid);
    if (id == null) continue;
    const label = String(data.lookupvalue ?? "").trim();
    if (!label) continue;
    tradeLabelById.set(id, label);
  }

  const qsSnap = await db
    .collection("areasquestions")
    .where("areaId", "==", areaid)
    .where("active", "==", true)
    .get();

  const questions = qsSnap.docs
    .filter((d) => !isAreasQuestionsMetaDocument(d.id))
    .map((d) => d.data())
    .map((data) => {
      const questionId = integerId(data.questionId) ?? 0;
      const questionText = String(data.questionText ?? "");
      const defaultAnswer = String(data.defaultAnswer ?? "");
      const sortOrder =
        typeof data.sortOrder === "number" && Number.isFinite(data.sortOrder) ? data.sortOrder : null;
      const tradeIds = Array.isArray(data.applicableTradeLookupIds)
        ? data.applicableTradeLookupIds
            .map((x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : null))
            .filter((x: number | null): x is number => x != null)
        : [];
      return { questionId, questionText, defaultAnswer, sortOrder, tradeIds };
    })
    .filter((q) => q.questionId > 0 && q.questionText.trim())
    .sort((a, b) => {
      const aso = a.sortOrder ?? Number.POSITIVE_INFINITY;
      const bso = b.sortOrder ?? Number.POSITIVE_INFINITY;
      if (aso !== bso) return aso - bso;
      return a.questionText.localeCompare(b.questionText, undefined, { sensitivity: "base" });
    });

  const toSeed = questions.filter((q) => !existing.has(q.questionId));
  if (toSeed.length === 0) return { seededAnswerCount: 0 };

  let seededAnswerCount = 0;
  const BATCH_MAX = 400;
  for (let i = 0; i < toSeed.length; i += BATCH_MAX) {
    const slice = toSeed.slice(i, i + BATCH_MAX);
    const batch = db.batch();
    for (const q of slice) {
      const applicableTradesSnapshot: TradeSnapshot[] = q.tradeIds
        .map((id) => {
          const label = tradeLabelById.get(id);
          return label ? ({ lookupid: id, lookupvalue: label } satisfies TradeSnapshot) : null;
        })
        .filter((x): x is TradeSnapshot => x != null);
      batch.set(db.collection("projectareaanswers").doc(), {
        projectid,
        projectAreaDocId,
        areaid,
        areaQuestionId: q.questionId,
        questionTextSnapshot: q.questionText,
        applicableTradesSnapshot,
        answer: q.defaultAnswer,
        sortOrder: q.sortOrder,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      seededAnswerCount += 1;
    }
    await batch.commit();
  }
  return { seededAnswerCount };
}

/**
 * Creates a projectareas row and seeds projectareaobjects from template areaobjects
 * where `default === true` only. Non-default template lines stay available to add manually on the project.
 */
export async function addProjectAreaWithSeed(
  db: Firestore,
  projectDocId: string,
  areaDocId: string,
  payload: ProjectAreaSeedPayload,
  options?: AddProjectAreaOptions,
): Promise<{ id: string; seededLineCount: number }> {
  const projectid = await ensureProjectNumericId(db, projectDocId);
  const areaid = await ensureAreaNumericId(db, areaDocId);

  const areaTemplateSnap = await db.collection("areas").doc(areaDocId).get();
  const templateSo = areaTemplateSnap.data()?.sortOrder;
  const sortOrder =
    typeof templateSo === "number" && Number.isFinite(templateSo) ? templateSo : null;

  const displayName =
    typeof payload.displayName === "string" && payload.displayName.trim()
      ? payload.displayName.trim()
      : null;

  const ref = await db.collection("projectareas").add({
    projectid,
    areaid,
    sortOrder,
    ...(displayName ? { displayName } : {}),
    areanotes1: payload.areanotes1 ?? "",
    areanotes2: payload.areanotes2 ?? "",
    aream2: payload.aream2 ?? null,
    ceilingheightm: payload.ceilingheightm ?? null,
    areafinish: payload.areafinish ?? "",
    pricelevelid:
      payload.pricelevelid === undefined ? null : payload.pricelevelid,
    style: payload.style ?? null,
    colour: payload.colour ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await purgeStaleAreaLinesBeforeSeed(db, projectid, areaid, ref.id);

  const effectivePl = await resolveEffectivePriceLevelId(db, ref.id, projectid);
  const [projDims, lmRunsRollWidthFallback] = await Promise.all([
    loadProjectDimensionsByProjectId(db, projectid),
    loadLmRunsRollWidthMFromDb(db),
  ]);

  const quoteByObjectId =
    options?.quoteByObjectId ?? (await loadQuoteByObjectIdMap(db));
  const objectLabourRates = await loadAllObjectLabourRates(db);

  const areaObjectsSnap = await db
    .collection("areaobjects")
    .where("areaid", "==", areaid)
    .get();
  const secondary = (data: DocumentData, docId: string) =>
    `${String(data.objectid ?? "")}\u0000${docId}`;
  const areaObjectDocs = areaObjectsSnap.docs
    .filter((d) => {
      if (isAreaObjectsMetaDocument(d.id)) return false;
      return Boolean(d.data().default);
    })
    .sort((a, b) => compareTemplateDocs(a, b, secondary));

  let seededLineCount = 0;
  if (areaObjectDocs.length > 0) {
    const BATCH_MAX = 400;
    for (let i = 0; i < areaObjectDocs.length; i += BATCH_MAX) {
      const slice = areaObjectDocs.slice(i, i + BATCH_MAX);
      const batch = db.batch();
      for (const doc of slice) {
        const ao = doc.data();
        const objectid = integerObjectId(ao.objectid);
        if (objectid === undefined) continue;
        const q = quoteByObjectId.get(objectid);
        const pricing = quoteTemplatePricingForPriceLevel(q, effectivePl);
        const measureCtx = {
          areaM2: payload.aream2,
          apartmentTotalM2: projDims.apartmentTotalM2,
          apartmentHardM2: projDims.apartmentHardM2,
          apartmentSoftM2: projDims.apartmentSoftM2,
          lmRunsRollWidthFallback,
        };
        const custommeasure = customMeasureForNewProjectLine(
          q,
          pricing.measurement,
          measureCtx,
        );
        const customumprice = pricing.customumprice;
        const measureForPricing = effectiveMeasureForLinePricing(
          q,
          pricing.measurement,
          measureCtx,
          custommeasure,
        );
        let totalprice: number | null;
        if (measureForPricing != null && customumprice != null) {
          totalprice = measureForPricing * customumprice;
        } else {
          totalprice = pricing.totalprice;
        }
        const lineTooltip = q ? readTooltipFromQuoteObjectData(q) : "";
        const objectName = q ? String(q.objectname ?? "").trim() : "";
        const { hours: labourHours } = applyProjectLineLabourHours({
          objectName,
          skuProduct: null,
          quoteTemplate: q,
          objectLabourRates,
          custommeasure: measureForPricing,
          lineUom: pricing.customuom,
        });
        batch.set(db.collection("projectareaobjects").doc(), {
          projectid,
          projectAreaDocId: ref.id,
          objectid,
          ...(objectName ? { objectname: objectName } : {}),
          areaid,
          linesource: "default",
          dateadded: FieldValue.serverTimestamp(),
          custommeasure,
          customuom: pricing.customuom,
          customumprice,
          totalprice,
          notes1: String(ao.notes3 ?? ""),
          notes2: String(ao.notes4 ?? ""),
          tooltip: lineTooltip,
          ...labourHoursToFirestore(labourHours),
          included: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        seededLineCount += 1;
      }
      await batch.commit();
    }
  }

  await seedProjectAreaAnswersFromTemplateQuestions({
    db,
    projectid,
    projectAreaDocId: ref.id,
    areaid,
  });

  return { id: ref.id, seededLineCount };
}
