import { NextResponse } from "next/server";
import { fetchSkuTabImportCounts } from "@/lib/google/fetch-sku-rows-from-sheet";
import {
  PARTIAL_SKU_TAB_PARSE_OPTIONS,
  SKU_ALL_PARSE_OPTIONS,
} from "@/lib/google/fetch-master-prices-sku-rows";
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
  resolveBuildingImportSheetTab,
  resolveCascadingRestrictionsSheetTab,
  resolveLabourImportSheetTab,
  resolveBuildingElementsSheetTab,
  resolvePaintingElementsSheetTab,
  resolvePaintingImportSheetTab,
  resolveSkuImportSheetTab,
  resolveListsSheetTab,
  resolveIncrementalLabourProductsSheetTab,
  resolveSupplierDiscountsSheetTab,
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

function tabPayloadFromCounts(
  counts: {
    tabTitle: string;
    gid: number;
    gridRowCount: number | null;
    importProductCount: number;
    importSupplierCount: number;
    importNonBlankRows: number;
  },
  requiredTabTitle: string,
): ImportTabPayload {
  return {
    tabTitle: counts.tabTitle,
    requiredTabTitle,
    gid: counts.gid,
    gridRowCount: counts.gridRowCount,
    importProductCount: counts.importProductCount,
    importSupplierCount: counts.importSupplierCount,
    importNonBlankRows: counts.importNonBlankRows,
    url: masterPricesSpreadsheetEditUrl(counts.gid),
  };
}

function tabPayloadFromResolve(
  tab: {
    tabTitle: string;
    gid: number;
    gridRowCount: number | null;
  },
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

async function skuImportTabPayload(
  resolveTab: (spreadsheetId: string) => Promise<ResolvedSheetTab>,
  requiredTabTitle: string,
  parseOptions?: Parameters<typeof fetchSkuTabImportCounts>[2],
  columnRange?: Parameters<typeof fetchSkuTabImportCounts>[3],
): Promise<ImportTabPayload> {
  const counts = await fetchSkuTabImportCounts(
    resolveTab,
    MASTER_PRICES_SPREADSHEET_ID,
    parseOptions,
    columnRange,
  );
  return tabPayloadFromCounts(counts, requiredTabTitle);
}

/** GET — resolve import tabs (SKU counts + supporting-data tab links). */
export async function GET() {
  try {
    const skuAll = await skuImportTabPayload(
      resolveSkuImportSheetTab,
      MASTER_PRICES_SKU_TAB_TITLE,
      SKU_ALL_PARSE_OPTIONS,
    );

    const [buildingSettled, labourSettled, paintingSettled] = await Promise.allSettled([
      skuImportTabPayload(
        resolveBuildingImportSheetTab,
        MASTER_PRICES_BUILDING_TAB_TITLE,
        PARTIAL_SKU_TAB_PARSE_OPTIONS,
      ),
      (async () => {
        const tab = await resolveLabourImportSheetTab(MASTER_PRICES_SPREADSHEET_ID);
        return tabPayloadFromResolve(tab, MASTER_PRICES_LABOUR_TAB_TITLE);
      })(),
      skuImportTabPayload(
        resolvePaintingImportSheetTab,
        MASTER_PRICES_PAINTING_TAB_TITLE,
        PARTIAL_SKU_TAB_PARSE_OPTIONS,
      ),
    ]);
    let building: ImportTabPayload | null = null;
    let buildingError: string | null = null;
    if (buildingSettled.status === "fulfilled") {
      building = buildingSettled.value;
    } else {
      buildingError =
        buildingSettled.reason instanceof Error
          ? buildingSettled.reason.message
          : "Failed to resolve building tab";
    }

    let labour: ImportTabPayload | null = null;
    let labourError: string | null = null;
    if (labourSettled.status === "fulfilled") {
      labour = labourSettled.value;
    } else {
      labourError =
        labourSettled.reason instanceof Error
          ? labourSettled.reason.message
          : "Failed to resolve labour tab";
    }

    let painting: ImportTabPayload | null = null;
    let paintingError: string | null = null;
    if (paintingSettled.status === "fulfilled") {
      painting = paintingSettled.value;
    } else {
      paintingError =
        paintingSettled.reason instanceof Error
          ? paintingSettled.reason.message
          : "Failed to resolve painting tab";
    }

    let cascades: ImportTabPayload | null = null;
    let cascadesError: string | null = null;
    try {
      const cascadesTab = await resolveCascadingRestrictionsSheetTab(MASTER_PRICES_SPREADSHEET_ID);
      cascades = tabPayloadFromResolve(cascadesTab, MASTER_PRICES_CASCADES_TAB_TITLE);
    } catch (e) {
      cascadesError = e instanceof Error ? e.message : "Failed to resolve cascades tab";
    }

    let supplierDiscounts: ImportTabPayload | null = null;
    let supplierDiscountsError: string | null = null;
    try {
      const supplierDiscountsTab = await resolveSupplierDiscountsSheetTab(
        MASTER_PRICES_SPREADSHEET_ID,
      );
      supplierDiscounts = tabPayloadFromResolve(
        supplierDiscountsTab,
        MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
      );
    } catch (e) {
      supplierDiscountsError =
        e instanceof Error ? e.message : "Failed to resolve supplier discounts tab";
    }

    let lists: ImportTabPayload | null = null;
    let listsError: string | null = null;
    try {
      const listsTab = await resolveListsSheetTab(MASTER_PRICES_SPREADSHEET_ID);
      lists = tabPayloadFromResolve(listsTab, MASTER_PRICES_LISTS_TAB_TITLE);
    } catch (e) {
      listsError = e instanceof Error ? e.message : "Failed to resolve lists tab";
    }

    let incrementalLabourProducts: ImportTabPayload | null = null;
    let incrementalLabourProductsError: string | null = null;
    try {
      const incrementalTab = await resolveIncrementalLabourProductsSheetTab(
        MASTER_PRICES_SPREADSHEET_ID,
      );
      incrementalLabourProducts = tabPayloadFromResolve(
        incrementalTab,
        MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
      );
    } catch (e) {
      incrementalLabourProductsError =
        e instanceof Error ? e.message : "Failed to resolve incremental labour products tab";
    }

    let buildingElements: ImportTabPayload | null = null;
    let buildingElementsError: string | null = null;
    try {
      const buildingElementsTab = await resolveBuildingElementsSheetTab(
        MASTER_PRICES_SPREADSHEET_ID,
      );
      buildingElements = tabPayloadFromResolve(
        buildingElementsTab,
        MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE,
      );
    } catch (e) {
      buildingElementsError =
        e instanceof Error ? e.message : "Failed to resolve building elements tab";
    }

    let paintingElements: ImportTabPayload | null = null;
    let paintingElementsError: string | null = null;
    try {
      const paintingElementsTab = await resolvePaintingElementsSheetTab(
        MASTER_PRICES_SPREADSHEET_ID,
      );
      paintingElements = tabPayloadFromResolve(
        paintingElementsTab,
        MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE,
      );
    } catch (e) {
      paintingElementsError =
        e instanceof Error ? e.message : "Failed to resolve painting elements tab";
    }

    return NextResponse.json({
      skuAll,
      building,
      buildingError,
      labour,
      labourError,
      painting,
      paintingError,
      cascades,
      cascadesError,
      supplierDiscounts,
      supplierDiscountsError,
      lists,
      listsError,
      incrementalLabourProducts,
      incrementalLabourProductsError,
      buildingElements,
      buildingElementsError,
      paintingElements,
      paintingElementsError,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to resolve import tab";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
