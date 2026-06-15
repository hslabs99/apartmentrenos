import {
  INHERIT_M2_LM_RUNS_UOM,
  isQuoteObjectInheritM2Source,
  uomSupportsInheritM2,
} from "@/lib/inherit-m2-source";
import { collectScopeInstanceIds, matchesScopeInstance } from "@/lib/scope-instance";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import {
  SCOPE_METRIC_INHERIT_PREFIX,
  type InheritMeasureSource,
  type ProjectAreaScopeMetricValuePublic,
  type ScopeMetricPublic,
} from "@/types/scope-metric";
const DEFAULT_LM_RUNS_RUN_WIDTH = 3.2;

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function linearMetersFromAreaM2Client(areaM2: number, runWidth: number): number | null {
  if (!(areaM2 > 0) || !(runWidth > 0)) return null;
  const side = Math.sqrt(areaM2);
  const strips = Math.ceil(side / runWidth);
  const lm = strips * side;
  return Math.round(lm * 100) / 100;
}

/** Resolve checklist/pricing quantity from a scope metric value and object UOM. */
export function measureFromScopeMetricForQuoteObject(
  q: QuoteObjectPublic | undefined,
  metricid: string,
  scopeMetricValues: Map<string, number | null> | undefined,
  scopeMetrics: ScopeMetricPublic[],
): number | null {
  if (!q) return null;
  const metric = scopeMetrics.find((m) => m.metricid === metricid);
  if (!metric || !scopeMetricValues) return null;
  const raw = scopeMetricValues.get(metricid);
  if (raw == null) return null;
  if (!(raw > 0)) return raw === 0 ? 0 : null;
  const uom = String(q.uom ?? "").trim();
  const mu = metric.uom.trim();
  if (uom === "M2" && mu === "M2") return raw;
  if (uom === "Unit" && mu === "M2") return raw;
  if (uom === INHERIT_M2_LM_RUNS_UOM) {
    const rw = numOrNull(q.runWidth);
    const rollWidth = rw != null && rw > 0 ? rw : DEFAULT_LM_RUNS_RUN_WIDTH;
    if (mu === "M2") return linearMetersFromAreaM2Client(raw, rollWidth);
    if (mu === INHERIT_M2_LM_RUNS_UOM) return raw;
  }
  if (mu.toLowerCase() === uom.toLowerCase()) return raw;
  return null;
}

