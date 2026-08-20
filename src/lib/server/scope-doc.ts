import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import { isInheritMeasureSource, isScopeMetricInheritSource } from "@/lib/scope-metrics";
import { parseScopeToolType, type ScopeToolType } from "@/lib/scope-tools";
import type {
  ScopeAnswerPublic,
  ScopePublic,
  ScopeShowAllDefaultQty,
} from "@/types/scope";
import { parseScopeShowAllDefaultQty } from "@/types/scope";
import type { InheritMeasureSource } from "@/types/scope-metric";
import type { ScopeMetricPublic } from "@/types/scope-metric";
import { normalizedScopeAreaState } from "@/lib/scope-areas";
import { readScopeToolFromFirestore } from "@/lib/scope-tools";
import { readSystemScopeFromFirestore } from "@/lib/system-scope-types";

/** Minimal area row for ordering scope tags (matches Setup → Areas order). */
export type ScopeTemplateAreaRow = {
  id: string;
  areaname: string;
  sortOrder?: number | null;
  areaid?: number | null;
};

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function normalizeAttachedQuoteObjectIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeAttachedObjectNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const n = x.trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function normalizeAttachedObjectTools(raw: unknown): Partial<Record<string, ScopeToolType>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<string, ScopeToolType>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    const tool = typeof value === "string" ? value.trim() : "";
    const parsed = tool ? parseScopeToolType(tool) : null;
    if (!id || !parsed) continue;
    out[id] = parsed;
  }
  return out;
}

function normalizeAttachedObjectFlags(
  raw: unknown,
  attachedIds: string[],
): Partial<Record<string, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, boolean>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || !allowed.has(id) || value !== true) continue;
    out[id] = true;
  }
  return out;
}

function normalizeAttachedObjectShowAllDefault(
  raw: unknown,
  attachedIds: string[],
  showAll: Partial<Record<string, boolean>>,
): Partial<Record<string, ScopeShowAllDefaultQty>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, ScopeShowAllDefaultQty>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    const parsed = parseScopeShowAllDefaultQty(value);
    if (!id || !allowed.has(id) || !showAll[id] || parsed == null) continue;
    out[id] = parsed;
  }
  return out;
}

function normalizeAttachedObjectInheritM2Sources(
  raw: unknown,
  attachedIds: string[],
): Partial<Record<string, InheritMeasureSource>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, InheritMeasureSource>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    const src = typeof value === "string" ? value.trim() : "";
    if (!id || !allowed.has(id) || !isInheritMeasureSource(src)) continue;
    out[id] = src;
  }
  return out;
}

function normalizeAttachedObjectInheritMeasureLocked(
  raw: unknown,
  attachedIds: string[],
  inheritSources: Partial<Record<string, InheritMeasureSource>>,
): Partial<Record<string, boolean>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, boolean>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || !allowed.has(id) || value !== false) continue;
    const inherit = inheritSources[id];
    if (inherit && isScopeMetricInheritSource(inherit)) out[id] = false;
  }
  return out;
}

export function firestoreScopeMetricsToPublic(raw: unknown): ScopeMetricPublic[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopeMetricPublic[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const metricid = String(rec.metricid ?? "").trim();
    const label = String(rec.label ?? "").trim();
    const uom = String(rec.uom ?? "").trim();
    if (!metricid || !label || !uom) continue;
    const answeridsRaw = rec.answerids;
    const answerids = Array.isArray(answeridsRaw)
      ? answeridsRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    out.push({ metricid, label, uom, answerids: [...new Set(answerids.map((x) => x.trim()))] });
  }
  return out.slice(0, 4);
}

function normalizeAttachedCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const c = x.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function firestoreAnswersToPublic(raw: unknown): ScopeAnswerPublic[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopeAnswerPublic[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const answerid = String(rec.answerid ?? "");
    const label = String(rec.label ?? "");
    if (!answerid || !label) continue;
    const attachedQuoteObjectIds = normalizeAttachedQuoteObjectIds(rec.attachedQuoteObjectIds);
    const toolsRaw = normalizeAttachedObjectTools(rec.attachedObjectTools);
    const showAllRaw = normalizeAttachedObjectFlags(
      rec.attachedObjectShowAll,
      attachedQuoteObjectIds,
    );
    const showAllDefaultRaw = normalizeAttachedObjectShowAllDefault(
      rec.attachedObjectShowAllDefault,
      attachedQuoteObjectIds,
      showAllRaw,
    );
    const noChargeRaw = normalizeAttachedObjectFlags(
      rec.attachedObjectNoCharge,
      attachedQuoteObjectIds,
    );
    const forceRaw = normalizeAttachedObjectFlags(
      rec.attachedObjectForce,
      attachedQuoteObjectIds,
    );
    const inheritRaw = normalizeAttachedObjectInheritM2Sources(
      rec.attachedObjectInheritM2Source,
      attachedQuoteObjectIds,
    );
    const inheritLockedRaw = normalizeAttachedObjectInheritMeasureLocked(
      rec.attachedObjectInheritMeasureLocked,
      attachedQuoteObjectIds,
      inheritRaw,
    );
    const attachedObjectTools: Partial<Record<string, ScopeToolType>> = {};
    for (const id of attachedQuoteObjectIds) {
      const tool = toolsRaw[id];
      if (tool) attachedObjectTools[id] = tool;
    }
    const attachedObjectShowAll: Partial<Record<string, boolean>> = {};
    const attachedObjectShowAllDefault: Partial<Record<string, ScopeShowAllDefaultQty>> = {};
    const attachedObjectNoCharge: Partial<Record<string, boolean>> = {};
    const attachedObjectForce: Partial<Record<string, boolean>> = {};
    const attachedObjectInheritM2Source: Partial<Record<string, InheritMeasureSource>> = {};
    const attachedObjectInheritMeasureLocked: Partial<Record<string, boolean>> = {};
    for (const id of attachedQuoteObjectIds) {
      if (showAllRaw[id]) attachedObjectShowAll[id] = true;
      const showAllDefault = showAllDefaultRaw[id];
      if (showAllDefault != null) attachedObjectShowAllDefault[id] = showAllDefault;
      if (noChargeRaw[id]) attachedObjectNoCharge[id] = true;
      if (forceRaw[id]) attachedObjectForce[id] = true;
      const inherit = inheritRaw[id];
      if (inherit) attachedObjectInheritM2Source[id] = inherit;
      if (inheritLockedRaw[id] === false) attachedObjectInheritMeasureLocked[id] = false;
    }
    out.push({
      answerid,
      label,
      attachedQuoteObjectIds,
      attachedObjectNames: normalizeAttachedObjectNames(rec.attachedObjectNames),
      attachedCategories: normalizeAttachedCategories(rec.attachedCategories),
      attachedObjectTools:
        Object.keys(attachedObjectTools).length > 0 ? attachedObjectTools : undefined,
      attachedObjectShowAll:
        Object.keys(attachedObjectShowAll).length > 0 ? attachedObjectShowAll : undefined,
      attachedObjectShowAllDefault:
        Object.keys(attachedObjectShowAllDefault).length > 0
          ? attachedObjectShowAllDefault
          : undefined,
      attachedObjectNoCharge:
        Object.keys(attachedObjectNoCharge).length > 0 ? attachedObjectNoCharge : undefined,
      attachedObjectForce:
        Object.keys(attachedObjectForce).length > 0 ? attachedObjectForce : undefined,
      attachedObjectInheritM2Source:
        Object.keys(attachedObjectInheritM2Source).length > 0
          ? attachedObjectInheritM2Source
          : undefined,
      attachedObjectInheritMeasureLocked:
        Object.keys(attachedObjectInheritMeasureLocked).length > 0
          ? attachedObjectInheritMeasureLocked
          : undefined,
      includeOnDemolitionReport: (() => {
        if (typeof rec.includeOnDemolitionReport === "boolean") {
          return rec.includeOnDemolitionReport ? true : undefined;
        }
        // Legacy: labels starting with "Keep Existing" before the explicit flag existed
        return label.trim().toLowerCase().startsWith("keep existing") ? true : undefined;
      })(),
      defaultToTrue: rec.defaultToTrue === true ? true : undefined,
      suppressZeroSkuRows: rec.suppressZeroSkuRows === true ? true : undefined,
    });
  }
  return out;
}

