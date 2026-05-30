/** Map master-sheet / SKU UOM strings to Setup → Quote Objects UOM values. */
const UOM_ALIASES: Record<string, string> = {
  ea: "Unit",
  each: "Unit",
  unit: "Unit",
  units: "Unit",
};

const QUOTE_UOM_CANONICAL = new Set([
  "Unit",
  "M2",
  "M3",
  "LM",
  "LM-Runs",
  "Kg",
  "Ltr",
]);

/**
 * Trim sheet UOM, apply aliases (e.g. ea → Unit), preserve known canonical values,
 * otherwise return trimmed original for later exception mapping.
 */
export function mapSkuUomToQuoteUom(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Unit";
  const lower = trimmed.toLowerCase();
  const alias = UOM_ALIASES[lower];
  if (alias) return alias;
  for (const canon of QUOTE_UOM_CANONICAL) {
    if (canon.toLowerCase() === lower) return canon;
  }
  return trimmed;
}
