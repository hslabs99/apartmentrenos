import { NextResponse } from "next/server";
import {
  MASTER_PRICES_BUILDING_TAB_TITLE,
  MASTER_PRICES_CASCADES_TAB_TITLE,
  MASTER_PRICES_LABOUR_TAB_TITLE,
  MASTER_PRICES_SKU_TAB_TITLE,
  MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
  MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
  MASTER_PRICES_SPREADSHEET_ID,
  masterPricesSpreadsheetEditUrl,
} from "@/lib/google/master-prices-spreadsheet";
import {
  resolveBuildingImportSheetTab,
  resolveCascadingRestrictionsSheetTab,
  resolveLabourImportSheetTab,
  resolveSkuImportSheetTab,
  resolveIncrementalLabourProductsSheetTab,
  resolveSupplierDiscountsSheetTab,
} from "@/lib/google/resolve-sheet-tab";

export const runtime = "nodejs";

function tabPayload(tab: {
  tabTitle: string;
  gid: number;
  gridRowCount: number | null;
  requiredTabTitle: string;
}) {
  return {
    tabTitle: tab.tabTitle,
    requiredTabTitle: tab.requiredTabTitle,
    gid: tab.gid,
    gridRowCount: tab.gridRowCount,
    url: masterPricesSpreadsheetEditUrl(tab.gid),
  };
}

/** GET — resolve SKU import tabs (Products_SKU_ALL, Products_Building, Products_Labour). */
export async function GET() {
  try {
    const skuAllTab = await resolveSkuImportSheetTab(MASTER_PRICES_SPREADSHEET_ID);
    const skuAll = tabPayload({
      ...skuAllTab,
      requiredTabTitle: MASTER_PRICES_SKU_TAB_TITLE,
    });

    let building: ReturnType<typeof tabPayload> | null = null;
    let buildingError: string | null = null;
    try {
      const buildingTab = await resolveBuildingImportSheetTab(MASTER_PRICES_SPREADSHEET_ID);
      building = tabPayload({
        ...buildingTab,
        requiredTabTitle: MASTER_PRICES_BUILDING_TAB_TITLE,
      });
    } catch (e) {
      buildingError = e instanceof Error ? e.message : "Failed to resolve building tab";
    }

    let labour: ReturnType<typeof tabPayload> | null = null;
    let labourError: string | null = null;
    try {
      const labourTab = await resolveLabourImportSheetTab(MASTER_PRICES_SPREADSHEET_ID);
      labour = tabPayload({
        ...labourTab,
        requiredTabTitle: MASTER_PRICES_LABOUR_TAB_TITLE,
      });
    } catch (e) {
      labourError = e instanceof Error ? e.message : "Failed to resolve labour tab";
    }

    let cascades: ReturnType<typeof tabPayload> | null = null;
    let cascadesError: string | null = null;
    try {
      const cascadesTab = await resolveCascadingRestrictionsSheetTab(MASTER_PRICES_SPREADSHEET_ID);
      cascades = tabPayload({
        ...cascadesTab,
        requiredTabTitle: MASTER_PRICES_CASCADES_TAB_TITLE,
      });
    } catch (e) {
      cascadesError = e instanceof Error ? e.message : "Failed to resolve cascades tab";
    }

    let supplierDiscounts: ReturnType<typeof tabPayload> | null = null;
    let supplierDiscountsError: string | null = null;
    try {
      const supplierDiscountsTab = await resolveSupplierDiscountsSheetTab(
        MASTER_PRICES_SPREADSHEET_ID,
      );
      supplierDiscounts = tabPayload({
        ...supplierDiscountsTab,
        requiredTabTitle: MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
      });
    } catch (e) {
      supplierDiscountsError =
        e instanceof Error ? e.message : "Failed to resolve supplier discounts tab";
    }

    let incrementalLabourProducts: ReturnType<typeof tabPayload> | null = null;
    let incrementalLabourProductsError: string | null = null;
    try {
      const incrementalTab = await resolveIncrementalLabourProductsSheetTab(
        MASTER_PRICES_SPREADSHEET_ID,
      );
      incrementalLabourProducts = tabPayload({
        ...incrementalTab,
        requiredTabTitle: MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
      });
    } catch (e) {
      incrementalLabourProductsError =
        e instanceof Error ? e.message : "Failed to resolve incremental labour products tab";
    }

    return NextResponse.json({
      skuAll,
      building,
      buildingError,
      labour,
      labourError,
      cascades,
      cascadesError,
      supplierDiscounts,
      supplierDiscountsError,
      incrementalLabourProducts,
      incrementalLabourProductsError,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to resolve import tab";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
