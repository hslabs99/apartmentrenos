import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import {
  QUOTE_OBJECT_INHERIT_M2_LABELS,
  type QuoteObjectInheritM2Source,
  type QuoteObjectPublic,
} from "@/types/quote-object";

/** Matches server `LM_RUNS_UOM` / checklist carpet lineal-metre logic. */
export const CHECKLIST_LM_RUNS_UOM = "LM-Runs";

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

function normalizedInheritSource(q: QuoteObjectPublic): string {
  const srcRaw = String(q.inheritM2Source ?? "").trim();
  if (
    srcRaw === "apartment_total_m2" ||
    srcRaw === "apartment_soft_m2" ||
    srcRaw === "apartment_hard_m2" ||
    srcRaw === "area_m2" ||
    srcRaw === "none"
  ) {
    return srcRaw;
  }
  return q.inheritAreaM2 === true ? "area_m2" : "none";
}

export function quoteObjectUsesInheritedM2(q: QuoteObjectPublic | undefined): boolean {
  if (!q) return false;
  const uom = String(q.uom ?? "").trim();
  if (uom !== "M2" && uom !== CHECKLIST_LM_RUNS_UOM) return false;
  return normalizedInheritSource(q) !== "none";
}

/** Template default measure (fixed or from project / area m² when configured). */
export function checklistDefaultMeasureForRow(
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): number | null {
  return checklistTemplateMeasurementFromQuote(q, q?.measurement ?? null, {
    areaM2: pa.aream2 ?? null,
    apartmentTotalM2: project?.projectm2 ?? null,
    apartmentSoftM2: project?.projectm2soft ?? null,
    apartmentHardM2: project?.projectm2hard ?? null,
  });
}

export function isChecklistAutoPopulateMeasureApplicable(
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): boolean {
  if (!q) return false;
  if (quoteObjectUsesInheritedM2(q)) return true;
  return checklistDefaultMeasureForRow(q, pa, project) != null;
}

/** PATCH body to reset measure to template / inherited default. */
export function checklistAutoPopulateMeasurePatch(
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): { custommeasure: number | null } | null {
  if (!isChecklistAutoPopulateMeasureApplicable(q, pa, project)) return null;
  if (quoteObjectUsesInheritedM2(q)) return { custommeasure: null };
  const defaultMeasure = checklistDefaultMeasureForRow(q, pa, project);
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
): number | null {
  if (!q) return templateMeasurement;
  const uom = String(q.uom ?? "").trim();
  if (uom === "M2") {
    const src = normalizedInheritSource(q);
    if (src === "area_m2") return numOrNull(ctx.areaM2) ?? null;
    if (src === "apartment_total_m2") return numOrNull(ctx.apartmentTotalM2) ?? null;
    if (src === "apartment_soft_m2") return numOrNull(ctx.apartmentSoftM2) ?? null;
    if (src === "apartment_hard_m2") return numOrNull(ctx.apartmentHardM2) ?? null;
    return templateMeasurement;
  }
  if (uom === CHECKLIST_LM_RUNS_UOM) {
    const rw = effectiveLmRunsRollWidth(q);
    const src = normalizedInheritSource(q);
    const baseM2 =
      src === "area_m2"
        ? numOrNull(ctx.areaM2)
        : src === "apartment_total_m2"
          ? numOrNull(ctx.apartmentTotalM2)
          : src === "apartment_soft_m2"
            ? numOrNull(ctx.apartmentSoftM2)
            : src === "apartment_hard_m2"
              ? numOrNull(ctx.apartmentHardM2)
              : numOrNull(ctx.areaM2);
    if (baseM2 != null && baseM2 > 0) {
      return linearMetersFromAreaM2ForLmRunsClient(baseM2, rw);
    }
    return templateMeasurement;
  }
  return templateMeasurement;
}

/** Quantity implied by template + inheritance when the line has no `custommeasure`. */
export function checklistInheritedMeasureForRow(
  row: ProjectAreaObjectPublic,
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): number | null {
  const templateMeasurement = q?.measurement ?? null;
  return checklistTemplateMeasurementFromQuote(q, templateMeasurement, {
    areaM2: pa.aream2 ?? null,
    apartmentTotalM2: project?.projectm2 ?? null,
    apartmentSoftM2: project?.projectm2soft ?? null,
    apartmentHardM2: project?.projectm2hard ?? null,
  });
}

