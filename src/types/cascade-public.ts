import type { Cascade } from "@/types/cascade";

export type CascadePublic = Cascade & {
  id: string;
  sheetRow: number;
  importedAt: string | null;
};
