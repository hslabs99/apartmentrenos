/** Line item under a painting element column (rows 9–100, cols A–G + element M2). */
export type DataPaintingElementLine = {
  statusCheck: string;
  category: string;
  skuProduct: string;
  lineUom: string;
  litrePerM2: number | null;
  priceLitre: number | null;
  priceM2: number | null;
  m2Multiplier: number;
  sheetRow: number;
};

/** Painting element header from columns H+ (rows 2–6) with nested detail lines. */
export type DataPaintingElement = {
  skuName: string;
  element: string;
  size: string;
  type: string;
  quantityUom: string;
  sheetColumn: string;
  headerSheetRow: number;
  lines: DataPaintingElementLine[];
};
