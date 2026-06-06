/** Line item under a building element column (rows 9–100, cols A–E + element qty). */
export type DataBuildingElementLine = {
  category: string;
  skuProduct: string;
  lineUom: string;
  unitPrice: number | null;
  quantity: number;
  sheetRow: number;
};

/** Building element header from columns F+ (rows 2–6) with nested detail lines. */
export type DataBuildingElement = {
  skuName: string;
  element: string;
  size: string;
  type: string;
  quantityUom: string;
  sheetColumn: string;
  headerSheetRow: number;
  lines: DataBuildingElementLine[];
};
