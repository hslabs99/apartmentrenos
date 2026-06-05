import {
  PRODUCT_CONTRACTOR_RATES_SHEET_RANGE,
  parseProductContractorRatesRows,
  type ParsedProductContractorRateRow,
} from "@/lib/google/parse-product-contractor-rates";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";
import { resolveProductContractorRatesSheetTab } from "@/lib/google/resolve-sheet-tab";
import { quoteSheetTabForRange } from "@/lib/google/sheet-range";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export type FetchedProductContractorRates = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  rows: ParsedProductContractorRateRow[];
  errors: string[];
};

export async function fetchProductContractorRatesRows(
  spreadsheetId: string = MASTER_PRICES_SPREADSHEET_ID,
): Promise<FetchedProductContractorRates> {
  const tab = await resolveProductContractorRatesSheetTab(spreadsheetId);
  const quoted = quoteSheetTabForRange(tab.tabTitle);
  const range = `${quoted}!${PRODUCT_CONTRACTOR_RATES_SHEET_RANGE}`;

  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (res.data.values ?? []) as unknown[][];
  const { headerRow1Based, rows, errors } = parseProductContractorRatesRows(values, 1);

  return {
    tabTitle: tab.tabTitle,
    gid: tab.gid,
    range,
    headerRow1Based,
    rows,
    errors,
  };
}
