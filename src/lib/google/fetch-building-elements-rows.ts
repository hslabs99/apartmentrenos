import {
  BUILDING_ELEMENTS_SHEET_RANGE,
  parseBuildingElementsRows,
} from "@/lib/google/parse-building-elements";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveBuildingElementsSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";
import type { DataBuildingElement } from "@/types/data-building-element";

export type FetchedBuildingElements = {
  tabTitle: string;
  gid: number;
  range: string;
  elements: DataBuildingElement[];
  parsedLines: number;
  errors: string[];
};

export async function fetchBuildingElementsRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedBuildingElements> {
  const tab = await resolveBuildingElementsSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${BUILDING_ELEMENTS_SHEET_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const { elements, errors } = parseBuildingElementsRows(values, 1);
  const parsedLines = elements.reduce((sum, el) => sum + el.lines.length, 0);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    elements,
    parsedLines,
    errors,
  };
}
