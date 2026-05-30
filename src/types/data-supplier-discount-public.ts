import type { DataSupplierDiscount } from "@/types/data-supplier-discount";

export type DataSupplierDiscountPublic = DataSupplierDiscount & {
  id: string;
  importedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
