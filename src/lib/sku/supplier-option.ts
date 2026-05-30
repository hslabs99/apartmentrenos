export const MIN_SUPPLIER_OPTION = 1;
export const MAX_SUPPLIER_OPTION = 10;
/** Preferred supplier priority for default scope-line SKU lists (workbench). */
export const PREFERRED_SUPPLIER_OPTION = MIN_SUPPLIER_OPTION;

export function normalizeSupplierOption(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  let n: number;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    n = raw;
  } else {
    const s = String(raw).trim();
    if (!s) return null;
    n = Number(s);
    if (!Number.isFinite(n)) return null;
  }
  const i = Math.round(n);
  if (i < MIN_SUPPLIER_OPTION || i > MAX_SUPPLIER_OPTION) return null;
  return i;
}

export function isValidSupplierOption(n: number | null): n is number {
  return (
    typeof n === "number" &&
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n >= MIN_SUPPLIER_OPTION &&
    n <= MAX_SUPPLIER_OPTION
  );
}
