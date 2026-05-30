import type { DataObjectLabourRate } from "@/types/data-object-labour-rate";

export type DataObjectLabourRatePublic = DataObjectLabourRate & {
  id: string;
  importedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
