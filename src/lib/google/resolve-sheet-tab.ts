import { getSheetsApiClient } from "@/lib/google/sheets-client";
import {
  MASTER_PRICES_BUILDING_TAB_TITLE,
  MASTER_PRICES_CASCADES_TAB_TITLE,
  MASTER_PRICES_LABOUR_TAB_TITLE,
  MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE,
  MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE,
  MASTER_PRICES_PAINTING_TAB_TITLE,
  MASTER_PRICES_LISTS_TAB_TITLE,
  MASTER_PRICES_SKU_TAB_TITLE,
  MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
  MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
  sheetTabTitleMatches,
} from "@/lib/google/master-prices-spreadsheet";

export type ResolvedSheetTab = {
  tabTitle: string;
  gid: number;
  gridRowCount: number | null;
  gridColumnCount: number | null;
};

export async function resolveSheetTitleByGid(
  spreadsheetId: string,
  gid: number,
): Promise<string> {
  const tab = await resolveSheetTabByGid(spreadsheetId, gid);
  return tab.tabTitle;
}

const WORKBOOK_TAB_LIST_FIELDS =
  "sheets(properties(sheetId,title,hidden,gridProperties(rowCount,columnCount)))";

export async function resolveSheetTabByGid(
  spreadsheetId: string,
  gid: number,
): Promise<ResolvedSheetTab> {
  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: WORKBOOK_TAB_LIST_FIELDS,
  });
  const match = (res.data.sheets ?? []).find(
    (s) => s.properties?.sheetId === gid,
  );
  const props = match?.properties;
  const title = props?.title;
  if (!title || props?.sheetId == null) {
    throw new Error(
      `No worksheet found with gid ${gid} in spreadsheet ${spreadsheetId}.`,
    );
  }
  const grid = props.gridProperties;
  return {
    tabTitle: title,
    gid: props.sheetId,
    gridRowCount: grid?.rowCount ?? null,
    gridColumnCount: grid?.columnCount ?? null,
  };
}

export async function listWorkbookTabs(spreadsheetId: string): Promise<ResolvedSheetTab[]> {
  const { sheets } = getSheetsApiClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: WORKBOOK_TAB_LIST_FIELDS,
  });
  return (res.data.sheets ?? []).flatMap((s) => {
    const props = s.properties;
    if (props?.sheetId == null || !props.title) return [];
    const grid = props.gridProperties;
    return [
      {
        tabTitle: props.title,
        gid: props.sheetId,
        gridRowCount: grid?.rowCount ?? null,
        gridColumnCount: grid?.columnCount ?? null,
      },
    ];
  });
}

export function findWorkbookTab(
  tabs: ResolvedSheetTab[],
  requiredTabTitle: string,
): ResolvedSheetTab | null {
  return tabs.find((t) => sheetTabTitleMatches(t.tabTitle, requiredTabTitle)) ?? null;
}

/** Resolve a worksheet by title (case-insensitive, trimmed). */
export async function resolveSheetTabByTitle(
  spreadsheetId: string,
  requiredTabTitle: string,
): Promise<ResolvedSheetTab> {
  const all = await listWorkbookTabs(spreadsheetId);
  const match = findWorkbookTab(all, requiredTabTitle);
  if (match) return match;

  const tabNames = all.map((t) => t.tabTitle.trim()).filter(Boolean);
  throw new Error(
    `Worksheet "${requiredTabTitle}" was not found in this workbook (match is case-insensitive). ` +
      `Available tabs: ${tabNames.join(", ") || "(none)"}.`,
  );
}

/** Resolve the primary SKU import worksheet (`Products_SKU_ALL`). */
export async function resolveSkuImportSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_SKU_TAB_TITLE);
}

/** Resolve the building SKU import worksheet (`Products_Building`). */
export async function resolveBuildingImportSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_BUILDING_TAB_TITLE);
}

/** Resolve the labour rates worksheet (`Products_Labour`). */
export async function resolveLabourImportSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_LABOUR_TAB_TITLE);
}

/** Resolve the building elements worksheet (`Building Elements`). */
export async function resolveBuildingElementsSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE);
}

/** Resolve the painting elements worksheet (`Painting Elements`). */
export async function resolvePaintingElementsSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE);
}

/** Resolve the painting SKU import worksheet (`Products_Painting`). */
export async function resolvePaintingImportSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_PAINTING_TAB_TITLE);
}

/** Resolve the cascading restrictions worksheet (`Cascading Restrictions`). */
export async function resolveCascadingRestrictionsSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_CASCADES_TAB_TITLE);
}

/** Resolve the Lists worksheet for Style lookup import. */
export async function resolveListsSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_LISTS_TAB_TITLE);
}

/** Resolve the Supplier Discounts worksheet. */
export async function resolveSupplierDiscountsSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(spreadsheetId, MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE);
}

/** Resolve the Incremental Labour - Products worksheet. */
export async function resolveIncrementalLabourProductsSheetTab(
  spreadsheetId: string,
): Promise<ResolvedSheetTab> {
  return resolveSheetTabByTitle(
    spreadsheetId,
    MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
  );
}
