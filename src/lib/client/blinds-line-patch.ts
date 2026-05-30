import { BLINDS_DEFAULT_MEASURE } from "@/lib/blinds/blinds-defaults";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

export type BlindsLinePatch = {
  blindType?: string | null;
  blindDropMm?: number | null;
  blindWidthMm?: number | null;
  blindColour?: string | null;
  customumprice?: number | null;
  totalprice?: number | null;
  skuProduct?: string | null;
};

export function buildBlindsLinePatch(
  line: ProjectAreaObjectPublic,
  next: {
    blindDropMm?: number | null;
    blindWidthMm?: number | null;
    blindType?: string | null;
    blindColour?: string | null;
  },
  unitPrice: number | null,
): BlindsLinePatch {
  const blindDropMm = next.blindDropMm !== undefined ? next.blindDropMm : line.blindDropMm;
  const blindWidthMm = next.blindWidthMm !== undefined ? next.blindWidthMm : line.blindWidthMm;
  const blindType =
    next.blindType !== undefined
      ? next.blindType?.trim() || null
      : line.blindType?.trim() || null;
  const blindColour =
    next.blindColour !== undefined
      ? next.blindColour?.trim() || null
      : line.blindColour?.trim() || null;

  const patch: BlindsLinePatch = {
    blindDropMm,
    blindWidthMm,
    blindType,
    blindColour,
  };

  const measure = line.custommeasure ?? BLINDS_DEFAULT_MEASURE;
  if (blindType && blindDropMm != null && blindWidthMm != null && unitPrice != null) {
    patch.customumprice = unitPrice;
    patch.totalprice = measure * unitPrice;
    patch.skuProduct = blindColour
      ? `${blindType} · ${blindDropMm} · ${blindWidthMm} · ${blindColour}`
      : `${blindType} · ${blindDropMm} · ${blindWidthMm}`;
  } else {
    patch.customumprice = null;
    patch.totalprice = null;
    patch.skuProduct = null;
  }

  return patch;
}
