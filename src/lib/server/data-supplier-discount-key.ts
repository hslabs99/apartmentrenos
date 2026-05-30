/** Natural key for supplier discount rows (supplier name). */

export function dataSupplierDiscountKey(supplier: string): string {

  return supplier.trim().toLowerCase();

}


