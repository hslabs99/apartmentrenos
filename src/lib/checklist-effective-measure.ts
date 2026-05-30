import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";

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
