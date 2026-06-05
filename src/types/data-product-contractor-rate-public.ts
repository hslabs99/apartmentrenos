import type { DataProductContractorRate } from "@/types/data-product-contractor-rate";

export type DataProductContractorRatePublic = DataProductContractorRate & {
  id: string;
  importedAt: string | null;
};
