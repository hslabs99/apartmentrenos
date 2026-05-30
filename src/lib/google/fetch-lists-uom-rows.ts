import {
  LISTS_UOM_RANGE,
  parseListsUomRows,
  type ParsedListsUomRow,
} from "@/lib/google/parse-lists-uom";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveListsSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export type FetchedListsUom = {
  tabTitle: string;
  gid: number;
  range: string;
  rows: ParsedListsUomRow[];
};

export async function fetchListsUomRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedListsUom> {
  const tab = await resolveListsSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${LISTS_UOM_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const rows = parseListsUomRows(values, 4);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    rows,
  };
}
