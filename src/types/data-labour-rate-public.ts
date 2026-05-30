import type { DataLabourRate } from "@/types/data-labour-rate";

export type DataLabourRatePublic = DataLabourRate & {
  id: string;
  sheetRow: number;
  importedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
