import {
  LISTS_STYLE_RANGE,
  parseListsStyleRows,
  type ParsedListsStyleRow,
} from "@/lib/google/parse-lists-styles";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveListsSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export type FetchedListsStyles = {
  tabTitle: string;
  gid: number;
  range: string;
  rows: ParsedListsStyleRow[];
};

export async function fetchListsStyleRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedListsStyles> {
  const tab = await resolveListsSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${LISTS_STYLE_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const rows = parseListsStyleRows(values, 4);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    rows,
  };
}
