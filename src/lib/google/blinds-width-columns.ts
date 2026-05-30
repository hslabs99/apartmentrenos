/** Width columns supported on blind price grids (mm, step 100). */
export const BLIND_WIDTH_MM_MIN = 600;
export const BLIND_WIDTH_MM_MAX = 3000;
export const BLIND_WIDTH_MM_STEP = 100;

export const BLIND_WIDTH_MM_VALUES: number[] = (() => {
  const out: number[] = [];
  for (let w = BLIND_WIDTH_MM_MIN; w <= BLIND_WIDTH_MM_MAX; w += BLIND_WIDTH_MM_STEP) {
    out.push(w);
  }
  return out;
})();

export type BlindWidthField = `w${number}`;

export function blindWidthFieldName(widthMm: number): BlindWidthField {
  return `w${widthMm}`;
}

export function isSupportedBlindWidthMm(widthMm: number): boolean {
  return (
    widthMm >= BLIND_WIDTH_MM_MIN &&
    widthMm <= BLIND_WIDTH_MM_MAX &&
    widthMm % BLIND_WIDTH_MM_STEP === 0
  );
}

/** Empty price slots for all supported widths. */
export function emptyBlindWidthPrices(): Record<BlindWidthField, number | null> {
  const out = {} as Record<BlindWidthField, number | null>;
  for (const w of BLIND_WIDTH_MM_VALUES) {
    out[blindWidthFieldName(w)] = null;
  }
  return out;
}
