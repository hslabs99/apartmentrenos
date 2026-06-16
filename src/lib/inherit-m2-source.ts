import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaScopeMetricValuePublic } from "@/types/scope-metric";
import type { ScopeAnswerPublic, ScopePublic } from "@/types/scope";
import {
  isInheritMeasureSource,
  isScopeMetricInheritSource,
  parseScopeMetricInheritId,
} from "@/lib/scope-metrics";
import type { InheritMeasureSource } from "@/types/scope-metric";
import {
  QUOTE_OBJECT_INHERIT_M2_SOURCES,
  type QuoteObjectInheritM2Source,
  type QuoteObjectPublic,
} from "@/types/quote-object";

/** Matches Setup → Quote Objects / checklist carpet UOM. */
export const INHERIT_M2_LM_RUNS_UOM = "LM-Runs";

export function uomSupportsInheritM2(uom: string): boolean {
  const u = uom.trim().toLowerCase();
  if (u === "m2" || u === "m²" || u === "sqm" || u === "sq m") return true;
  return u === INHERIT_M2_LM_RUNS_UOM.toLowerCase() || u === "lm runs";
}

/** Unit lines can inherit apartment/area m² as quantity (e.g. paint packages priced per m²). */
export function uomSupportsInheritedAreaMeasure(uom: string): boolean {
  if (uomSupportsInheritM2(uom)) return true;
  return uom.trim().toLowerCase() === "unit";
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/** Resolve m² from apartment/area inherit source and project/area context. */
export function inheritedApartmentM2FromSource(
  src: QuoteObjectInheritM2Source,
  ctx: {
    areaM2?: number | null;
    apartmentTotalM2?: number | null;
    apartmentSoftM2?: number | null;
    apartmentHardM2?: number | null;
  },
): number | null {
  if (src === "none") return null;
  if (src === "area_m2") return numOrNull(ctx.areaM2);
  if (src === "apartment_total_m2") return numOrNull(ctx.apartmentTotalM2);
  if (src === "apartment_soft_m2") return numOrNull(ctx.apartmentSoftM2);
  if (src === "apartment_hard_m2") return numOrNull(ctx.apartmentHardM2);
  return null;
}

export function isQuoteObjectInheritM2Source(v: unknown): v is QuoteObjectInheritM2Source {
  return (
    typeof v === "string" &&
    (QUOTE_OBJECT_INHERIT_M2_SOURCES as readonly string[]).includes(v)
  );
}

/** Normalize quote object inherit source (incl. legacy `inheritAreaM2`). */
export function normalizeQuoteObjectInheritM2Source(
  quoteObject:
    | Pick<QuoteObjectPublic, "uom" | "inheritM2Source" | "inheritAreaM2">
    | undefined,
): QuoteObjectInheritM2Source {
  if (!quoteObject || !uomSupportsInheritM2(String(quoteObject.uom ?? ""))) return "none";
  const srcRaw = String(quoteObject.inheritM2Source ?? "").trim();
  if (isQuoteObjectInheritM2Source(srcRaw)) return srcRaw;
  return quoteObject.inheritAreaM2 === true ? "area_m2" : "none";
}

/**
 * Scope object-level inherit overrides quote object setup when explicitly stored on the answer.
 * Missing scope entry falls back to the quote object template.
 */
export function effectiveInheritMeasureSource(
  quoteObject:
    | Pick<QuoteObjectPublic, "uom" | "inheritM2Source" | "inheritAreaM2">
    | undefined,
  scopeOverride: InheritMeasureSource | undefined,
): InheritMeasureSource {
  if (scopeOverride !== undefined && isInheritMeasureSource(scopeOverride)) {
    return scopeOverride;
  }
  if (!quoteObject || !uomSupportsInheritM2(String(quoteObject.uom ?? ""))) return "none";
  return normalizeQuoteObjectInheritM2Source(quoteObject);
}

/** @deprecated Use {@link effectiveInheritMeasureSource}. */
export function effectiveInheritM2Source(
  quoteObject:
    | Pick<QuoteObjectPublic, "uom" | "inheritM2Source" | "inheritAreaM2">
    | undefined,
  scopeOverride: QuoteObjectInheritM2Source | undefined,
): QuoteObjectInheritM2Source {
  const src = effectiveInheritMeasureSource(quoteObject, scopeOverride);
  return isQuoteObjectInheritM2Source(src) ? src : "none";
}

export function quoteObjectUsesInheritedMeasureWithScope(
  quoteObject:
    | Pick<QuoteObjectPublic, "uom" | "inheritM2Source" | "inheritAreaM2">
    | undefined,
  scopeOverride?: InheritMeasureSource,
): boolean {
  return effectiveInheritMeasureSource(quoteObject, scopeOverride) !== "none";
}

/** @deprecated Use {@link quoteObjectUsesInheritedMeasureWithScope}. */
export function quoteObjectUsesInheritedM2WithScope(
  quoteObject:
    | Pick<QuoteObjectPublic, "uom" | "inheritM2Source" | "inheritAreaM2">
    | undefined,
  scopeOverride?: QuoteObjectInheritM2Source,
): boolean {
  return quoteObjectUsesInheritedMeasureWithScope(quoteObject, scopeOverride);
}

/**
 * Scope metric inherit is locked unless setup explicitly sets `locked` to false.
 * Non–scope-metric inherit sources are never locked by this rule.
 */
export function measureLockedByScopeMetricInherit(
  scopeOverride: InheritMeasureSource | undefined,
  locked?: boolean,
): boolean {
  if (scopeOverride == null || !isScopeMetricInheritSource(scopeOverride)) return false;
  return locked !== false;
}

/** Stored scope locked flag for a quote object doc id on an answer (undefined = default locked). */
export function scopeAnswerInheritMeasureLockedForQuoteObjectDocId(
  answer: Pick<ScopeAnswerPublic, "attachedObjectInheritMeasureLocked"> | undefined,
  quoteObjectDocId: string,
): boolean | undefined {
  const id = quoteObjectDocId.trim();
  if (!id || !answer?.attachedObjectInheritMeasureLocked) return undefined;
  const stored = answer.attachedObjectInheritMeasureLocked[id];
  return stored === false ? false : stored === true ? true : undefined;
}

export function resolveScopeLineInheritMeasureLocked(
  line: Pick<
    ProjectAreaObjectPublic,
    "linesource" | "scopeDocId" | "answerid" | "objectid"
  >,
  scope: ScopePublic | undefined,
  quoteObjects: QuoteObjectPublic[],
): boolean {
  if (line.linesource !== "scope" || !line.scopeDocId?.trim() || !line.answerid?.trim()) {
    return false;
  }
  const answer = scope?.answers.find((a) => a.answerid === line.answerid);
  if (!answer) return false;

  for (const docId of answer.attachedQuoteObjectIds ?? []) {
    const trimmed = docId.trim();
    if (!trimmed) continue;
    const q = quoteObjects.find((qo) => qo.id === trimmed);
    if (q?.objectid !== line.objectid) continue;
    const scopeOverride = scopeAnswerInheritMeasureSourceForQuoteObjectDocId(answer, trimmed);
    const inheritSource = effectiveInheritMeasureSource(q, scopeOverride);
    const locked = scopeAnswerInheritMeasureLockedForQuoteObjectDocId(answer, trimmed);
    return measureLockedByScopeMetricInherit(inheritSource, locked);
  }

  const qByObject = quoteObjects.find((qo) => qo.objectid === line.objectid);
  if (qByObject) {
    const scopeOverride = scopeAnswerInheritMeasureSourceForQuoteObjectDocId(answer, qByObject.id);
    if (scopeOverride !== undefined || answer.attachedQuoteObjectIds?.includes(qByObject.id)) {
      const inheritSource = effectiveInheritMeasureSource(qByObject, scopeOverride);
      const locked = scopeAnswerInheritMeasureLockedForQuoteObjectDocId(answer, qByObject.id);
      return measureLockedByScopeMetricInherit(inheritSource, locked);
    }
  }
  return false;
}

/** Stored scope override for a quote object doc id on an answer (undefined = inherit from object). */
export function scopeAnswerInheritMeasureSourceForQuoteObjectDocId(
  answer: Pick<ScopeAnswerPublic, "attachedObjectInheritM2Source"> | undefined,
  quoteObjectDocId: string,
): InheritMeasureSource | undefined {
  const id = quoteObjectDocId.trim();
  if (!id || !answer?.attachedObjectInheritM2Source) return undefined;
  const stored = answer.attachedObjectInheritM2Source[id];
  return isInheritMeasureSource(stored) ? stored : undefined;
}

/** @deprecated Use {@link scopeAnswerInheritMeasureSourceForQuoteObjectDocId}. */
export function scopeAnswerInheritM2SourceForQuoteObjectDocId(
  answer: Pick<ScopeAnswerPublic, "attachedObjectInheritM2Source"> | undefined,
  quoteObjectDocId: string,
): QuoteObjectInheritM2Source | undefined {
  const src = scopeAnswerInheritMeasureSourceForQuoteObjectDocId(answer, quoteObjectDocId);
  return src && isQuoteObjectInheritM2Source(src) ? src : undefined;
}

/** Resolve effective inherit measure for a scope checklist line (answer override + quote object default). */
export function resolveScopeLineInheritMeasureSource(
  line: Pick<
    ProjectAreaObjectPublic,
    "linesource" | "scopeDocId" | "answerid" | "objectid"
  >,
  scope: ScopePublic | undefined,
  quoteObjects: QuoteObjectPublic[],
): InheritMeasureSource | undefined {
  if (line.linesource !== "scope" || !line.scopeDocId?.trim() || !line.answerid?.trim()) {
    return undefined;
  }
  const answer = scope?.answers.find((a) => a.answerid === line.answerid);
  if (!answer) return undefined;

  for (const docId of answer.attachedQuoteObjectIds ?? []) {
    const trimmed = docId.trim();
    if (!trimmed) continue;
    const q = quoteObjects.find((qo) => qo.id === trimmed);
    if (q?.objectid !== line.objectid) continue;
    const scopeOverride = scopeAnswerInheritMeasureSourceForQuoteObjectDocId(answer, trimmed);
    return effectiveInheritMeasureSource(q, scopeOverride);
  }

  const qByObject = quoteObjects.find((qo) => qo.objectid === line.objectid);
  if (qByObject) {
    const scopeOverride = scopeAnswerInheritMeasureSourceForQuoteObjectDocId(answer, qByObject.id);
    if (scopeOverride !== undefined || answer.attachedQuoteObjectIds?.includes(qByObject.id)) {
      return effectiveInheritMeasureSource(qByObject, scopeOverride);
    }
  }
  return undefined;
}

/** @deprecated Use {@link resolveScopeLineInheritMeasureSource}. */
export function resolveScopeLineInheritM2Source(
  line: Pick<
    ProjectAreaObjectPublic,
    "linesource" | "scopeDocId" | "answerid" | "objectid"
  >,
  scope: ScopePublic | undefined,
  quoteObjects: QuoteObjectPublic[],
): QuoteObjectInheritM2Source | undefined {
  const src = resolveScopeLineInheritMeasureSource(line, scope, quoteObjects);
  return src && isQuoteObjectInheritM2Source(src) ? src : undefined;
}

export function scopeMetricValuesMap(
  values: ProjectAreaScopeMetricValuePublic[] | undefined,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const v of values ?? []) {
    const id = v.metricid.trim();
    if (!id) continue;
    map.set(id, v.value ?? null);
  }
  return map;
}

export function resolveScopeMetricIdFromInherit(
  inherit: InheritMeasureSource | undefined,
): string | null {
  if (!inherit || !isScopeMetricInheritSource(inherit)) return null;
  return parseScopeMetricInheritId(inherit);
}
