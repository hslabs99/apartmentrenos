import {
  effectiveInheritMeasureSource,
  inheritedApartmentM2FromSource,
  INHERIT_M2_LM_RUNS_UOM,
  isQuoteObjectInheritM2Source,
  measureLockedByScopeMetricInherit,
  quoteObjectUsesInheritedMeasureWithScope,
  resolveScopeMetricIdFromInherit,
  uomSupportsInheritedAreaMeasure,
} from "@/lib/inherit-m2-source";
import { measureFromScopeMetricForQuoteObject } from "@/lib/scope-metrics";
import {
  measureFromScopeMetricWithSkuCalcM2,
  type SkuCalcM2Fields,
} from "@/lib/sku/sku-calc-m2-measure";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { InheritMeasureSource, ScopeMetricPublic } from "@/types/scope-metric";
import {
  QUOTE_OBJECT_INHERIT_M2_LABELS,
  type QuoteObjectPublic,
} from "@/types/quote-object";

export type ChecklistScopeMeasureExtras = {
  scopeMetrics?: ScopeMetricPublic[];
  scopeMetricValues?: Map<string, number | null>;
  /** Line SKU lookup for calcM2 division (client catalog). */
  catalogSkus?: { skuId: string; uom: string; calcM2: boolean; calculatedM2: number | null }[];
  /** When picking a new SKU, use this instead of the line's current `skuId`. */
  skuCalcM2Override?: SkuCalcM2Fields | null;
  /** Scope setup: when true, checklist measure is locked to the inherited scope metric. */
  inheritMeasureLocked?: boolean;
};

function resolveSkuCalcM2Fields(
  row: Pick<ProjectAreaObjectPublic, "skuId"> | undefined,
  extras?: ChecklistScopeMeasureExtras,
): SkuCalcM2Fields | null {
  if (extras?.skuCalcM2Override) return extras.skuCalcM2Override;
  const skuId = String(row?.skuId ?? "").trim();
  if (!skuId || !extras?.catalogSkus?.length) return null;
  const sku = extras.catalogSkus.find((s) => s.skuId === skuId);
  return sku ? { calcM2: sku.calcM2, calculatedM2: sku.calculatedM2 } : null;
}

function mergeScopeMeasureExtras(
  scopeInheritMeasureSource?: InheritMeasureSource,
  extras?: ChecklistScopeMeasureExtras,
): {
  scopeInheritMeasureSource?: InheritMeasureSource;
  scopeMetrics?: ScopeMetricPublic[];
  scopeMetricValues?: Map<string, number | null>;
} {
  return {
    scopeInheritMeasureSource,
    scopeMetrics: extras?.scopeMetrics,
    scopeMetricValues: extras?.scopeMetricValues,
  };
}

function measureFromScopeMetricIfApplicable(
  q: QuoteObjectPublic | undefined,
  scopeInheritMeasureSource?: InheritMeasureSource,
  scopeMetrics?: ScopeMetricPublic[],
  scopeMetricValues?: Map<string, number | null>,
  skuCalcM2?: SkuCalcM2Fields | null,
): number | null {
  const metricId = resolveScopeMetricIdFromInherit(scopeInheritMeasureSource);
  if (!metricId || !scopeMetrics?.length || !scopeMetricValues) return null;
  const fromMetric = measureFromScopeMetricForQuoteObject(
    q,
    metricId,
    scopeMetricValues,
    scopeMetrics,
  );
  return measureFromScopeMetricWithSkuCalcM2(fromMetric, skuCalcM2);
}
/** Matches server `LM_RUNS_UOM` / checklist carpet lineal-metre logic. */
export const CHECKLIST_LM_RUNS_UOM = INHERIT_M2_LM_RUNS_UOM;

const DEFAULT_LM_RUNS_RUN_WIDTH = 3.2;

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

/**
 * Rough LM for carpet: assume square room side = √areaM², strips across width =
 * ceil(side / runWidth), LM = strips × side. Matches server helper.
 */
