import { getSheetsApiClient } from "@/lib/google/sheets-client";
import type { ResolvedSheetTab } from "@/lib/google/resolve-sheet-tab";

/** List all worksheets in a workbook (for dynamic tab scan). */
export async function listWorkbookSheetTabs(
  spreadsheetId: string,
): Promise<ResolvedSheetTab[]> {
  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const out: ResolvedSheetTab[] = [];
  for (const sheet of res.data.sheets ?? []) {
    const props = sheet.properties;
    if (!props?.title || props.sheetId == null) continue;
    const grid = props.gridProperties;
    out.push({
      tabTitle: props.title,
      gid: props.sheetId,
      gridRowCount: grid?.rowCount ?? null,
      gridColumnCount: grid?.columnCount ?? null,
    });
  }
  return out;
}
