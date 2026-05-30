/** Firestore `data_skus` document — product key cols A–F + metadata N–S. */

export type DataSku = {

  skuId: string;

  category: string;

  productType: string;

  product: string;

  elevateLevel: string;

  style: string;

  colourOptions: string;

  uom: string;

  /** Linked product type for bundled SKU slot 1 (not part of product key). */

  append1Type: string;

  /** Specification pointer for slot 1 — matches another row’s `product`. */

  append1Spec: string;

  append2Type: string;

  append2Spec: string;

  append3Type: string;

  append3Spec: string;

  /** Legacy column removed from sheet layout; kept for old Firestore docs. */

  sheetWidth: string;

  stockAvailable: string;

  leadTime: string;

  location: string;

  comments: string;

  /**

   * Workbook row number(s) from the latest import for this SKU.

   * On key match/update, stores the last sheet row processed for that product (debug).

   */

  sourceSheetRows: number[];

  /** True when present on the latest import sheet; false if removed from sheet but kept in DB. */

  isCurrent: boolean;

};