export function linearMetersFromAreaM2ForLmRunsClient(
  areaM2: number,
  runWidth: number,
): number | null {
  if (!(areaM2 > 0) || !(runWidth > 0)) return null;
  const side = Math.sqrt(areaM2);
  const strips = Math.ceil(side / runWidth);
  const lm = strips * side;
  return Math.round(lm * 100) / 100;
}

function effectiveLmRunsRollWidth(q: QuoteObjectPublic): number {
  const rw = numOrNull(q.runWidth);
  if (rw != null && rw > 0) return rw;
  return DEFAULT_LM_RUNS_RUN_WIDTH;
}

function normalizedInheritSource(
  q: QuoteObjectPublic | undefined,
  scopeInheritMeasureSource?: InheritMeasureSource,
): InheritMeasureSource {
  return effectiveInheritMeasureSource(q, scopeInheritMeasureSource);
}

export function quoteObjectUsesInheritedM2(
  q: QuoteObjectPublic | undefined,
  scopeInheritMeasureSource?: InheritMeasureSource,
): boolean {
  if (!q) return false;
  if (!uomSupportsInheritedAreaMeasure(String(q.uom ?? ""))) return false;
  return quoteObjectUsesInheritedMeasureWithScope(q, scopeInheritMeasureSource);
}

export function checklistMeasureLockedByScopeMetric(
  scopeInheritMeasureSource?: InheritMeasureSource,
  inheritMeasureLocked?: boolean,
): boolean {
  return measureLockedByScopeMetricInherit(scopeInheritMeasureSource, inheritMeasureLocked);
}

export function checklistDefaultMeasureForRow(
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
  extras?: ChecklistScopeMeasureExtras,
  row?: Pick<ProjectAreaObjectPublic, "skuId">,
): number | null {
  const ctx = mergeScopeMeasureExtras(scopeInheritMeasureSource, extras);
  const skuCalcM2 = resolveSkuCalcM2Fields(row, extras);
  return checklistTemplateMeasurementFromQuote(
    q,
    q?.measurement ?? null,
    {
      areaM2: pa.aream2 ?? null,
      apartmentTotalM2: project?.projectm2 ?? null,
      apartmentSoftM2: project?.projectm2soft ?? null,
      apartmentHardM2: project?.projectm2hard ?? null,
    },
    ctx.scopeInheritMeasureSource,
    ctx.scopeMetrics,
    ctx.scopeMetricValues,
    skuCalcM2,
  );
}

export function isChecklistAutoPopulateMeasureApplicable(
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
  extras?: ChecklistScopeMeasureExtras,
  row?: Pick<ProjectAreaObjectPublic, "skuId">,
): boolean {
  if (
    checklistMeasureLockedByScopeMetric(
      scopeInheritMeasureSource,
      extras?.inheritMeasureLocked,
    )
  ) {
    return false;
  }
  if (!q) return false;
  if (quoteObjectUsesInheritedM2(q, scopeInheritMeasureSource)) return true;
  return (
    checklistDefaultMeasureForRow(q, pa, project, scopeInheritMeasureSource, extras, row) != null
  );
}

/** PATCH body to reset measure to template / inherited default. */
export function checklistAutoPopulateMeasurePatch(
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
  extras?: ChecklistScopeMeasureExtras,
  row?: Pick<ProjectAreaObjectPublic, "skuId">,
): { custommeasure: number | null } | null {
  if (
    !isChecklistAutoPopulateMeasureApplicable(q, pa, project, scopeInheritMeasureSource, extras, row)
  ) {
    return null;
  }
  if (quoteObjectUsesInheritedM2(q, scopeInheritMeasureSource)) return { custommeasure: null };
  const defaultMeasure = checklistDefaultMeasureForRow(
    q,
    pa,
    project,
    scopeInheritMeasureSource,
    extras,
    row,
  );
  if (defaultMeasure == null) return null;
  return { custommeasure: defaultMeasure };
}
/**
 * Client-safe copy of `effectiveMeasurementForQuoteLine` (see `quote-object-doc.ts`)
 * for showing inherited checklist quantities when `custommeasure` is null.
 */
