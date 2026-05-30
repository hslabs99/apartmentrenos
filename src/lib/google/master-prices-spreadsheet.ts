/** Master prices workbook (Google Sheets). */
export const MASTER_PRICES_SPREADSHEET_ID =
  "1aQ4lxRoxw___5lHxuyE3ZpWYRdBXHIo-RdMM0a9YE64";

/**
 * Primary SKU import tab → `data_skus`. Name must match the Google Sheet tab exactly.
 */
export const MASTER_PRICES_SKU_TAB_TITLE = "Products_SKU_ALL";

/**
 * Building SKU import tab — same columns/layout as {@link MASTER_PRICES_SKU_TAB_TITLE}.
 */
export const MASTER_PRICES_BUILDING_TAB_TITLE = "Products_Building";

/**
 * Labour SKU import tab — same columns/layout as {@link MASTER_PRICES_SKU_TAB_TITLE}.
 */
export const MASTER_PRICES_LABOUR_TAB_TITLE = "Products_Labour";

/** Case-insensitive worksheet title match (trimmed). */
export function sheetTabTitleMatches(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Lists tab: styles → `lookups`, colours → `lookups_colours`. */
export const MASTER_PRICES_LISTS_TAB_TITLE = "Lists";

/** Cascading Restrictions tab → `cascades` (Level, Style, Colour). */
export const MASTER_PRICES_CASCADES_TAB_TITLE = "Cascading Restrictions";

/** Supplier Discounts tab → `data_supplier_discounts` (tiered % by order value silo). */
export const MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE = "Supplier Discounts";

/** Incremental labour per product → `data_objectlabourrates` (upsert by category + type + product). */
export const MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE =
  "Incremental Labour - Products";

/** @deprecated Import resolves tab by title only — use gid from API/import-tab route. */
export const MASTER_PRICES_SKU_TAB_GID = 1527163479;

/** @deprecated use MASTER_PRICES_SKU_TAB_GID */
export const MASTER_PRICES_DEFAULT_GID = MASTER_PRICES_SKU_TAB_GID;

export function masterPricesSpreadsheetEditUrl(gid: number): string {
  const base = `https://docs.google.com/spreadsheets/d/${MASTER_PRICES_SPREADSHEET_ID}/edit`;
  return `${base}?gid=${gid}#gid=${gid}`;
}
