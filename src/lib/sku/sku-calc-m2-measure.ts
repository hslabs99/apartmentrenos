/** SKU fields used to convert inherited scope metric m² into unit quantity. */
export type SkuCalcM2Fields = {
  calcM2: boolean;
  calculatedM2: number | null;
};

/**
 * When a SKU is flagged `calcM2`, divide inherited scope metric area by `calculatedM2`
 * to get the number of units (e.g. sheets) required to cover the area.
 */
export function measureFromScopeMetricWithSkuCalcM2(
  metricMeasure: number | null,
  sku: SkuCalcM2Fields | null | undefined,
): number | null {
  if (metricMeasure == null) return null;
  if (!sku?.calcM2) return metricMeasure;
  const sheetM2 = sku.calculatedM2;
  if (sheetM2 == null || !(sheetM2 > 0)) return metricMeasure;
  const units = metricMeasure / sheetM2;
  return Math.ceil(units - 1e-9);
}
