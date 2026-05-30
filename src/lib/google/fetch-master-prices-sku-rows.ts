import { fetchSkuRowsFromSheet, type FetchedMasterPricesSkus } from "@/lib/google/fetch-sku-rows-from-sheet";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import {
  resolveBuildingImportSheetTab,
  resolveLabourImportSheetTab,
  resolveSkuImportSheetTab,
} from "@/lib/google/resolve-sheet-tab";

export type { FetchedMasterPricesSkus };

export async function fetchMasterPricesSkuRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedMasterPricesSkus> {
  return fetchSkuRowsFromSheet(resolveSkuImportSheetTab, spreadsheetId);
}

export async function fetchMasterPricesBuildingSkuRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedMasterPricesSkus> {
  return fetchSkuRowsFromSheet(resolveBuildingImportSheetTab, spreadsheetId);
}

export async function fetchMasterPricesLabourSkuRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedMasterPricesSkus> {
  return fetchSkuRowsFromSheet(resolveLabourImportSheetTab, spreadsheetId);
}