export function checklistTemplateMeasurementFromQuote(
  q: QuoteObjectPublic | undefined,
  templateMeasurement: number | null,
  ctx: {
    areaM2?: number | null;
    apartmentTotalM2?: number | null;
    apartmentSoftM2?: number | null;
    apartmentHardM2?: number | null;
  },
  scopeInheritMeasureSource?: InheritMeasureSource,
  scopeMetrics?: ScopeMetricPublic[],
  scopeMetricValues?: Map<string, number | null>,
  skuCalcM2?: SkuCalcM2Fields | null,
): number | null {
  if (!q) return templateMeasurement;
  const fromMetric = measureFromScopeMetricIfApplicable(
    q,
    scopeInheritMeasureSource,
    scopeMetrics,
    scopeMetricValues,
    skuCalcM2,
  );
  if (fromMetric != null) return fromMetric;

  const uom = String(q.uom ?? "").trim();
  const src = normalizedInheritSource(q, scopeInheritMeasureSource);
  if (isQuoteObjectInheritM2Source(src) && src !== "none") {
    const baseM2 = inheritedApartmentM2FromSource(src, ctx);
    if (uom === "M2") return baseM2 ?? templateMeasurement;
    if (uom === CHECKLIST_LM_RUNS_UOM) {
      const rw = effectiveLmRunsRollWidth(q);
      if (baseM2 != null && baseM2 > 0) {
        return linearMetersFromAreaM2ForLmRunsClient(baseM2, rw);
      }
      return templateMeasurement;
    }
    if (uom === "Unit" && baseM2 != null) {
      return measureFromScopeMetricWithSkuCalcM2(baseM2, skuCalcM2);
    }
  }

  return templateMeasurement;
}

export function checklistInheritedMeasureForRow(
  row: ProjectAreaObjectPublic,
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
  extras?: ChecklistScopeMeasureExtras,
): number | null {
  const ctx = mergeScopeMeasureExtras(scopeInheritMeasureSource, extras);
  const skuCalcM2 = resolveSkuCalcM2Fields(row, extras);
  const templateMeasurement = q?.measurement ?? null;
  return checklistTemplateMeasurementFromQuote(
    q,
    templateMeasurement,
    {
      areaM2: pa.aream2 ?? null,
      apartmentTotalM2: project?.projectm2 ?? null,
      apartmentSoftM2: project?.projectm2soft ?? null,
      apartmentHardM2: project?.projectm2hard ?? null,
    },
    ctx.scopeInheritMeasureSource,
    ctx.scopeMetrics,
    ctx.scopeMetricValues,
    skuCalcM2,
  );
}

/**
 * String to show in measure inputs: explicit line override, else inherited effective measure, else empty.
 */
export function checklistMeasureFieldDisplayString(
  row: ProjectAreaObjectPublic,
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
  extras?: ChecklistScopeMeasureExtras,
): string {
  if (
    checklistMeasureLockedByScopeMetric(
      scopeInheritMeasureSource,
      extras?.inheritMeasureLocked,
    )
  ) {
    const inherited = checklistInheritedMeasureForRow(
      row,
      q,
      pa,
      project,
      scopeInheritMeasureSource,
      extras,
    );
    return inherited != null ? String(inherited) : "";
  }
  if (row.custommeasure != null) return String(row.custommeasure);
  const inherited = checklistInheritedMeasureForRow(
    row,
    q,
    pa,
    project,
    scopeInheritMeasureSource,
    extras,
  );
  return inherited != null ? String(inherited) : "";
}
export function measuresClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

