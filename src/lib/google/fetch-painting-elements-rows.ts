import {
  PAINTING_ELEMENTS_SHEET_RANGE,
  parsePaintingElementsRows,
} from "@/lib/google/parse-painting-elements";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolvePaintingElementsSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";
import type { DataPaintingElement } from "@/types/data-painting-element";

export type FetchedPaintingElements = {
  tabTitle: string;
  gid: number;
  range: string;
  elements: DataPaintingElement[];
  parsedLines: number;
  errors: string[];
};

export async function fetchPaintingElementsRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedPaintingElements> {
  const tab = await resolvePaintingElementsSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${PAINTING_ELEMENTS_SHEET_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const { elements, errors } = parsePaintingElementsRows(values, 1);
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
