/** Blinds retail price matrix workbook (Google Sheets). */
export const BLINDS_PRICES_SPREADSHEET_ID =
  "1tebnCsjOy-7oQ4f7njK08L37kb5zff81CqigntRs7No";

export function blindsPricesSpreadsheetEditUrl(gid?: number): string {
  const base = `https://docs.google.com/spreadsheets/d/${BLINDS_PRICES_SPREADSHEET_ID}/edit`;
  if (gid == null) return base;
  return `${base}?gid=${gid}#gid=${gid}`;
}
