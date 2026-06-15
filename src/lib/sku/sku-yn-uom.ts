import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

/** SKU / line UOM for yes-no consumption (stored exactly as `Y/N`). */
export const SKU_YN_UOM = "Y/N";

export function isSkuYnUom(uom: string | null | undefined): boolean {
  return String(uom ?? "").trim() === SKU_YN_UOM;
}

/** Selected catalog SKU UOM when set; otherwise line `customuom`. */
export function effectiveSkuUomForLine(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "customuom">,
  catalogSkus?: { skuId: string; uom: string }[],
): string {
  const skuId = line.skuId?.trim();
  if (skuId && catalogSkus?.length) {
    const sku = catalogSkus.find((s) => s.skuId === skuId);
    const fromSku = sku?.uom?.trim();
    if (fromSku) return fromSku;
  }
  return line.customuom?.trim() ?? "";
}

export function lineUsesYnSkuUom(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "customuom">,
  catalogSkus?: { skuId: string; uom: string }[],
): boolean {
  return isSkuYnUom(effectiveSkuUomForLine(line, catalogSkus));
}

/** CL Yes/No dropdown value: Yes → 1, No → 0. */
export function ynMeasureSelectValue(measure: number | null | undefined): "" | "1" | "0" {
  if (measure === 1) return "1";
  if (measure === 0) return "0";
  return "";
}

export function ynMeasureFromSelectValue(raw: string): number | null {
  const t = raw.trim();
  if (t === "1") return 1;
  if (t === "0") return 0;
  return null;
}