function fmtMeasureNum(n: number, decimals = 2): string {
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return Number.isInteger(r) ? String(r) : r.toFixed(decimals).replace(/\.?0+$/, "");
}

export type LmRunsMeasureBreakdown = {
  baseM2: number;
  baseM2Label: string;
  runWidth: number;
  side: number;
  strips: number;
  lm: number;
};

function lmRunsBaseM2AndLabel(
  q: QuoteObjectPublic,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
): { baseM2: number; baseM2Label: string } | null {
  const src = normalizedInheritSource(q, scopeInheritMeasureSource);
  if (!isQuoteObjectInheritM2Source(src)) return null;  const pick = (m2: number | null | undefined, label: string) =>
    m2 != null && m2 > 0 ? { baseM2: m2, baseM2Label: label } : null;

  if (src === "area_m2") return pick(pa.aream2, QUOTE_OBJECT_INHERIT_M2_LABELS.area_m2);
  if (src === "apartment_total_m2") {
    return pick(project?.projectm2, QUOTE_OBJECT_INHERIT_M2_LABELS.apartment_total_m2);
  }
  if (src === "apartment_soft_m2") {
    return pick(project?.projectm2soft, QUOTE_OBJECT_INHERIT_M2_LABELS.apartment_soft_m2);
  }
  if (src === "apartment_hard_m2") {
    return pick(project?.projectm2hard, QUOTE_OBJECT_INHERIT_M2_LABELS.apartment_hard_m2);
  }
  const fromArea = pick(pa.aream2, "Area m² (checklist room)");
  if (fromArea) return fromArea;
  const fromTemplate = pick(q.defaultAreaM2, "Template default area m² (Setup)");
  if (fromTemplate) return fromTemplate;
  return null;
}

/** Step-by-step LM-Runs carpet quantity from area m² and roll width (matches server formula). */
export function checklistLmRunsMeasureBreakdown(
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
): LmRunsMeasureBreakdown | null {
  if (!q || String(q.uom ?? "").trim() !== CHECKLIST_LM_RUNS_UOM) return null;
  const base = lmRunsBaseM2AndLabel(q, pa, project, scopeInheritMeasureSource);  if (!base) return null;
  const runWidth = effectiveLmRunsRollWidth(q);
  const side = Math.sqrt(base.baseM2);
  const strips = Math.ceil(side / runWidth);
  const lm = linearMetersFromAreaM2ForLmRunsClient(base.baseM2, runWidth);
  if (lm == null) return null;
  return {
    baseM2: base.baseM2,
    baseM2Label: base.baseM2Label,
    runWidth,
    side,
    strips,
    lm,
  };
}

function formatLmRunsBreakdownTooltip(bd: LmRunsMeasureBreakdown): string {
  return (
    `LM-Runs: ${fmtMeasureNum(bd.lm)} LM from ${bd.baseM2Label} (${fmtMeasureNum(bd.baseM2)} m²), ` +
    `roll width ${fmtMeasureNum(bd.runWidth)} m. ` +
    `Assume square room: side = √${fmtMeasureNum(bd.baseM2)} = ${fmtMeasureNum(bd.side)} m; ` +
    `strips = ceil(${fmtMeasureNum(bd.side)} ÷ ${fmtMeasureNum(bd.runWidth)}) = ${bd.strips}; ` +
    `LM = ${bd.strips} × ${fmtMeasureNum(bd.side)} = ${fmtMeasureNum(bd.lm)} LM.`
  );
}

