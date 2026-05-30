import type { BlindWidthField } from "@/lib/google/blinds-width-columns";

/** Firestore `data_blinds` — one row per type + drop (mm). */
export type DataBlind = {
  type: string;
  typeSlug: string;
  dropMm: number;
  minChainDropMm: number | null;
  sourceSheetRow: number;
} & Record<BlindWidthField, number | null>;
