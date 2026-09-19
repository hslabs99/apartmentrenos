/** Wall-clock breakdown for scope-answer POST (ms unless noted). */
export type ScopeAnswerTimings = {
  loadProjectAreaMs?: number;
  loadScopeMs?: number;
  loadTemplateAreaMs?: number;
  deleteLinesQueryMs?: number;
  deleteLinesWriteMs?: number;
  deleteLinesScanned?: number;
  deleteLinesRemoved?: number;
  updateAnswersMs?: number;
  collectEffectivePlMs?: number;
  collectSkuFiltersMs?: number;
  collectQuoteDocsMs?: number;
  collectSkuResolveMs?: number;
  collectMs?: number;
  nextSortOrderMs?: number;
  matExtraQuotesMs?: number;
  matStyleColourMs?: number;
  matElevateMs?: number;
  matDimsMs?: number;
  matObjectLabourMs?: number;
  matContractLabourMs?: number;
  matSkuPrimeMs?: number;
  matSupplierPrimeMs?: number;
  matCatalogsWallMs?: number;
  matWriteMs?: number;
  materializeMs?: number;
  skuCacheWasWarm?: boolean;
  supplierCacheWasWarm?: boolean;
  colourLookupCacheWasWarm?: boolean;
  skuCacheCount?: number;
  quoteDocsLoaded?: number;
  lineSpecs?: number;
  applyTotalMs?: number;
  reloadProjectAreaMs?: number;
  loadProjectMs?: number;
  elevateMs?: number;
  readAddedLinesMs?: number;
  primeCatalogsWallMs?: number;
};

export async function timedValue<T, K extends keyof ScopeAnswerTimings>(
  timings: ScopeAnswerTimings | undefined,
  key: K,
  fn: () => Promise<T>,
): Promise<T> {
  if (!timings) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    (timings as Record<string, number>)[key as string] = Math.round(performance.now() - t0);
  }
}

/** Chrome Network → Headers → Server-Timing (durations in ms). */
export function serverTimingHeader(timings: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(timings)) {
    if (typeof value !== "number" || !key.endsWith("Ms")) continue;
    const name = key.slice(0, -2);
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) continue;
    parts.push(`${name};dur=${value}`);
  }
  return parts.join(", ");
}

export function scopeAnswerServerTimingHeader(timings: ScopeAnswerTimings): string {
  return serverTimingHeader(timings);
}
