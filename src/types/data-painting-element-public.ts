import type { DataPaintingElement, DataPaintingElementLine } from "@/types/data-painting-element";

export type DataPaintingElementLinePublic = DataPaintingElementLine;

export type DataPaintingElementPublic = DataPaintingElement & {
  id: string;
  importedAt: string | null;
};
