/**
 * Align SKU supplier display names with `data_supplier_discounts.supplier`
 * (sheet names often differ by &/and, bath/bathroom, punctuation).
 */
export function normalizeSupplierNameKey(supplier: string): string {
  let s = supplier.trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/\s*&\s*/g, " and ");
  s = s.replace(/\bbathrooms?\b/g, "bath");
  s = s.replace(/[.']/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
