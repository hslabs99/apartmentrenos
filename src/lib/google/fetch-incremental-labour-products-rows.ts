import {
  INCREMENTAL_LABOUR_PRODUCTS_SHEET_RANGE,
  parseIncrementalLabourProductsRows,
  type ParsedIncrementalLabourProductRow,
} from "@/lib/google/parse-incremental-labour-products";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveIncrementalLabourProductsSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export type FetchedIncrementalLabourProducts = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  rows: ParsedIncrementalLabourProductRow[];
  errors: string[];
};

export async function fetchIncrementalLabourProductsRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedIncrementalLabourProducts> {
  const tab = await resolveIncrementalLabourProductsSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${INCREMENTAL_LABOUR_PRODUCTS_SHEET_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const { headerRow1Based, rows, errors } = parseIncrementalLabourProductsRows(values, 3);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    headerRow1Based,
    rows,
    errors,
  };
}