function lmRunsMissingSourceHint(
  q: QuoteObjectPublic,
  pa: ProjectAreaPublic,
  scopeInheritMeasureSource?: InheritMeasureSource,
): string {
  const src = normalizedInheritSource(q, scopeInheritMeasureSource);
  const rw = effectiveLmRunsRollWidth(q);
  if (isQuoteObjectInheritM2Source(src) && src !== "none") {
    return `LM-Runs: set ${QUOTE_OBJECT_INHERIT_M2_LABELS[src]} on the project or area header to calculate LM (roll width ${fmtMeasureNum(rw)} m).`;
  }  if (pa.aream2 == null) {
    return `LM-Runs: set area m² on this room, or template default area m² in Setup, to calculate LM (roll width ${fmtMeasureNum(rw)} m).`;
  }
  if (q.measurement != null) {
    return `LM-Runs: using template default ${fmtMeasureNum(q.measurement)} LM from Setup (roll width ${fmtMeasureNum(rw)} m).`;
  }
  return `LM-Runs: enter area or project m², or a template default in Setup (roll width ${fmtMeasureNum(rw)} m).`;
}

export function checklistMeasureFieldTooltip(
  row: ProjectAreaObjectPublic,
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  scopeInheritMeasureSource?: InheritMeasureSource,
  extras?: ChecklistScopeMeasureExtras,
): string {
  const ctx = mergeScopeMeasureExtras(scopeInheritMeasureSource, extras);
  const autoHint = isChecklistAutoPopulateMeasureApplicable(
    q,
    pa,
    project,
    ctx.scopeInheritMeasureSource,
    ctx,
  )
    ? " Right-click to auto populate default measure."
    : "";

  const metricId = resolveScopeMetricIdFromInherit(ctx.scopeInheritMeasureSource);
  if (metricId && ctx.scopeMetrics?.length && ctx.scopeMetricValues) {
    const metric = ctx.scopeMetrics.find((m) => m.metricid === metricId);
    const inherited = checklistInheritedMeasureForRow(
      row,
      q,
      pa,
      project,
      ctx.scopeInheritMeasureSource,
      ctx,
    );
    if (metric && inherited != null) {
      return `From scope metric “${metric.label}”: ${fmtMeasureNum(inherited)}.${autoHint}`;
    }
    if (metric) {
      return `Inherits scope metric “${metric.label}” — enter the metric value on the scope row.${autoHint}`;
    }
  }

  if (q && String(q.uom ?? "").trim() === CHECKLIST_LM_RUNS_UOM) {
    const bd = checklistLmRunsMeasureBreakdown(q, pa, project, ctx.scopeInheritMeasureSource);
    if (row.custommeasure != null) {
      if (bd) {
        return `Manual measure (${fmtMeasureNum(row.custommeasure)} LM). Calculated: ${formatLmRunsBreakdownTooltip(bd)}${autoHint}`;
      }
      return `Manual measure (${fmtMeasureNum(row.custommeasure)} LM).${autoHint}`;
    }
    if (bd) return `${formatLmRunsBreakdownTooltip(bd)}${autoHint}`;
    return `${lmRunsMissingSourceHint(q, pa, ctx.scopeInheritMeasureSource)}${autoHint}`;
  }

  if (row.custommeasure != null) {
    return `Manual measure override.${autoHint}`;
  }

  if (quoteObjectUsesInheritedM2(q, ctx.scopeInheritMeasureSource)) {
    const src = normalizedInheritSource(q, ctx.scopeInheritMeasureSource);
    if (isQuoteObjectInheritM2Source(src)) {
      const inherited = checklistInheritedMeasureForRow(
        row,
        q,
        pa,
        project,
        ctx.scopeInheritMeasureSource,
        ctx,
      );
      if (inherited != null) {
        return `Inherited ${QUOTE_OBJECT_INHERIT_M2_LABELS[src]}: ${fmtMeasureNum(inherited)} m².${autoHint}`;
      }
      return `Inherits ${QUOTE_OBJECT_INHERIT_M2_LABELS[src]} — set the value on the project or area header.${autoHint}`;
    }
  }

  if (q?.measurement != null) {
    return `Template default measure from Setup: ${fmtMeasureNum(q.measurement)}.${autoHint}`;
  }

  return `Matches grid measure; shows inherited m²/LM when template uses project or area quantities.${autoHint}`;
}