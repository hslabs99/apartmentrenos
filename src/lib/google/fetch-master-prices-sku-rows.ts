import { fetchSkuRowsFromSheet, type FetchedMasterPricesSkus } from "@/lib/google/fetch-sku-rows-from-sheet";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import {
  resolveBuildingImportSheetTab,
  resolvePaintingImportSheetTab,
  resolveSkuImportSheetTab,
} from "@/lib/google/resolve-sheet-tab";

export type { FetchedMasterPricesSkus };

/** Products_SKU_ALL: cols A–F fill down for multi-supplier continuation rows. */
export const SKU_ALL_PARSE_OPTIONS = {
  fillDownProductKey: true,
} as const satisfies { fillDownProductKey: true };

/** Products_Building, Products_Painting: only rows with A–C populated. */
export const PARTIAL_SKU_TAB_PARSE_OPTIONS = {
  requireCategoryProductTypeProduct: true,
} as const satisfies { requireCategoryProductTypeProduct: true };

/** @deprecated use PARTIAL_SKU_TAB_PARSE_OPTIONS */
export const PAINTING_SKU_PARSE_OPTIONS = PARTIAL_SKU_TAB_PARSE_OPTIONS;

export async function fetchMasterPricesSkuRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedMasterPricesSkus> {
  return fetchSkuRowsFromSheet(resolveSkuImportSheetTab, spreadsheetId, SKU_ALL_PARSE_OPTIONS);
}

export async function fetchMasterPricesBuildingSkuRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedMasterPricesSkus> {
  return fetchSkuRowsFromSheet(
    resolveBuildingImportSheetTab,
    spreadsheetId,
    PARTIAL_SKU_TAB_PARSE_OPTIONS,
  );
}

export async function fetchMasterPricesPaintingSkuRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedMasterPricesSkus> {
  return fetchSkuRowsFromSheet(
    resolvePaintingImportSheetTab,
    spreadsheetId,
    PARTIAL_SKU_TAB_PARSE_OPTIONS,
  );
}