/**
 * String to show in measure inputs: explicit line override, else inherited effective measure, else empty.
 */
export function checklistMeasureFieldDisplayString(
  row: ProjectAreaObjectPublic,
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string {
  if (row.custommeasure != null) return String(row.custommeasure);
  const inherited = checklistInheritedMeasureForRow(row, q, pa, project);
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
): { baseM2: number; baseM2Label: string } | null {
  const src = normalizedInheritSource(q) as QuoteObjectInheritM2Source;
  const pick = (m2: number | null | undefined, label: string) =>
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
): LmRunsMeasureBreakdown | null {
  if (!q || String(q.uom ?? "").trim() !== CHECKLIST_LM_RUNS_UOM) return null;
  const base = lmRunsBaseM2AndLabel(q, pa, project);
  if (!base) return null;
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

function lmRunsMissingSourceHint(q: QuoteObjectPublic, pa: ProjectAreaPublic): string {
  const src = normalizedInheritSource(q) as QuoteObjectInheritM2Source;
  const rw = effectiveLmRunsRollWidth(q);
  if (src !== "none") {
    return `LM-Runs: set ${QUOTE_OBJECT_INHERIT_M2_LABELS[src]} on the project or area header to calculate LM (roll width ${fmtMeasureNum(rw)} m).`;
  }
  if (pa.aream2 == null) {
    return `LM-Runs: set area m² on this room, or template default area m² in Setup, to calculate LM (roll width ${fmtMeasureNum(rw)} m).`;
  }
  if (q.measurement != null) {
    return `LM-Runs: using template default ${fmtMeasureNum(q.measurement)} LM from Setup (roll width ${fmtMeasureNum(rw)} m).`;
  }
  return `LM-Runs: enter area or project m², or a template default in Setup (roll width ${fmtMeasureNum(rw)} m).`;
}

/** Native tooltip for checklist measure inputs (inherit breakdown, LM-Runs steps, manual override). */
export function checklistMeasureFieldTooltip(
  row: ProjectAreaObjectPublic,
  q: QuoteObjectPublic | undefined,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string {
  const autoHint = isChecklistAutoPopulateMeasureApplicable(q, pa, project)
    ? " Right-click to auto populate default measure."
    : "";

  if (q && String(q.uom ?? "").trim() === CHECKLIST_LM_RUNS_UOM) {
    const bd = checklistLmRunsMeasureBreakdown(q, pa, project);
    if (row.custommeasure != null) {
      if (bd) {
        return `Manual measure (${fmtMeasureNum(row.custommeasure)} LM). Calculated: ${formatLmRunsBreakdownTooltip(bd)}${autoHint}`;
      }
      return `Manual measure (${fmtMeasureNum(row.custommeasure)} LM).${autoHint}`;
    }
    if (bd) return `${formatLmRunsBreakdownTooltip(bd)}${autoHint}`;
    return `${lmRunsMissingSourceHint(q, pa)}${autoHint}`;
  }

  if (row.custommeasure != null) {
    return `Manual measure override.${autoHint}`;
  }

  if (quoteObjectUsesInheritedM2(q)) {
    const src = normalizedInheritSource(q!) as QuoteObjectInheritM2Source;
    const inherited = checklistInheritedMeasureForRow(row, q, pa, project);
    if (inherited != null) {
      return `Inherited ${QUOTE_OBJECT_INHERIT_M2_LABELS[src]}: ${fmtMeasureNum(inherited)} m².${autoHint}`;
    }
    return `Inherits ${QUOTE_OBJECT_INHERIT_M2_LABELS[src]} — set the value on the project or area header.${autoHint}`;
  }

  if (q?.measurement != null) {
    return `Template default measure from Setup: ${fmtMeasureNum(q.measurement)}.${autoHint}`;
  }

  return `Matches grid measure; shows inherited m²/LM when template uses project or area quantities.${autoHint}`;
}
