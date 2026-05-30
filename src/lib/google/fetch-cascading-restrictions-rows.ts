import {
  CASCADES_SHEET_RANGE,
  parseCascadingRestrictionsRows,
  type ParsedCascadeRow,
} from "@/lib/google/parse-cascading-restrictions";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveCascadingRestrictionsSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export type FetchedCascadingRestrictions = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  rows: ParsedCascadeRow[];
};

export async function fetchCascadingRestrictionsRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedCascadingRestrictions> {
  const tab = await resolveCascadingRestrictionsSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${CASCADES_SHEET_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const { headerRow1Based, rows } = parseCascadingRestrictionsRows(values, 1);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    headerRow1Based,
    rows,
  };
}
