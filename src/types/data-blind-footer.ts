/** Firestore `data_blinds_footers` — footer note lines per blind type. */
export type DataBlindFooter = {
  type: string;
  typeSlug: string;
  sortOrder: number;
  noteText: string;
  impactPct: number | null;
  sourceSheetRow: number;
};