export function scopeMetricValuesMapFromList(
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

/** Metric values for one scope instance on a project area (checklist row). */
export function scopeMetricValuesMapForInstance(
  values: ProjectAreaScopeMetricValuePublic[] | undefined,
  scopeDocId: string,
  scopeInstanceId: string | null | undefined,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  const docId = scopeDocId.trim();
  if (!docId) return map;
  for (const v of values ?? []) {
    if (v.scopeDocId !== docId) continue;
    if (!matchesScopeInstance(v.scopeInstanceId, scopeInstanceId)) continue;
    const id = v.metricid.trim();
    if (!id) continue;
    map.set(id, v.value ?? null);
  }
  return map;
}

export {  MAX_SCOPE_METRICS,
  SCOPE_METRIC_INHERIT_PREFIX,
  SCOPE_METRIC_UOM_OPTIONS,
} from "@/types/scope-metric";
export type { InheritMeasureSource, ScopeMetricPublic } from "@/types/scope-metric";

export function encodeScopeMetricInherit(metricid: string): InheritMeasureSource {
  return `${SCOPE_METRIC_INHERIT_PREFIX}${metricid.trim()}`;
}

export function parseScopeMetricInheritId(source: string): string | null {
  const s = source.trim();
  if (!s.startsWith(SCOPE_METRIC_INHERIT_PREFIX)) return null;
  const id = s.slice(SCOPE_METRIC_INHERIT_PREFIX.length).trim();
  return id || null;
}

export function isScopeMetricInheritSource(source: string): boolean {
  return parseScopeMetricInheritId(source) != null;
}

export function isInheritMeasureSource(v: unknown): v is InheritMeasureSource {
  if (typeof v !== "string" || !v.trim()) return false;
  if (isQuoteObjectInheritM2Source(v)) return true;
  return parseScopeMetricInheritId(v) != null;
}

/** Normalize UOM for measure/metric compatibility checks. */
export function normalizeMeasureUom(uom: string): string {
  const u = uom.trim();
  if (!u) return "";
  const lower = u.toLowerCase();
  if (lower === "m2" || lower === "m²" || lower === "sqm" || lower === "sq m") return "M2";
  if (lower === "lm-runs" || lower === "lm runs") return INHERIT_M2_LM_RUNS_UOM;
  return u;
}

/** M2 metric can drive M2, LM-Runs, or Unit (area metric as line quantity). */
export function metricUomCompatibleWithObjectUom(metricUom: string, objectUom: string): boolean {
  const m = normalizeMeasureUom(metricUom);
  const o = normalizeMeasureUom(objectUom);
  if (!m || !o) return false;
  if (m === "M2") return o === "M2" || o === INHERIT_M2_LM_RUNS_UOM || o === "Unit";
  if (m === INHERIT_M2_LM_RUNS_UOM) return o === INHERIT_M2_LM_RUNS_UOM;
  return m.toLowerCase() === o.toLowerCase();
}

export function scopeMetricsForAnswer(
  scope: Pick<ScopePublic, "scopeMetrics"> | undefined,
  answerid: string,
): ScopeMetricPublic[] {
  if (!scope?.scopeMetrics?.length || !answerid.trim()) return [];
  const id = answerid.trim();
  return scope.scopeMetrics.filter((m) => m.answerids.includes(id));
}

export function scopeMetricById(
  scope: Pick<ScopePublic, "scopeMetrics"> | undefined,
  metricid: string,
): ScopeMetricPublic | undefined {
  const id = metricid.trim();
  if (!id) return undefined;
  return scope?.scopeMetrics?.find((m) => m.metricid === id);
}

export function inheritMeasureLabel(
  source: InheritMeasureSource,
  scope: Pick<ScopePublic, "scopeMetrics"> | undefined,
): string {
  const metricId = parseScopeMetricInheritId(source);
  if (metricId) {
    const m = scopeMetricById(scope, metricId);
    return m ? `Scope metric: ${m.label}` : "Scope metric";
  }
  return source;
}

export function inheritMeasureOptionsForObject(
  scope: Pick<ScopePublic, "scopeMetrics"> | undefined,
  objectUom: string,
  objectDefault: InheritMeasureSource,
  standardOptions: { value: InheritMeasureSource; label: string }[],
  opts?: { answerid?: string | null },
): { value: InheritMeasureSource; label: string }[] {
  const uom = normalizeMeasureUom(objectUom);
  const out = [...standardOptions];
  const answerid = opts?.answerid?.trim() ?? "";
  const metrics = (scope?.scopeMetrics ?? []).filter((m) => {
    if (!answerid) return true;
    return m.answerids.includes(answerid);
  });
  for (const m of metrics) {
    if (!metricUomCompatibleWithObjectUom(m.uom, uom)) continue;
    const value = encodeScopeMetricInherit(m.metricid);
    if (out.some((o) => o.value === value)) continue;
    out.push({
      value,
      label: `Scope metric: ${m.label}`,
    });
  }
  if (objectDefault !== "none" && !out.some((o) => o.value === objectDefault)) {
    out.push({
      value: objectDefault,
      label: inheritMeasureLabel(objectDefault, scope),
    });
  }
  return out;
}

export function scopeMetricValueLookup(
  values: ProjectAreaScopeMetricValuePublic[] | undefined,
  scopeDocId: string,
  scopeInstanceId: string | null | undefined,
  metricid: string,
): number | null | undefined {
  const docId = scopeDocId.trim();
  const mid = metricid.trim();
  if (!docId || !mid) return undefined;
  const hit = (values ?? []).find(
    (v) =>
      v.scopeDocId === docId &&
      matchesScopeInstance(v.scopeInstanceId, scopeInstanceId) &&
      v.metricid === mid,
  );
  return hit ? hit.value : undefined;
}

export function buildScopeMetricValueKey(
  scopeDocId: string,
  scopeInstanceId: string | null | undefined,
  metricid: string,
): string {
  const inst = scopeInstanceId?.trim() || "";
  return `${scopeDocId.trim()}\u0001${inst}\u0001${metricid.trim()}`;
}

/** One editable scope metric on a project area (all scope instances / answers in that area). */
export type ScopeMetricAreaEntry = {
  scopeDocId: string;
  scopeQuestion: string;
  scopeInstanceId: string | null | undefined;
  metric: ScopeMetricPublic;
};

/** Active scope metrics for workbench area header (one row may list several scopes). */
export function collectScopeMetricEntriesForProjectArea(
  pa: ProjectAreaPublic,
  areaScopes: ScopePublic[],
  rows: ProjectAreaObjectPublic[],
): ScopeMetricAreaEntry[] {
  const out: ScopeMetricAreaEntry[] = [];
  const seen = new Set<string>();
  for (const scope of areaScopes) {
    if (scope.kind === "header" || scope.kind === "footer") continue;
    const instanceIds = collectScopeInstanceIds(scope.id, pa.scopeAnswers, rows);
    for (const scopeInstanceId of instanceIds) {
      const saved = pa.scopeAnswers?.find(
        (e) =>
          e.scopeDocId === scope.id &&
          matchesScopeInstance(e.scopeInstanceId, scopeInstanceId),
      );
      let answerid = saved?.answerid?.trim() ?? "";
      if (!answerid) {
        const lineHit = rows.find(
          (r) =>
            r.linesource === "scope" &&
            r.scopeDocId === scope.id &&
            matchesScopeInstance(r.scopeInstanceId, scopeInstanceId) &&
            r.answerid?.trim(),
        );
        answerid = lineHit?.answerid?.trim() ?? "";
      }
      if (!answerid) continue;
      const metrics = scopeMetricsForAnswer(scope, answerid);
      for (const metric of metrics) {
        const key = buildScopeMetricValueKey(scope.id, scopeInstanceId, metric.metricid);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          scopeDocId: scope.id,
          scopeQuestion: scope.question,
          scopeInstanceId,
          metric,
        });
      }
    }
  }
  return out;
}
