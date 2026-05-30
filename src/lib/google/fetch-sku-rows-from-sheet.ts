import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { parseMasterPricesSkuRows } from "@/lib/google/parse-master-prices-skus";
import type { ResolvedSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export type FetchedMasterPricesSkus = {
  tabTitle: string;
  gid: number;
  range: string;
  gridRowCount: number | null;
  parse: ReturnType<typeof parseMasterPricesSkuRows>;
};

export async function fetchSkuRowsFromSheet(
  resolveTab: (spreadsheetId: string) => Promise<ResolvedSheetTab>,
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedMasterPricesSkus> {
  const tab = await resolveTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!A1:AZ`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const parse = parseMasterPricesSkuRows(values, {
    sheetGridRowCount: tab.gridRowCount,
  });

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    gridRowCount: tab.gridRowCount,
    parse,
  };
}
