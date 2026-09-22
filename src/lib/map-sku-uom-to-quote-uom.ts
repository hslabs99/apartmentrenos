/** Map master-sheet / SKU UOM strings to Setup → Quote Objects UOM values. */
const UOM_ALIASES: Record<string, string> = {
  ea: "Unit",
  each: "Unit",
  unit: "Unit",
  units: "Unit",
  "lm runs": "LM-Runs",
  lm_runs: "LM-Runs",
  lmruns: "LM-Runs",
};

const QUOTE_UOM_CANONICAL = new Set([
  "Unit",
  "M2",
  "M3",
  "LM",
  "LM-Runs",
  "Kg",
  "Ltr",
  "Y/N",
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

/**
 * Existing data/quote object UOM wins, except a price-list `LM-Runs` upgrades it.
 * Never downgrades `LM-Runs`, and never replaces M2/Unit/LM with a different non-runs UOM.
 * Blank existing UOM takes the incoming sheet value (new fill).
 */
export function resolveExistingObjectUomFromPriceList(
  existingUom: string | null | undefined,
  incomingUom: string | null | undefined,
): string {
  const incoming = mapSkuUomToQuoteUom(incomingUom ?? "");
  const rawExisting = String(existingUom ?? "").trim();
  if (!rawExisting) return incoming;
  if (incoming === "LM-Runs") return "LM-Runs";
  return mapSkuUomToQuoteUom(rawExisting);
}
