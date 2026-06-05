import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import { normalizeElevateLevel } from "@/lib/sku/normalize-sku-part";
import type { PriceLevelPublic } from "@/types/price-level";

/** Canonical cascade level name when `rawLevel` matches a cascade row (spacing/hyphen insensitive). */
export function resolveCascadeLevelName(rawLevel: string, cascades: CascadeRow[]): string {
  const raw = rawLevel.trim();
  if (!raw || cascades.length === 0) return raw;
  const rawNorm = normalizeElevateLevel(raw);
  for (const r of cascades) {
    const v = r.level.trim();
    if (v && normalizeElevateLevel(v) === rawNorm) return v;
  }
  return raw;
}

/** Price level id whose display name matches a cascade level (spacing/hyphen insensitive). */
export function priceLevelIdForCascadeLevel(
  priceLevels: PriceLevelPublic[],
  cascadeLevel: string,
  cascades: CascadeRow[],
): number | null {
  const level = resolveCascadeLevelName(cascadeLevel, cascades);
  const levelNorm = normalizeElevateLevel(level);
  for (const pl of priceLevels) {
    const name = pl.pricelevel?.trim();
    if (!name || pl.pricelevelid == null) continue;
    if (normalizeElevateLevel(name) === levelNorm) return pl.pricelevelid;
  }
  return null;
}

/** Cascade sheet `level` matches Price Levels display name / SKU elevate level. */
export function cascadeLevelFromPriceLevel(
  priceLevels: PriceLevelPublic[],
  priceLevelId: number | null | undefined,
  projectFinish?: string | null,
  cascades?: CascadeRow[],
): string {
  let raw = "";
  if (priceLevelId != null) {
    const hit = priceLevels.find((p) => p.pricelevelid === priceLevelId);
    if (hit?.pricelevel?.trim()) raw = hit.pricelevel.trim();
  }
  if (!raw) raw = projectFinish?.trim() ?? "";
  if (cascades?.length) return resolveCascadeLevelName(raw, cascades);
  return raw;
}

export function projectfinishForPriceLevelId(
  priceLevels: PriceLevelPublic[],
  priceLevelId: number | null,
  cascades?: CascadeRow[],
): string {
  if (priceLevelId == null) return "";
  const hit = priceLevels.find((p) => p.pricelevelid === priceLevelId);
  const raw = hit?.pricelevel?.trim() ?? "";
  if (cascades?.length) return resolveCascadeLevelName(raw, cascades);
  return raw;
}
