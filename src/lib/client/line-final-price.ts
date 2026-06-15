import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

/** Client-facing line total (workbench line total × project margin %). */
export function lineFinalPrice(
  row: ProjectAreaObjectPublic,
  marginPct: number,
  effectiveMeasure?: number | null,
  unitPriceFallback?: number | null,
  /** When true (scope metric inherit), ignore stored custommeasure. */
  preferEffectiveMeasure?: boolean,
): number | null {
  if (row.included === false) return null;
  const t = row.totalprice;
  if (t != null && Number.isFinite(t) && !preferEffectiveMeasure) {
    return t * (1 + marginPct / 100);
  }
  const price = row.customumprice ?? unitPriceFallback ?? null;
  const measure = preferEffectiveMeasure
    ? (effectiveMeasure ?? row.custommeasure ?? null)
    : (row.custommeasure ?? effectiveMeasure ?? null);
  if (price == null || measure == null || !Number.isFinite(price) || !Number.isFinite(measure)) {
    if (t != null && Number.isFinite(t)) {
      return t * (1 + marginPct / 100);
    }
    return null;
  }
  return measure * price * (1 + marginPct / 100);
}
