import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import {
  parseMasterPricesSkuRows,
  type ParseMasterPricesSkusOptions,
} from "@/lib/google/parse-master-prices-skus";
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

export type SkuTabImportCounts = {
  tabTitle: string;
  gid: number;
  gridRowCount: number | null;
  /** Distinct products (cols A–F key) that would be written to data_skus. */
  importProductCount: number;
  /** Supplier option rows that would be written to data_sku_suppliers. */
  importSupplierCount: number;
  /** Sheet rows below the header with any non-blank cell (before product merge). */
  importNonBlankRows: number;
};

export type FetchSkuRowsParseOptions = Pick<
  ParseMasterPricesSkusOptions,
  "requireCategoryProductTypeProduct" | "fillDownProductKey"
>;

export async function fetchSkuTabImportCounts(
  resolveTab: (spreadsheetId: string) => Promise<ResolvedSheetTab>,
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
  parseOptions?: FetchSkuRowsParseOptions,
  columnRange = "A1:AZ",
): Promise<SkuTabImportCounts> {
  const fetched = await fetchSkuRowsFromSheet(
    resolveTab,
    spreadsheetId,
    parseOptions,
    columnRange,
  );
  const { audit } = fetched.parse;
  return {
    tabTitle: fetched.tabTitle,
    gid: fetched.gid,
    gridRowCount: fetched.gridRowCount,
    importProductCount: audit.productsImported,
    importSupplierCount: audit.suppliersImported,
    importNonBlankRows: audit.nonBlankRows,
  };
}

export async function fetchSkuRowsFromSheet(
  resolveTab: (spreadsheetId: string) => Promise<ResolvedSheetTab>,
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
  parseOptions?: FetchSkuRowsParseOptions,
  columnRange = "A1:AZ",
): Promise<FetchedMasterPricesSkus> {
  const tab = await resolveTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${columnRange}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const parse = parseMasterPricesSkuRows(values, {
    sheetGridRowCount: tab.gridRowCount,
    ...parseOptions,
  });

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    gridRowCount: tab.gridRowCount,
    parse,
  };
}
