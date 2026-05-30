import { BLINDS_PRICES_SPREADSHEET_ID } from "@/lib/google/blinds-prices-spreadsheet";
import { listWorkbookSheetTabs } from "@/lib/google/list-workbook-sheet-tabs";
import {
  buildDataBlindType,
  parseBlindsMatrixTab,
  type ParseBlindsMatrixResult,
} from "@/lib/google/parse-blinds-matrix";
import type { ResolvedSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";
import type { DataBlindFooter } from "@/types/data-blind-footer";
import type { DataBlindType } from "@/types/data-blind-type";
import { blindsTypeSlug } from "@/lib/google/blinds-type-slug";
import type { ParsedBlindPriceRow } from "@/lib/google/parse-blinds-matrix";

/** Matrix + footers fit below this row (largest tab ~30 drops + 11 footers + header). */
export const BLINDS_MATRIX_LAST_ROW = 120;

const BATCH_GET_CHUNK = 50;

export function blindsTabDataRange(tabTitle: string): string {
  return `${quoteSheetTabForRange(tabTitle)}!A1:AZ${BLINDS_MATRIX_LAST_ROW}`;
}

export type FetchedBlindsTab = {
  tab: ResolvedSheetTab;
  range: string;
  parse: ParseBlindsMatrixResult;
  typeMeta: DataBlindType | null;
  priceRows: ParsedBlindPriceRow[];
  footers: DataBlindFooter[];
};

export type FetchedBlindsWorkbook = {
  spreadsheetId: string;
  tabs: ResolvedSheetTab[];
  matrixTabs: FetchedBlindsTab[];
  skippedTabs: { tabTitle: string; gid: number; reason: string }[];
};

export type BlindsTabTestSummary = {
  typeName: string;
  priceRows: number;
  footers: number;
  widthMinMm: number | null;
  widthMaxMm: number | null;
};

export type BlindsWorkbookTestSummary = {
  spreadsheetId: string;
  tabsScanned: number;
  matrixTabs: BlindsTabTestSummary[];
  skippedTabs: { tabTitle: string; gid: number; reason: string }[];
};

async function batchFetchTabValues(
  spreadsheetId: string,
  tabs: ResolvedSheetTab[],
): Promise<Map<string, unknown[][]>> {
  const out = new Map<string, unknown[][]>();
  if (tabs.length === 0) return out;

  const { sheets } = getSheetsApiClient();

  for (let i = 0; i < tabs.length; i += BATCH_GET_CHUNK) {
    const chunk = tabs.slice(i, i + BATCH_GET_CHUNK);
    const ranges = chunk.map((t) => blindsTabDataRange(t.tabTitle));
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const valueRanges = res.data.valueRanges ?? [];
    chunk.forEach((tab, idx) => {
      out.set(tab.tabTitle, (valueRanges[idx]?.values ?? []) as unknown[][]);
    });
  }

  return out;
}

function processParsedTab(
  tab: ResolvedSheetTab,
  range: string,
  parse: ParseBlindsMatrixResult,
): FetchedBlindsTab | { skip: string } {
  if (!parse.isMatrix) {
    return { skip: "No blind price matrix header (Drop + width columns)." };
  }

  const typeName = tab.tabTitle;
  const typeSlug = blindsTypeSlug(typeName);
  const typeMeta = buildDataBlindType(typeName, tab.gid, parse);
  const footers: DataBlindFooter[] = parse.footers.map((f) => ({
    ...f,
    type: typeName,
    typeSlug,
  }));

  return {
    tab,
    range,
    parse,
    typeMeta,
    priceRows: parse.priceRows,
    footers,
  };
}

export async function fetchBlindsWorkbook(
  spreadsheetId: string = BLINDS_PRICES_SPREADSHEET_ID,
): Promise<FetchedBlindsWorkbook> {
  const tabs = await listWorkbookSheetTabs(spreadsheetId);
  const valuesByTab = await batchFetchTabValues(spreadsheetId, tabs);
  const matrixTabs: FetchedBlindsTab[] = [];
  const skippedTabs: FetchedBlindsWorkbook["skippedTabs"] = [];

  for (const tab of tabs) {
    const range = blindsTabDataRange(tab.tabTitle);
    const values = valuesByTab.get(tab.tabTitle) ?? [];
    const parse = parseBlindsMatrixTab(values, 1);
    const result = processParsedTab(tab, range, parse);

    if ("skip" in result) {
      skippedTabs.push({ tabTitle: tab.tabTitle, gid: tab.gid, reason: result.skip });
      continue;
    }
    matrixTabs.push(result);
  }

  return { spreadsheetId, tabs, matrixTabs, skippedTabs };
}

/** Fast test: one batchGet for all tabs, return row counts only. */
export async function summarizeBlindsWorkbookForTest(
  spreadsheetId: string = BLINDS_PRICES_SPREADSHEET_ID,
): Promise<BlindsWorkbookTestSummary> {
  const tabs = await listWorkbookSheetTabs(spreadsheetId);
  const valuesByTab = await batchFetchTabValues(spreadsheetId, tabs);
  const matrixTabs: BlindsTabTestSummary[] = [];
  const skippedTabs: BlindsWorkbookTestSummary["skippedTabs"] = [];

  for (const tab of tabs) {
    const values = valuesByTab.get(tab.tabTitle) ?? [];
    const parse = parseBlindsMatrixTab(values, 1);

    if (!parse.isMatrix) {
      skippedTabs.push({
        tabTitle: tab.tabTitle,
        gid: tab.gid,
        reason: "No blind price matrix header (Drop + width columns).",
      });
      continue;
    }

    matrixTabs.push({
      typeName: tab.tabTitle,
      priceRows: parse.priceRows.length,
      footers: parse.footers.length,
      widthMinMm: parse.typeMeta?.widthMinMm ?? null,
      widthMaxMm: parse.typeMeta?.widthMaxMm ?? null,
    });
  }

  return {
    spreadsheetId,
    tabsScanned: tabs.length,
    matrixTabs,
    skippedTabs,
  };
}
