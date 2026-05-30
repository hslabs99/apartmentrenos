import {
  LABOUR_RATES_SHEET_RANGE,
  parseLabourRatesRows,
  type ParsedLabourRateRow,
} from "@/lib/google/parse-labour-rates";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveLabourImportSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export type FetchedLabourRates = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  rows: ParsedLabourRateRow[];
  errors: string[];
};

export async function fetchLabourRatesRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedLabourRates> {
  const tab = await resolveLabourImportSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${LABOUR_RATES_SHEET_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const { headerRow1Based, rows, errors } = parseLabourRatesRows(values, 1);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    headerRow1Based,
    rows,
    errors,
  };
}
