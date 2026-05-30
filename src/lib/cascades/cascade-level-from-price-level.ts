import type { PriceLevelPublic } from "@/types/price-level";

/** Cascade sheet `level` matches Price Levels display name / SKU elevate level. */
export function cascadeLevelFromPriceLevel(
  priceLevels: PriceLevelPublic[],
  priceLevelId: number | null | undefined,
  projectFinish?: string | null,
): string {
  if (priceLevelId != null) {
    const hit = priceLevels.find((p) => p.pricelevelid === priceLevelId);
    if (hit?.pricelevel?.trim()) return hit.pricelevel.trim();
  }
  return projectFinish?.trim() ?? "";
}

export function projectfinishForPriceLevelId(
  priceLevels: PriceLevelPublic[],
  priceLevelId: number | null,
): string {
  if (priceLevelId == null) return "";
  const hit = priceLevels.find((p) => p.pricelevelid === priceLevelId);
  return hit?.pricelevel?.trim() ?? "";
}
