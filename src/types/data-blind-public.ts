import type { BlindWidthField } from "@/lib/google/blinds-width-columns";
import type { DataBlindFooter } from "@/types/data-blind-footer";
import type { DataBlindType } from "@/types/data-blind-type";

export type DataBlindPublic = {
  id: string;
  type: string;
  typeSlug: string;
  dropMm: number;
  minChainDropMm: number | null;
  sourceSheetRow: number;
  prices: Partial<Record<BlindWidthField, number>>;
};

export type DataBlindTypePublic = DataBlindType & { id: string };

export type DataBlindFooterPublic = DataBlindFooter & { id: string };
