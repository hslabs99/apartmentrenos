import type { DataSupplierDiscountRange } from "@/types/data-supplier-discount";

export type DataSupplierDiscountRangePublic = DataSupplierDiscountRange & {
  id: string;
  importedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
