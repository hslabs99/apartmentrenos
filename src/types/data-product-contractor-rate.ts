/** Contractor rate row from `Products_ContractorRates` (row 5 headers, row 6+ data). */
export type DataProductContractorRate = {
  productType: string;
  specification: string;
  labourDesc: string | null;
  base: number | null;
  m2: number | null;
  lm: number | null;
  unit: number | null;
  notes: string | null;
  sheetRow: number;
};
