import type { DataBuildingElement, DataBuildingElementLine } from "@/types/data-building-element";

export type DataBuildingElementLinePublic = DataBuildingElementLine;

export type DataBuildingElementPublic = DataBuildingElement & {
  id: string;
  importedAt: string | null;
};