/** Legacy `byPriceLevel` rows still in Firestore (pre–category scopes). */
export type LegacyScopeAnswerPriceLevel = {
  pricelevelid: number;
  objectPickOrder: string[];
  areaObjectDocIds: string[];
  quoteObjectDocIds: string[];
};

export function firestoreLegacyByPriceLevel(raw: unknown): LegacyScopeAnswerPriceLevel[] {
  if (!Array.isArray(raw)) return [];
  const byLevel = new Map<
    number,
    { objectPickOrder: string[]; ao: string[]; qo: string[] }
  >();
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const pricelevelid = Number(r.pricelevelid);
    const opoRaw = r.objectPickOrder;
    const objectPickOrder = Array.isArray(opoRaw)
      ? opoRaw.filter(
          (x): x is string =>
            typeof x === "string" &&
            (x.startsWith("ao:") || x.startsWith("qo:")) &&
            x.length > 3,
        )
      : [];
    const idsRaw = r.areaObjectDocIds;
    const areaObjectDocIds = Array.isArray(idsRaw)
      ? idsRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    const qoRaw = r.quoteObjectDocIds;
    const quoteObjectDocIds = Array.isArray(qoRaw)
      ? qoRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    const fallbackOrder = [
      ...areaObjectDocIds.map((id) => `ao:${id}`),
      ...quoteObjectDocIds.map((id) => `qo:${id}`),
    ];
    const order = objectPickOrder.length > 0 ? objectPickOrder : fallbackOrder;
    if (!Number.isInteger(pricelevelid) || order.length === 0) continue;
    const ao: string[] = [];
    const qo: string[] = [];
    const seenA = new Set<string>();
    const seenQ = new Set<string>();
    for (const p of order) {
      if (p.startsWith("ao:")) {
        const id = p.slice(3);
        if (id && !seenA.has(id)) {
          seenA.add(id);
          ao.push(id);
        }
      } else if (p.startsWith("qo:")) {
        const id = p.slice(3);
        if (id && !seenQ.has(id)) {
          seenQ.add(id);
          qo.push(id);
        }
      }
    }
    byLevel.set(pricelevelid, { objectPickOrder: order, ao, qo });
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pricelevelid, { objectPickOrder, ao, qo }]) => ({
      pricelevelid,
      areaObjectDocIds: ao,
      quoteObjectDocIds: qo,
      objectPickOrder,
    }));
}

export function orderScopeAreaDocIdsByTemplate(
  orderedAreas: ScopeTemplateAreaRow[],
  ids: string[],
): string[] {
  return orderAreaDocIdsByTemplate(orderedAreas, ids);
}

function orderAreaDocIdsByTemplate(orderedAreas: ScopeTemplateAreaRow[], ids: string[]): string[] {
  const index = new Map<string, number>();
  orderedAreas.forEach((a, i) => index.set(a.id, i));
  return [...ids].sort((x, y) => {
    const ix = index.get(x);
    const iy = index.get(y);
    const vx = ix !== undefined ? ix : 9999;
    const vy = iy !== undefined ? iy : 9999;
    if (vx !== vy) return vx - vy;
    return x.localeCompare(y);
  });
}

