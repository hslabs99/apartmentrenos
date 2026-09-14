import { NextResponse } from "next/server";
import {
  MASTER_PRICES_BUILDING_TAB_TITLE,
  MASTER_PRICES_CASCADES_TAB_TITLE,
  MASTER_PRICES_LABOUR_TAB_TITLE,
  MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE,
  MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE,
  MASTER_PRICES_PAINTING_TAB_TITLE,
  MASTER_PRICES_SKU_TAB_TITLE,
  MASTER_PRICES_LISTS_TAB_TITLE,
  MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
  MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
  MASTER_PRICES_SPREADSHEET_ID,
  masterPricesSpreadsheetEditUrl,
} from "@/lib/google/master-prices-spreadsheet";
import {
  findWorkbookTab,
  listWorkbookTabs,
  type ResolvedSheetTab,
} from "@/lib/google/resolve-sheet-tab";

export const runtime = "nodejs";

type ImportTabPayload = {
  tabTitle: string;
  requiredTabTitle: string;
  gid: number;
  gridRowCount: number | null;
  importProductCount: number | null;
  importSupplierCount: number | null;
  importNonBlankRows: number | null;
  url: string;
};

function tabPayloadFromResolve(
  tab: ResolvedSheetTab,
  requiredTabTitle: string,
): ImportTabPayload {
  return {
    tabTitle: tab.tabTitle,
    requiredTabTitle,
    gid: tab.gid,
    gridRowCount: tab.gridRowCount,
    importProductCount: null,
    importSupplierCount: null,
    importNonBlankRows: null,
    url: masterPricesSpreadsheetEditUrl(tab.gid),
  };
}

function optionalTab(
  tabs: ResolvedSheetTab[],
  requiredTabTitle: string,
): { tab: ImportTabPayload | null; error: string | null } {
  const found = findWorkbookTab(tabs, requiredTabTitle);
  if (found) return { tab: tabPayloadFromResolve(found, requiredTabTitle), error: null };
  return {
    tab: null,
    error: `Worksheet "${requiredTabTitle}" was not found in this workbook.`,
  };
}

/** GET — resolve import tabs from workbook metadata (no SKU value download). */
export async function GET() {
  try {
    const tabs = await listWorkbookTabs(MASTER_PRICES_SPREADSHEET_ID);
    const skuTab = findWorkbookTab(tabs, MASTER_PRICES_SKU_TAB_TITLE);
    if (!skuTab) {
      const tabNames = tabs.map((t) => t.tabTitle.trim()).filter(Boolean);
      return NextResponse.json(
        {
          error: `Worksheet "${MASTER_PRICES_SKU_TAB_TITLE}" was not found in this workbook (match is case-insensitive). Available tabs: ${tabNames.join(", ") || "(none)"}.`,
          spreadsheet: {
            id: MASTER_PRICES_SPREADSHEET_ID,
            url: `https://docs.google.com/spreadsheets/d/${MASTER_PRICES_SPREADSHEET_ID}/edit`,
          },
        },
        { status: 404 },
      );
    }

    const building = optionalTab(tabs, MASTER_PRICES_BUILDING_TAB_TITLE);
    const labour = optionalTab(tabs, MASTER_PRICES_LABOUR_TAB_TITLE);
    const painting = optionalTab(tabs, MASTER_PRICES_PAINTING_TAB_TITLE);
    const cascades = optionalTab(tabs, MASTER_PRICES_CASCADES_TAB_TITLE);
    const supplierDiscounts = optionalTab(tabs, MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE);
    const lists = optionalTab(tabs, MASTER_PRICES_LISTS_TAB_TITLE);
    const incrementalLabourProducts = optionalTab(
      tabs,
      MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
    );
    const buildingElements = optionalTab(tabs, MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE);
    const paintingElements = optionalTab(tabs, MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE);

    return NextResponse.json({
      skuAll: tabPayloadFromResolve(skuTab, MASTER_PRICES_SKU_TAB_TITLE),
      building: building.tab,
      buildingError: building.error,
      labour: labour.tab,
      labourError: labour.error,
      painting: painting.tab,
      paintingError: painting.error,
      cascades: cascades.tab,
      cascadesError: cascades.error,
      supplierDiscounts: supplierDiscounts.tab,
      supplierDiscountsError: supplierDiscounts.error,
      lists: lists.tab,
      listsError: lists.error,
      incrementalLabourProducts: incrementalLabourProducts.tab,
      incrementalLabourProductsError: incrementalLabourProducts.error,
      buildingElements: buildingElements.tab,
      buildingElementsError: buildingElements.error,
      paintingElements: paintingElements.tab,
      paintingElementsError: paintingElements.error,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to resolve import tab";
    return NextResponse.json(
      {
        error: message,
        spreadsheet: {
          id: MASTER_PRICES_SPREADSHEET_ID,
          url: `https://docs.google.com/spreadsheets/d/${MASTER_PRICES_SPREADSHEET_ID}/edit`,
        },
      },
      { status: 404 },
    );
  }
}
