import { normalizeSupplierNameKey } from "@/lib/supplier/normalize-supplier-name";

/** Natural key for supplier discount rows (supplier name). */
export function dataSupplierDiscountKey(supplier: string): string {
  return normalizeSupplierNameKey(supplier);
}


