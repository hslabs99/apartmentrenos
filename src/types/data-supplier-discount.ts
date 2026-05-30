/** Supplier row: one sheet row → one document (columns A–G). */
export type DataSupplierDiscount = {
  supplier: string;
  /** Default discount % (column B). */
  default: number;
  /** Tier discount % for range 1–4 (columns C–F); null when blank. */
  range1: number | null;
  range2: number | null;
  range3: number | null;
  range4: number | null;
  comment?: string;
  sheetRow: number;
};

/** Range definition from header row C2:F2 (range name 1–4 → order threshold). */
export type DataSupplierDiscountRange = {
  rangeName: number;
  /** Order-value threshold ($) from sheet header; stored in field `discount` per spec. */
  discount: number;
};
