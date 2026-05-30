/** Firestore `data_blinds_types` — preamble / meta per blind type (sheet tab). */
export type DataBlindType = {
  typeName: string;
  typeSlug: string;
  priceSheetDate: string | null;
  productLabel: string;
  colourMaterial: string;
  priceMultiplier: number | null;
  gstInclusive: boolean;
  widthMinMm: number | null;
  widthMaxMm: number | null;
  hasMinChainDropColumn: boolean;
  sheetGid: number;
  headerRow1Based: number;
  dataStartRow1Based: number;
};
