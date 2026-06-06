import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

/** Client-facing line total (workbench line total × project margin %). */
export function lineFinalPrice(
  row: ProjectAreaObjectPublic,
  marginPct: number,
): number | null {
  if (row.included === false) return null;
  const t = row.totalprice;
  if (t == null || !Number.isFinite(t)) return null;
  return t * (1 + marginPct / 100);
}
