/** Incremental labour hours per product (`Incremental Labour - Products` sheet). */
export type DataObjectLabourRate = {
  category: string;
  productType: string;
  product: string;
  constructionAssistant: number;
  leadContractor: number;
  electrician: number;
  plumber: number;
  uom: string;
  comments: string;
  sheetRow: number;
};
