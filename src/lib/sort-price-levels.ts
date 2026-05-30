import type { PriceLevelPublic } from "@/types/price-level";

/** Display order: explicit `sortOrder` when set; otherwise legacy fallback to `pricelevelid`. */
export function effectivePriceLevelOrder(pl: Pick<PriceLevelPublic, "sortOrder" | "pricelevelid">): number {
  if (typeof pl.sortOrder === "number" && Number.isFinite(pl.sortOrder)) return pl.sortOrder;
  return pl.pricelevelid ?? 0;
}

export function comparePriceLevelsPublic(a: PriceLevelPublic, b: PriceLevelPublic): number {
  const d = effectivePriceLevelOrder(a) - effectivePriceLevelOrder(b);
  if (d !== 0) return d;
  return (a.pricelevelid ?? 0) - (b.pricelevelid ?? 0);
}

export function sortPriceLevelsPublic(list: PriceLevelPublic[]): PriceLevelPublic[] {
  return [...list].sort(comparePriceLevelsPublic);
}
