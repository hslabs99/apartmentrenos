/** One non-blank sheet row after column mapping. */

export type ParsedSheetRow = {

  sheetRowNumber: number;

  /** Row that defined cols A–F (self, or fill-down source for supplier continuation rows). */
  productKeySourceRowNumber: number;

  category: string;

  productType: string;

  product: string;

  elevateLevel: string;

  style: string;

  colourOptions: string;

  supplierOption: number | null;

  supplier: string;

  model: string;

  supplierSku: string;

  link: string;

  priceIncGst: number | null;

  priceExcGst: number | null;

  uom: string;

  append1Type: string;

  append1Spec: string;

  append2Type: string;

  append2Spec: string;

  append3Type: string;

  append3Spec: string;

  sheetWidth: string;

  stockAvailable: string;

  leadTime: string;

  location: string;

  comments: string;

};



export type ParsedSheetFieldKey = keyof Omit<

  ParsedSheetRow,

  "sheetRowNumber" | "productKeySourceRowNumber" | "supplierOption" | "priceIncGst" | "priceExcGst"

>;

