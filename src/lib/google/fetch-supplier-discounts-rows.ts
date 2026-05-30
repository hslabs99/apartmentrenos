import {
  SUPPLIER_DISCOUNTS_SHEET_RANGE,
  parseSupplierDiscountsSheet,
} from "@/lib/google/parse-supplier-discounts";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveSupplierDiscountsSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";
import type { DataSupplierDiscount } from "@/types/data-supplier-discount";
import type { DataSupplierDiscountRange } from "@/types/data-supplier-discount";

export type FetchedSupplierDiscounts = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  dataStartRow1Based: number;
  ranges: DataSupplierDiscountRange[];
  suppliers: DataSupplierDiscount[];
  errors: string[];
};

export async function fetchSupplierDiscountsRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedSupplierDiscounts> {
  const tab = await resolveSupplierDiscountsSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${SUPPLIER_DISCOUNTS_SHEET_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const parsed = parseSupplierDiscountsSheet(values, 1);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    headerRow1Based: parsed.headerRow1Based,
    dataStartRow1Based: parsed.dataStartRow1Based,
    ranges: parsed.ranges,
    suppliers: parsed.suppliers,
    errors: parsed.errors,
  };
}
