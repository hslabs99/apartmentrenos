/** Labour rate row from `Products_Labour` (Category, Product Type, Product, $ Exc GST, UOM). */
export type DataLabourRate = {
  category: string;
  productType: string;
  product: string;
  priceExcGst: number;
  uom: string;
  sheetRow: number;
};