export function scopeDocToPublic(
  id: string,
  data: DocumentData,
  docIdByAreaid: Map<number, string>,
  nameByAreaid: Map<number, string>,
  areasOrdered: ScopeTemplateAreaRow[],
): ScopePublic {
  const rawKind = data.kind;
  const kind: ScopePublic["kind"] =
    rawKind === "header"
      ? "header"
      : rawKind === "footer"
        ? "footer"
        : "question";

  const { areaDocIds: rawTags, sortOrderByAreaDocId } = normalizedScopeAreaState(
    data as Record<string, unknown>,
    docIdByAreaid,
  );
  const areaDocIds = orderAreaDocIdsByTemplate(areasOrdered, rawTags);
  const legacySort = numOrNull(data.sortOrder) ?? null;

  const primaryDocId = areaDocIds[0] ?? "";
  const primaryRow = primaryDocId ? areasOrdered.find((a) => a.id === primaryDocId) : null;
  const primaryAreaid =
    primaryRow?.areaid != null && Number.isInteger(Number(primaryRow.areaid))
      ? Number(primaryRow.areaid)
      : primaryDocId
        ? ([...docIdByAreaid.entries()].find(([, d]) => d === primaryDocId)?.[0] ?? 0)
        : 0;
  const primaryName = primaryDocId
    ? (areasOrdered.find((a) => a.id === primaryDocId)?.areaname ??
      nameByAreaid.get(primaryAreaid) ??
      "")
    : "";

  const namesForDisplay: string[] = [];
  for (const ad of areaDocIds) {
    const ar = areasOrdered.find((a) => a.id === ad);
    if (ar?.areaname) namesForDisplay.push(String(ar.areaname));
    else {
      const aid = [...docIdByAreaid.entries()].find(([, d]) => d === ad)?.[0];
      if (aid !== undefined) namesForDisplay.push(nameByAreaid.get(aid) || `Area #${aid}`);
    }
  }

  const sortOrderForPrimary =
    primaryDocId && sortOrderByAreaDocId[primaryDocId] !== undefined
      ? sortOrderByAreaDocId[primaryDocId]
      : legacySort;

  const { systemScope, systemScopeType } = readSystemScopeFromFirestore(
    data as Record<string, unknown>,
  );
  const { exposeTool, scopeToolType } = readScopeToolFromFirestore(
    data as Record<string, unknown>,
  );

  return {
    id,
    scopeid: numOrNull(data.scopeid) ?? null,
    kind,
    areaDocIds,
    sortOrderByAreaDocId: { ...sortOrderByAreaDocId },
    sortOrder: sortOrderForPrimary,
    areaid: primaryAreaid,
    areaDocId: primaryDocId,
    areaname: primaryName,
    areaNamesDisplay: namesForDisplay.length ? namesForDisplay.join(", ") : primaryName,
    question: String(data.question ?? ""),
    explanation: (() => {
      const raw = data.explanation;
      if (typeof raw !== "string") return null;
      const t = raw.trim();
      return t || null;
    })(),
    answers: firestoreAnswersToPublic(data.answers),
    scopeMetrics: (() => {
      const m = firestoreScopeMetricsToPublic(data.scopeMetrics);
      return m.length > 0 ? m : undefined;
    })(),
    systemScope,
    systemScopeType,
    exposeTool,
    scopeToolType,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

/** Build rows for `scopeDocToPublic` from Areas collection snapshots. */
export function buildScopeTemplateAreaRowsFromFirestore(
  areaDocs: { id: string; data: () => DocumentData }[],
): ScopeTemplateAreaRow[] {
  const rows: ScopeTemplateAreaRow[] = areaDocs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      areaname: String(x.areaname ?? ""),
      sortOrder: numOrNull(x.sortOrder) ?? null,
      areaid: numOrNull(x.areaid) ?? null,
    };
  });
  return [...rows].sort((a, b) => {
    const ao = a.sortOrder;
    const bo = b.sortOrder;
    const aHas = typeof ao === "number" && Number.isFinite(ao);
    const bHas = typeof bo === "number" && Number.isFinite(bo);
    if (aHas && bHas && ao !== bo) return ao - bo;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.areaname.localeCompare(b.areaname, undefined, { sensitivity: "base" });
  });
}
