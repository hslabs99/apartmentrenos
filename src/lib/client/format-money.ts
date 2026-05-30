/** Locale currency/number display for UI tables (no currency symbol). */
export function formatMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Editable currency field (2 decimal places, no symbol). */
export function formatCurrencyInput(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseCurrencyInput(raw: string): number | null {
  const t = raw.trim().replace(/[^0-9.-]/g, "");
  if (!t || t === "-" || t === ".") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
