"use client";

import {
  MASTER_PRICES_BUILDING_TAB_TITLE,
  MASTER_PRICES_CASCADES_TAB_TITLE,
  MASTER_PRICES_LABOUR_TAB_TITLE,
  MASTER_PRICES_LISTS_TAB_TITLE,
  MASTER_PRICES_SKU_TAB_TITLE,
  MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
  MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
} from "@/lib/google/master-prices-spreadsheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CascadesTablePanel } from "@/components/cascades-table-panel";
import { clearLookupsCache } from "@/lib/client/use-lookups";
import { consumeNdjsonStream } from "@/lib/client/consume-ndjson-stream";
import { readApiJson } from "@/lib/client/read-api-json";
import {
  sfDataSurface,
  sfNeutralToolbarButton,
  sfPrimaryToolbarButton,
  sfSectionLead,
} from "@/lib/sf-layout";
import type {
  DataSkusImportSource,
  ImportDataSkusProgress,
} from "@/lib/server/import-data-skus";
import { importLogFromProgress } from "@/lib/client/import-log-from-progress";
import { DataObjectsTablePanel } from "@/components/data-objects-table-panel";
import { DataSkusTablePanel } from "@/components/data-skus-table-panel";
import { DataBlindsTablePanel } from "@/components/data-blinds-table-panel";
import {
  BLINDS_PRICES_SPREADSHEET_ID,
  blindsPricesSpreadsheetEditUrl,
} from "@/lib/google/blinds-prices-spreadsheet";
import { PriceBookTestingPanel } from "@/components/price-book-testing-panel";
import { ImportLogAuditPanel } from "@/components/import-log-audit-panel";
import { ImportSummaryBanner } from "@/components/import-summary-banner";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { SKU_DATA_START_ROW_1_BASED, SKU_HEADER_ROW_1_BASED } from "@/lib/google/parse-master-prices-skus";
import type { ImportLogPublic } from "@/types/import-log-types";
import { useCallback, useEffect, useRef, useState } from "react";

type SheetTab = {
  index: number;
  title: string;
  sheetId: number | null;
  gid: number | null;
  rowCount: number | null;
  columnCount: number | null;
  hidden: boolean;
  editUrl: string | null;
  matchesRequestedGid: boolean;
};

type TestSheetSuccess = {
  ok: true;
  spreadsheet: {
    id: string;
    title: string | null;
    locale: string | null;
    timeZone: string | null;
    url: string;
  };
  requestedGid: number;
  matchedTab: SheetTab | null;
  sheets: SheetTab[];
  debug: Record<string, unknown>;
  hint?: string;
};

type TestSheetFailure = {
  ok: false;
  error: string;
  spreadsheet?: { id: string; url: string };
  requestedGid?: number;
  debug: Record<string, unknown>;
  hint?: string;
};

type TestSheetResponse = TestSheetSuccess | TestSheetFailure;

type ImportTabInfo = {
  tabTitle: string;
  gid: number;
  url: string;
  gridRowCount: number | null;
};

const DATA_SKUS_IMPORT_ENDPOINTS: Record<DataSkusImportSource, string> = {
  sku_all: "/api/import-master-prices/import-data-skus",
  building: "/api/import-master-prices/import-data-skus-building",
  labour: "/api/import-master-prices/import-data-skus-labour",
};

function phaseLabel(phase: ImportDataSkusProgress["phase"]): string {
  switch (phase) {
    case "resolving_tab":
      return "Resolve tab";
    case "fetching_sheet":
      return "Fetch sheet";
    case "parsed":
      return "Parsed";
    case "deleting":
      return "Clear collection";
    case "writing":
      return "Write Firestore";
    case "done":
      return "Done";
    case "error":
      return "Error";
    default:
      return phase;
  }
}

type PageTab =
  | "import"
  | "data"
  | "data-objects"
  | "cascades"
  | "blinds"
  | "price-book-testing";

export function ImportMasterPricesPanel() {
  const [pageTab, setPageTab] = useState<PageTab>("import");
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [dataObjectsRefreshKey, setDataObjectsRefreshKey] = useState(0);
  const [cascadesRefreshKey, setCascadesRefreshKey] = useState(0);
  const [blindsRefreshKey, setBlindsRefreshKey] = useState(0);
  const [testingBlinds, setTestingBlinds] = useState(false);
  const [testBlindsResult, setTestBlindsResult] = useState<{
    tabsScanned: number;
    matrixTabs: {
      typeName: string;
      priceRows: number;
      footers: number;
      widthMinMm: number | null;
      widthMaxMm: number | null;
    }[];
    skippedTabs: { tabTitle: string; reason: string }[];
  } | null>(null);
  const [testBlindsError, setTestBlindsError] = useState<string | null>(null);
  const [importingBlinds, setImportingBlinds] = useState(false);
  const [importBlindsResult, setImportBlindsResult] = useState<{
    tabsScanned: number;
    matrixTabsImported: number;
    writtenTypes: number;
    writtenPrices: number;
    writtenFooters: number;
    skippedTabs: { tabTitle: string; reason: string }[];
    tabSummaries: { typeName: string; priceRows: number; footers: number }[];
  } | null>(null);
  const [importBlindsError, setImportBlindsError] = useState<string | null>(null);
  const [syncingBlindsQuoteObjects, setSyncingBlindsQuoteObjects] = useState(false);
  const [syncBlindsQuoteObjectsResult, setSyncBlindsQuoteObjectsResult] = useState<{
    typesProcessed: number;
    created: number;
    updated: number;
    duplicatesRemoved: number;
    orphansRemoved: number;
  } | null>(null);
  const [syncBlindsQuoteObjectsError, setSyncBlindsQuoteObjectsError] = useState<string | null>(
    null,
  );
  const [preparingObjects, setPreparingObjects] = useState(false);
  const [prepareResult, setPrepareResult] = useState<{
    distinctFromSkus: number;
    created: number;
    skippedExisting: number;
    skippedIncomplete: number;
  } | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [clearingObjects, setClearingObjects] = useState(false);
  const [clearObjectsConfirmOpen, setClearObjectsConfirmOpen] = useState(false);
  const [clearObjectsResult, setClearObjectsResult] = useState<{ deleted: number } | null>(null);
  const [clearObjectsError, setClearObjectsError] = useState<string | null>(null);
  const [importingLists, setImportingLists] = useState(false);
  const [importListsResult, setImportListsResult] = useState<{
    tabTitle: string;
    styles: { range: string; parsed: number; created: number; updated: number };
    colours: { range: string; parsed: number; created: number; updated: number };
    uom: { range: string; parsed: number; created: number; updated: number };
  } | null>(null);
  const [importListsError, setImportListsError] = useState<string | null>(null);
  const [importingLabourRates, setImportingLabourRates] = useState(false);
  const [importLabourRatesResult, setImportLabourRatesResult] = useState<{
    tabTitle: string;
    range: string;
    headerRow1Based: number;
    dataStartRow1Based: number;
    parsed: number;
    written: number;
    deletedPrior: number;
    parseErrors: string[];
  } | null>(null);
  const [importLabourRatesError, setImportLabourRatesError] = useState<string | null>(null);
  const [importingCascades, setImportingCascades] = useState(false);
  const [importCascadesResult, setImportCascadesResult] = useState<{
    tabTitle: string;
    range: string;
    headerRow1Based: number;
    parsed: number;
    written: number;
    deletedPrior: number;
  } | null>(null);
  const [importCascadesError, setImportCascadesError] = useState<string | null>(null);
  const [importingSupplierDiscounts, setImportingSupplierDiscounts] = useState(false);
  const [importSupplierDiscountsResult, setImportSupplierDiscountsResult] = useState<{
    tabTitle: string;
    range: string;
    headerRow1Based: number;
    dataStartRow1Based: number;
    parsedSuppliers: number;
    writtenSuppliers: number;
    deletedSuppliersPrior: number;
    parsedRanges: number;
    writtenRanges: number;
    deletedRangesPrior: number;
    parseErrors: string[];
  } | null>(null);
  const [importSupplierDiscountsError, setImportSupplierDiscountsError] = useState<string | null>(
    null,
  );
  const [importingObjectLabourRates, setImportingObjectLabourRates] = useState(false);
  const [importObjectLabourRatesResult, setImportObjectLabourRatesResult] = useState<{
    tabTitle: string;
    range: string;
    headerRow1Based: number;
    dataStartRow1Based: number;
    parsed: number;
    created: number;
    updated: number;
    parseErrors: string[];
  } | null>(null);
  const [importObjectLabourRatesError, setImportObjectLabourRatesError] = useState<string | null>(
    null,
  );
  const [incrementalLabourProductsTabInfo, setIncrementalLabourProductsTabInfo] =
    useState<ImportTabInfo | null>(null);
  const [incrementalLabourProductsTabError, setIncrementalLabourProductsTabError] = useState<
    string | null
  >(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestSheetResponse | null>(null);
  const [testHttpStatus, setTestHttpStatus] = useState<number | null>(null);
  const [testFetchError, setTestFetchError] = useState<string | null>(null);

  const [activeImportSource, setActiveImportSource] = useState<DataSkusImportSource | null>(
    null,
  );
  /** After full SKU import: delete data_skus left with isCurrent=false (not on sheet). */
  const [removeProductsNotInSheet, setRemoveProductsNotInSheet] = useState(false);
  const importing = activeImportSource != null;
  const [importProgress, setImportProgress] = useState<ImportDataSkusProgress | null>(null);
  const [importLog, setImportLog] = useState<ImportDataSkusProgress[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [savedImportLog, setSavedImportLog] = useState<ImportLogPublic | null>(null);
  const [recentLogs, setRecentLogs] = useState<ImportLogPublic[]>([]);
  const [importTabInfo, setImportTabInfo] = useState<ImportTabInfo | null>(null);
  const [buildingTabInfo, setBuildingTabInfo] = useState<ImportTabInfo | null>(null);
  const [buildingTabError, setBuildingTabError] = useState<string | null>(null);
  const [labourTabInfo, setLabourTabInfo] = useState<ImportTabInfo | null>(null);
  const [labourTabError, setLabourTabError] = useState<string | null>(null);
  const [cascadesTabInfo, setCascadesTabInfo] = useState<ImportTabInfo | null>(null);
  const [cascadesTabError, setCascadesTabError] = useState<string | null>(null);
  const [supplierDiscountsTabInfo, setSupplierDiscountsTabInfo] = useState<ImportTabInfo | null>(
    null,
  );
  const [supplierDiscountsTabError, setSupplierDiscountsTabError] = useState<string | null>(null);
  const [importTabError, setImportTabError] = useState<string | null>(null);
  const importAnchorRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const loadImportTab = useCallback(async () => {
    try {
      const res = await fetch("/api/import-master-prices/import-tab");
      const data = await readApiJson<{
        skuAll?: ImportTabInfo;
        building?: ImportTabInfo | null;
        buildingError?: string | null;
        labour?: ImportTabInfo | null;
        labourError?: string | null;
        cascades?: ImportTabInfo | null;
        cascadesError?: string | null;
        supplierDiscounts?: ImportTabInfo | null;
        supplierDiscountsError?: string | null;
        incrementalLabourProducts?: ImportTabInfo | null;
        incrementalLabourProductsError?: string | null;
        error?: string;
      }>(res);
      if (!res.ok || data.error || !data.skuAll) {
        setImportTabError(data.error ?? `Import tab not found (${res.status})`);
        setImportTabInfo(null);
        setBuildingTabInfo(null);
        setBuildingTabError(null);
        setLabourTabInfo(null);
        setLabourTabError(null);
        setCascadesTabInfo(null);
        setCascadesTabError(null);
        setSupplierDiscountsTabInfo(null);
        setSupplierDiscountsTabError(null);
        setIncrementalLabourProductsTabInfo(null);
        setIncrementalLabourProductsTabError(null);
        return;
      }
      setImportTabError(null);
      setImportTabInfo(data.skuAll);
      setBuildingTabInfo(data.building ?? null);
      setBuildingTabError(data.buildingError ?? null);
      setLabourTabInfo(data.labour ?? null);
      setLabourTabError(data.labourError ?? null);
      setCascadesTabInfo(data.cascades ?? null);
      setCascadesTabError(data.cascadesError ?? null);
      setSupplierDiscountsTabInfo(data.supplierDiscounts ?? null);
      setSupplierDiscountsTabError(data.supplierDiscountsError ?? null);
      setIncrementalLabourProductsTabInfo(data.incrementalLabourProducts ?? null);
      setIncrementalLabourProductsTabError(data.incrementalLabourProductsError ?? null);
    } catch (e) {
      setImportTabError(e instanceof Error ? e.message : String(e));
      setImportTabInfo(null);
      setBuildingTabInfo(null);
      setBuildingTabError(null);
      setLabourTabInfo(null);
      setLabourTabError(null);
      setCascadesTabInfo(null);
      setCascadesTabError(null);
      setSupplierDiscountsTabInfo(null);
      setSupplierDiscountsTabError(null);
      setIncrementalLabourProductsTabInfo(null);
      setIncrementalLabourProductsTabError(null);
    }
  }, []);

  const loadImportLogs = useCallback(async (importRunId?: string) => {
    try {
      if (importRunId) {
        const res = await fetch(
          `/api/import-master-prices/import-log?importRunId=${encodeURIComponent(importRunId)}`,
        );
        const data = await readApiJson<{ log: ImportLogPublic | null }>(res);
        if (data.log) {
          setSavedImportLog(data.log);
          return data.log;
        }
      }
      const listRes = await fetch("/api/import-master-prices/import-log?limit=10");
      const listData = await readApiJson<{ logs: ImportLogPublic[] }>(listRes);
      setRecentLogs(listData.logs ?? []);
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void loadImportLogs();
    void loadImportTab();
  }, [loadImportLogs, loadImportTab]);

  const runTest = useCallback(async () => {
    setTestLoading(true);
    setTestFetchError(null);
    setTestResult(null);
    setTestHttpStatus(null);
    try {
      const res = await fetch("/api/import-master-prices/test-sheet");
      setTestHttpStatus(res.status);
      const data = await readApiJson<TestSheetResponse>(res);
      setTestResult(data);
    } catch (e) {
      setTestFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestLoading(false);
    }
  }, []);

  const scrollToImportTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    importAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const appendLog = useCallback((event: ImportDataSkusProgress) => {
    setImportLog((prev) => [...prev.slice(-80), event]);
    requestAnimationFrame(() => {
      const el = logContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const runImportLists = useCallback(async () => {
    setImportingLists(true);
    setImportListsError(null);
    setImportListsResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-lists", { method: "POST" });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        tabTitle?: string;
        styles?: {
          range?: string;
          parsed?: number;
          created?: number;
          updated?: number;
        };
        colours?: {
          range?: string;
          parsed?: number;
          created?: number;
          updated?: number;
        };
        uom?: {
          range?: string;
          parsed?: number;
          created?: number;
          updated?: number;
        };
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import lists failed");
      setImportListsResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_LISTS_TAB_TITLE,
        styles: {
          range: data.styles?.range ?? "F4:H16",
          parsed: data.styles?.parsed ?? 0,
          created: data.styles?.created ?? 0,
          updated: data.styles?.updated ?? 0,
        },
        colours: {
          range: data.colours?.range ?? "J4:M16",
          parsed: data.colours?.parsed ?? 0,
          created: data.colours?.created ?? 0,
          updated: data.colours?.updated ?? 0,
        },
        uom: {
          range: data.uom?.range ?? "O4:Q16",
          parsed: data.uom?.parsed ?? 0,
          created: data.uom?.created ?? 0,
          updated: data.uom?.updated ?? 0,
        },
      });
      clearLookupsCache();
    } catch (e) {
      setImportListsError(e instanceof Error ? e.message : "Import lists failed");
    } finally {
      setImportingLists(false);
    }
  }, []);

  const runImportLabourRates = useCallback(async () => {
    setImportingLabourRates(true);
    setImportLabourRatesError(null);
    setImportLabourRatesResult(null);
    setImportObjectLabourRatesError(null);
    setImportObjectLabourRatesResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-labour-rates", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        tabTitle?: string;
        range?: string;
        headerRow1Based?: number;
        dataStartRow1Based?: number;
        parsed?: number;
        written?: number;
        deletedPrior?: number;
        parseErrors?: string[];
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import labour rates failed");
      setImportLabourRatesResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_LABOUR_TAB_TITLE,
        range: data.range ?? "A1:E",
        headerRow1Based: data.headerRow1Based ?? 5,
        dataStartRow1Based: data.dataStartRow1Based ?? 6,
        parsed: data.parsed ?? 0,
        written: data.written ?? 0,
        deletedPrior: data.deletedPrior ?? 0,
        parseErrors: data.parseErrors ?? [],
      });
    } catch (e) {
      setImportLabourRatesError(
        e instanceof Error ? e.message : "Import labour rates failed",
      );
    } finally {
      setImportingLabourRates(false);
    }
  }, []);

  const runTestBlinds = useCallback(async () => {
    setTestingBlinds(true);
    setTestBlindsError(null);
    setTestBlindsResult(null);
    try {
      const res = await fetch("/api/import-master-prices/test-import-blinds");
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        tabsScanned?: number;
        matrixTabs?: {
          typeName: string;
          priceRows: number;
          footers: number;
          widthMinMm: number | null;
          widthMaxMm: number | null;
        }[];
        skippedTabs?: { tabTitle: string; gid?: number; reason: string }[];
      }>(res);
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Test blinds parse failed");
      setTestBlindsResult({
        tabsScanned: data.tabsScanned ?? 0,
        matrixTabs: (data.matrixTabs ?? []).map((t) => ({
          typeName: t.typeName,
          priceRows: t.priceRows,
          footers: t.footers,
          widthMinMm: t.widthMinMm,
          widthMaxMm: t.widthMaxMm,
        })),
        skippedTabs: (data.skippedTabs ?? []).map((s) => ({
          tabTitle: s.tabTitle,
          reason: s.reason,
        })),
      });
    } catch (e) {
      setTestBlindsError(e instanceof Error ? e.message : "Test blinds parse failed");
    } finally {
      setTestingBlinds(false);
    }
  }, []);

  const runImportBlinds = useCallback(async () => {
    setImportingBlinds(true);
    setImportBlindsError(null);
    setImportBlindsResult(null);
    setSyncBlindsQuoteObjectsResult(null);
    setSyncBlindsQuoteObjectsError(null);
    try {
      const res = await fetch("/api/import-master-prices/import-data-blinds", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        tabsScanned?: number;
        matrixTabsImported?: number;
        writtenTypes?: number;
        writtenPrices?: number;
        writtenFooters?: number;
        skippedTabs?: { tabTitle: string; reason: string }[];
        tabSummaries?: { typeName: string; priceRows: number; footers: number }[];
        quoteObjects?: {
          typesProcessed: number;
          created: number;
          updated: number;
          duplicatesRemoved: number;
          orphansRemoved: number;
        };
      }>(res);
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Import blinds failed");
      setImportBlindsResult({
        tabsScanned: data.tabsScanned ?? 0,
        matrixTabsImported: data.matrixTabsImported ?? 0,
        writtenTypes: data.writtenTypes ?? 0,
        writtenPrices: data.writtenPrices ?? 0,
        writtenFooters: data.writtenFooters ?? 0,
        skippedTabs: data.skippedTabs ?? [],
        tabSummaries: data.tabSummaries ?? [],
      });
      if (data.quoteObjects) setSyncBlindsQuoteObjectsResult(data.quoteObjects);
      setBlindsRefreshKey((k) => k + 1);
    } catch (e) {
      setImportBlindsError(e instanceof Error ? e.message : "Import blinds failed");
    } finally {
      setImportingBlinds(false);
    }
  }, []);

  const runCreateBlindsQuoteObjects = useCallback(async () => {
    setSyncingBlindsQuoteObjects(true);
    setSyncBlindsQuoteObjectsError(null);
    setSyncBlindsQuoteObjectsResult(null);
    try {
      const res = await fetch("/api/import-master-prices/create-blinds-quote-objects", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        typesProcessed?: number;
        created?: number;
        updated?: number;
        duplicatesRemoved?: number;
        orphansRemoved?: number;
      }>(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Create blinds quote objects failed");
      }
      setSyncBlindsQuoteObjectsResult({
        typesProcessed: data.typesProcessed ?? 0,
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        duplicatesRemoved: data.duplicatesRemoved ?? 0,
        orphansRemoved: data.orphansRemoved ?? 0,
      });
    } catch (e) {
      setSyncBlindsQuoteObjectsError(
        e instanceof Error ? e.message : "Create blinds quote objects failed",
      );
    } finally {
      setSyncingBlindsQuoteObjects(false);
    }
  }, []);

  const runImportSupplierDiscounts = useCallback(async () => {
    setImportingSupplierDiscounts(true);
    setImportSupplierDiscountsError(null);
    setImportSupplierDiscountsResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-supplier-discounts", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        tabTitle?: string;
        range?: string;
        headerRow1Based?: number;
        dataStartRow1Based?: number;
        parsedSuppliers?: number;
        writtenSuppliers?: number;
        deletedSuppliersPrior?: number;
        parsedRanges?: number;
        writtenRanges?: number;
        deletedRangesPrior?: number;
        parseErrors?: string[];
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import supplier discounts failed");
      setImportSupplierDiscountsResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
        range: data.range ?? "A1:G19",
        headerRow1Based: data.headerRow1Based ?? 2,
        dataStartRow1Based: data.dataStartRow1Based ?? 3,
        parsedSuppliers: data.parsedSuppliers ?? 0,
        writtenSuppliers: data.writtenSuppliers ?? 0,
        deletedSuppliersPrior: data.deletedSuppliersPrior ?? 0,
        parsedRanges: data.parsedRanges ?? 0,
        writtenRanges: data.writtenRanges ?? 0,
        deletedRangesPrior: data.deletedRangesPrior ?? 0,
        parseErrors: data.parseErrors ?? [],
      });
    } catch (e) {
      setImportSupplierDiscountsError(
        e instanceof Error ? e.message : "Import supplier discounts failed",
      );
    } finally {
      setImportingSupplierDiscounts(false);
    }
  }, []);

  const runImportObjectLabourRates = useCallback(async () => {
    setImportingObjectLabourRates(true);
    setImportObjectLabourRatesError(null);
    setImportObjectLabourRatesResult(null);
    setImportLabourRatesError(null);
    setImportLabourRatesResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-object-labour-rates", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        tabTitle?: string;
        range?: string;
        headerRow1Based?: number;
        dataStartRow1Based?: number;
        parsed?: number;
        created?: number;
        updated?: number;
        parseErrors?: string[];
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import incremental labour products failed");
      setImportObjectLabourRatesResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
        range: data.range ?? "A3:I150",
        headerRow1Based: data.headerRow1Based ?? 3,
        dataStartRow1Based: data.dataStartRow1Based ?? 4,
        parsed: data.parsed ?? 0,
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        parseErrors: data.parseErrors ?? [],
      });
    } catch (e) {
      setImportObjectLabourRatesError(
        e instanceof Error ? e.message : "Import incremental labour products failed",
      );
    } finally {
      setImportingObjectLabourRates(false);
    }
  }, []);

  const runImportCascades = useCallback(async () => {
    setImportingCascades(true);
    setImportCascadesError(null);
    setImportCascadesResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-cascades", { method: "POST" });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        tabTitle?: string;
        range?: string;
        headerRow1Based?: number;
        parsed?: number;
        written?: number;
        deletedPrior?: number;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Import cascades failed");
      setImportCascadesResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_CASCADES_TAB_TITLE,
        range: data.range ?? "A1:C50",
        headerRow1Based: data.headerRow1Based ?? 0,
        parsed: data.parsed ?? 0,
        written: data.written ?? 0,
        deletedPrior: data.deletedPrior ?? 0,
      });
      setCascadesRefreshKey((k) => k + 1);
    } catch (e) {
      setImportCascadesError(e instanceof Error ? e.message : "Import cascades failed");
    } finally {
      setImportingCascades(false);
    }
  }, []);

  const runClearDataObjects = useCallback(async () => {
    setClearingObjects(true);
    setClearObjectsError(null);
    setClearObjectsResult(null);
    setClearObjectsConfirmOpen(false);
    try {
      const res = await fetch("/api/data-objects/clear", { method: "POST" });
      const data = await readApiJson<{ deleted?: number; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Clear data_objects failed");
      setClearObjectsResult({ deleted: data.deleted ?? 0 });
      setPrepareResult(null);
      setDataObjectsRefreshKey((k) => k + 1);
    } catch (e) {
      setClearObjectsError(e instanceof Error ? e.message : "Clear data_objects failed");
    } finally {
      setClearingObjects(false);
    }
  }, []);

  const runPrepareObjects = useCallback(async () => {
    setPreparingObjects(true);
    setPrepareError(null);
    setPrepareResult(null);
    try {
      const res = await fetch("/api/data-objects/prepare", { method: "POST" });
      const data = await readApiJson<{
        ok?: boolean;
        distinctFromSkus?: number;
        created?: number;
        skippedExisting?: number;
        skippedIncomplete?: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Prepare objects failed");
      setPrepareResult({
        distinctFromSkus: data.distinctFromSkus ?? 0,
        created: data.created ?? 0,
        skippedExisting: data.skippedExisting ?? 0,
        skippedIncomplete: data.skippedIncomplete ?? 0,
      });
      setDataObjectsRefreshKey((k) => k + 1);
      setPageTab("data-objects");
    } catch (e) {
      setPrepareError(e instanceof Error ? e.message : "Prepare objects failed");
    } finally {
      setPreparingObjects(false);
    }
  }, []);

  const runImport = useCallback(async (source: DataSkusImportSource) => {
    setPageTab("import");
    setActiveImportSource(source);
    setImportError(null);
    setImportProgress(null);
    setImportLog([]);
    scrollToImportTop();
    const endpoint = DATA_SKUS_IMPORT_ENDPOINTS[source];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removeProductsNotInSheet:
            removeProductsNotInSheet && source === "sku_all",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          text.trim()
            ? `Import failed (${res.status}): ${text.slice(0, 300)}`
            : `Import failed (${res.status} ${res.statusText})`,
        );
      }
      const streamEvents: ImportDataSkusProgress[] = [];
      await consumeNdjsonStream<ImportDataSkusProgress>(res, (event) => {
        streamEvents.push(event);
        setImportProgress(event);
        appendLog(event);
        if (event.phase === "error") {
          setImportError(event.error ?? event.message);
        }
      });
      const finalEvent = streamEvents[streamEvents.length - 1] ?? null;
      const fallback = finalEvent ? importLogFromProgress(finalEvent) : null;
      if (fallback) setSavedImportLog(fallback);
      const runId = finalEvent?.importRunId;
      if (runId) {
        const fromDb = await loadImportLogs(runId);
        if (!fromDb && fallback) setSavedImportLog(fallback);
      }
      setDataRefreshKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setImportError(msg);
      appendLog({ phase: "error", message: msg, percent: 0, error: msg });
    } finally {
      setActiveImportSource(null);
    }
  }, [appendLog, loadImportLogs, removeProductsNotInSheet, scrollToImportTop]);

  const testSuccess = testResult?.ok === true ? testResult : null;
  const testFailure = testResult?.ok === false ? testResult : null;
  const importDone = importProgress?.phase === "done";
  const importFailed = importProgress?.phase === "error" || Boolean(importError);

  const displayLog =
    savedImportLog ??
    (importProgress ? importLogFromProgress(importProgress) : null);

  const summaryStatus = displayLog?.status
    ? displayLog.status
    : importing
      ? "running"
      : importFailed
        ? "failed"
        : importDone
          ? "success"
          : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-sf-text dark:text-zinc-50">
          Import Master Prices
        </h1>
        <p className={sfSectionLead}>
          Import from <strong>{MASTER_PRICES_SKU_TAB_TITLE}</strong> or{" "}
          <strong>{MASTER_PRICES_BUILDING_TAB_TITLE}</strong> into{" "}
          <code className="text-xs">data_skus</code>, or browse imported data with filters.
        </p>
      </header>

      <div className={sfTabStripClass} role="tablist" aria-label="Import master prices">
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "import"}
          className={sfUnderlineTabClass(pageTab === "import")}
          onClick={() => setPageTab("import")}
        >
          Import
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "data"}
          className={sfUnderlineTabClass(pageTab === "data")}
          onClick={() => setPageTab("data")}
        >
          Data
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "data-objects"}
          className={sfUnderlineTabClass(pageTab === "data-objects")}
          onClick={() => setPageTab("data-objects")}
        >
          Data Objects
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "cascades"}
          className={sfUnderlineTabClass(pageTab === "cascades")}
          onClick={() => setPageTab("cascades")}
        >
          Cascades
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "blinds"}
          className={sfUnderlineTabClass(pageTab === "blinds")}
          onClick={() => setPageTab("blinds")}
        >
          Blinds
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "price-book-testing"}
          className={sfUnderlineTabClass(pageTab === "price-book-testing")}
          onClick={() => setPageTab("price-book-testing")}
        >
          Price Book Testing
        </button>
      </div>

      {pageTab === "data" ? (
        <DataSkusTablePanel refreshKey={dataRefreshKey} />
      ) : null}

      {pageTab === "data-objects" ? (
        <DataObjectsTablePanel
          refreshKey={dataObjectsRefreshKey}
          onRequestEmpty={() => setClearObjectsConfirmOpen(true)}
          emptying={clearingObjects}
        />
      ) : null}

      {pageTab === "cascades" ? (
        <CascadesTablePanel refreshKey={cascadesRefreshKey} />
      ) : null}

      {pageTab === "blinds" ? (
        <DataBlindsTablePanel refreshKey={blindsRefreshKey} />
      ) : null}

      <div role="tabpanel" hidden={pageTab !== "price-book-testing"}>
        <PriceBookTestingPanel isActive={pageTab === "price-book-testing"} />
      </div>

      {pageTab === "import" ? (
        <>
      <div ref={importAnchorRef} className="scroll-mt-4" />
      <section className={`${sfDataSurface} flex flex-col gap-4 p-4 md:p-5`}>
        <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
          Import to data_skus + data_sku_suppliers
        </h2>
        {importTabError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importTabError}</p>
        ) : null}
        {importTabInfo ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            <strong>{MASTER_PRICES_SKU_TAB_TITLE}</strong>: {importTabInfo.tabTitle}
            {importTabInfo.gridRowCount != null ? (
              <span> · ~{importTabInfo.gridRowCount} grid rows</span>
            ) : null}
          </p>
        ) : null}
        {buildingTabError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{buildingTabError}</p>
        ) : buildingTabInfo ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            <strong>{MASTER_PRICES_BUILDING_TAB_TITLE}</strong>: {buildingTabInfo.tabTitle}
            {buildingTabInfo.gridRowCount != null ? (
              <span> · ~{buildingTabInfo.gridRowCount} grid rows</span>
            ) : null}
            <span className="block text-xs text-sf-text-weak dark:text-zinc-500">
              Building import upserts matching keys only; it does not mark the full catalog
              not-current.
            </span>
          </p>
        ) : null}
        {labourTabError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{labourTabError}</p>
        ) : labourTabInfo ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            <strong>{MASTER_PRICES_LABOUR_TAB_TITLE}</strong>: {labourTabInfo.tabTitle}
            {labourTabInfo.gridRowCount != null ? (
              <span> · ~{labourTabInfo.gridRowCount} grid rows</span>
            ) : null}
            <span className="block text-xs text-sf-text-weak dark:text-zinc-500">
              <strong>Import Labour SKUs</strong> upserts full SKU rows into{" "}
              <code className="text-xs">data_skus</code>.{" "}
              <strong>Import $ Labour Rates</strong> replaces{" "}
              <code className="text-xs">data_labourrates</code> (columns A–E, row 5 headers).
              Not the same as the <strong>Incremental Labour - Products</strong> tab below.
            </span>
          </p>
        ) : null}
        {cascadesTabError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{cascadesTabError}</p>
        ) : cascadesTabInfo ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            <strong>{MASTER_PRICES_CASCADES_TAB_TITLE}</strong>: {cascadesTabInfo.tabTitle}
            {cascadesTabInfo.gridRowCount != null ? (
              <span> · ~{cascadesTabInfo.gridRowCount} grid rows</span>
            ) : null}
            <span className="block text-xs text-sf-text-weak dark:text-zinc-500">
              Replaces the full <code className="text-xs">cascades</code> collection (Level, Style,
              Colour from A1:C50).
            </span>
          </p>
        ) : null}
        {supplierDiscountsTabError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{supplierDiscountsTabError}</p>
        ) : supplierDiscountsTabInfo ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            <strong>{MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE}</strong>:{" "}
            {supplierDiscountsTabInfo.tabTitle}
            {supplierDiscountsTabInfo.gridRowCount != null ? (
              <span> · ~{supplierDiscountsTabInfo.gridRowCount} grid rows</span>
            ) : null}
            <span className="block text-xs text-sf-text-weak dark:text-zinc-500">
              Replaces <code className="text-xs">data_supplier_discount_ranges</code> (4 rows) and{" "}
              <code className="text-xs">data_supplier_discounts</code> (row 2 headers, data row 3+).
            </span>
          </p>
        ) : null}
        {incrementalLabourProductsTabError ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <strong>Incremental Labour - Products</strong> tab not found:{" "}
            {incrementalLabourProductsTabError}
          </div>
        ) : null}
        <section className="flex flex-col gap-3 rounded-lg border-2 border-sf-brand/30 bg-sf-page px-4 py-4 dark:border-[#58a9f5]/30 dark:bg-zinc-900/60">
          <h3 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
            Incremental Labour - Products →{" "}
            <code className="text-xs font-normal">data_objectlabourrates</code>
          </h3>
          {incrementalLabourProductsTabInfo ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              Tab <strong>{incrementalLabourProductsTabInfo.tabTitle}</strong>
              {incrementalLabourProductsTabInfo.gridRowCount != null ? (
                <span> · ~{incrementalLabourProductsTabInfo.gridRowCount} grid rows</span>
              ) : null}
              <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-500">
                A3:I150 · header row 3 · data row 4+. Upsert by Category + Product Type + Product
                (blank Product uses Product Type). Does not touch{" "}
                <code className="text-xs">data_labourrates</code> or{" "}
                <code className="text-xs">data_skus</code>.
              </span>
            </p>
          ) : (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              Resolve the worksheet <strong>Incremental Labour - Products</strong> to enable import.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {incrementalLabourProductsTabInfo?.url ? (
              <a
                href={incrementalLabourProductsTabInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
              >
                Open Incremental Labour - Products
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void runImportObjectLabourRates()}
              disabled={
                importing ||
                testLoading ||
                preparingObjects ||
                importingLists ||
                importingCascades ||
                importingLabourRates ||
                importingSupplierDiscounts ||
                importingObjectLabourRates ||
                !incrementalLabourProductsTabInfo
              }
              className={sfPrimaryToolbarButton}
            >
              {importingObjectLabourRates
                ? "Importing…"
                : "Import Incremental Labour → data_objectlabourrates"}
            </button>
          </div>
          {importObjectLabourRatesError ? (
            <p className="text-sm text-red-800 dark:text-red-300">{importObjectLabourRatesError}</p>
          ) : null}
          {importObjectLabourRatesResult ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
              Imported from <strong>{importObjectLabourRatesResult.tabTitle}</strong> (
              {importObjectLabourRatesResult.range}): {importObjectLabourRatesResult.parsed} row(s)
              → <code className="text-xs">data_objectlabourrates</code> —{" "}
              {importObjectLabourRatesResult.created} created,{" "}
              {importObjectLabourRatesResult.updated} updated.
              {importObjectLabourRatesResult.parseErrors.length > 0 ? (
                <span className="block text-xs text-amber-800 dark:text-amber-200">
                  Skipped: {importObjectLabourRatesResult.parseErrors.join(" ")}
                </span>
              ) : null}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 border-t border-sf-border pt-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
            Blinds retail price workbook
          </h2>
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            Scans all tabs in the blinds workbook; each tab with a Drop × width matrix becomes a
            type in <code className="text-xs">data_blinds_types</code>,{" "}
            <code className="text-xs">data_blinds</code>, and{" "}
            <code className="text-xs">data_blinds_footers</code>. Import also upserts one{" "}
            <code className="text-xs">quote_objects</code> per type (category Blinds,{" "}
            <code className="text-xs">systemObject</code> Blinds). Collections are cleared and
            replaced on import.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={blindsPricesSpreadsheetEditUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              Open blinds workbook
            </a>
            <button
              type="button"
              onClick={() => void runTestBlinds()}
              disabled={
                importing ||
                testLoading ||
                testingBlinds ||
                importingBlinds ||
                syncingBlindsQuoteObjects ||
                preparingObjects ||
                importingLists ||
                importingCascades ||
                importingLabourRates ||
                importingSupplierDiscounts ||
                importingObjectLabourRates
              }
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              {testingBlinds ? "Scanning tabs…" : "Test parse blinds workbook"}
            </button>
            <button
              type="button"
              onClick={() => void runImportBlinds()}
              disabled={
                importing ||
                testLoading ||
                testingBlinds ||
                importingBlinds ||
                syncingBlindsQuoteObjects ||
                preparingObjects ||
                importingLists ||
                importingCascades ||
                importingLabourRates ||
                importingSupplierDiscounts ||
                importingObjectLabourRates
              }
              className={sfPrimaryToolbarButton}
            >
              {importingBlinds ? "Importing…" : "Import blinds → Firestore"}
            </button>
            <button
              type="button"
              onClick={() => void runCreateBlindsQuoteObjects()}
              disabled={
                importing ||
                testLoading ||
                testingBlinds ||
                importingBlinds ||
                syncingBlindsQuoteObjects ||
                preparingObjects ||
                importingLists ||
                importingCascades ||
                importingLabourRates ||
                importingSupplierDiscounts ||
                importingObjectLabourRates
              }
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              {syncingBlindsQuoteObjects
                ? "Creating…"
                : "Create 1 object per type → quote_objects"}
            </button>
          </div>
          <p className="text-xs text-sf-text-weak dark:text-zinc-500">
            Spreadsheet ID: <code className="text-xs">{BLINDS_PRICES_SPREADSHEET_ID}</code>
          </p>
          {testBlindsError ? (
            <p className="text-sm text-red-800 dark:text-red-300">{testBlindsError}</p>
          ) : null}
          {testBlindsResult ? (
            <div className="space-y-1 text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
              <p>
                Test parse — {testBlindsResult.tabsScanned} tab(s) scanned,{" "}
                {testBlindsResult.matrixTabs.length} matrix tab(s).
              </p>
              <ul className="list-inside list-disc text-xs">
                {testBlindsResult.matrixTabs.map((t) => (
                  <li key={t.typeName}>
                    <strong>{t.typeName}</strong>: {t.priceRows} drop row(s), {t.footers} footer(s)
                    {t.widthMinMm != null && t.widthMaxMm != null
                      ? `, widths ${t.widthMinMm}–${t.widthMaxMm} mm`
                      : ""}
                  </li>
                ))}
              </ul>
              {testBlindsResult.skippedTabs.length > 0 ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Skipped:{" "}
                  {testBlindsResult.skippedTabs
                    .map((s) => `${s.tabTitle} (${s.reason})`)
                    .join("; ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {importBlindsError ? (
            <p className="text-sm text-red-800 dark:text-red-300">{importBlindsError}</p>
          ) : null}
          {importBlindsResult ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
              Import blinds — {importBlindsResult.matrixTabsImported} type(s),{" "}
              {importBlindsResult.writtenPrices} price row(s),{" "}
              {importBlindsResult.writtenFooters} footer(s). Browse on the{" "}
              <strong>Blinds</strong> tab.
              {syncBlindsQuoteObjectsResult ? (
                <span className="block">
                  Quote objects — {syncBlindsQuoteObjectsResult.typesProcessed} type(s):{" "}
                  {syncBlindsQuoteObjectsResult.created} created,{" "}
                  {syncBlindsQuoteObjectsResult.updated} updated
                  {syncBlindsQuoteObjectsResult.duplicatesRemoved > 0
                    ? `, ${syncBlindsQuoteObjectsResult.duplicatesRemoved} duplicate(s) removed`
                    : ""}
                  {syncBlindsQuoteObjectsResult.orphansRemoved > 0
                    ? `, ${syncBlindsQuoteObjectsResult.orphansRemoved} orphan(s) removed`
                    : ""}
                  .
                </span>
              ) : null}
              {importBlindsResult.skippedTabs.length > 0 ? (
                <span className="block text-xs text-amber-800 dark:text-amber-200">
                  Skipped tabs:{" "}
                  {importBlindsResult.skippedTabs.map((s) => s.tabTitle).join(", ")}
                </span>
              ) : null}
            </p>
          ) : null}
          {syncBlindsQuoteObjectsError ? (
            <p className="text-sm text-red-800 dark:text-red-300">{syncBlindsQuoteObjectsError}</p>
          ) : null}
          {syncBlindsQuoteObjectsResult && !importBlindsResult ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
              Quote objects — {syncBlindsQuoteObjectsResult.typesProcessed} blind type(s):{" "}
              {syncBlindsQuoteObjectsResult.created} created,{" "}
              {syncBlindsQuoteObjectsResult.updated} updated
              {syncBlindsQuoteObjectsResult.duplicatesRemoved > 0
                ? `, ${syncBlindsQuoteObjectsResult.duplicatesRemoved} duplicate(s) removed`
                : ""}
              {syncBlindsQuoteObjectsResult.orphansRemoved > 0
                ? `, ${syncBlindsQuoteObjectsResult.orphansRemoved} orphan(s) removed`
                : ""}
              .
            </p>
          ) : null}
        </section>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-sf-border bg-sf-page px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0"
            checked={removeProductsNotInSheet}
            disabled={importing}
            onChange={(e) => setRemoveProductsNotInSheet(e.target.checked)}
          />
          <span className="text-sf-text-secondary dark:text-zinc-300">
            <span className="font-medium text-sf-text dark:text-zinc-100">
              Remove products not on sheet
            </span>
            <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
              Applies to <strong>Import SKUs (upsert)</strong> only. After import, deletes{" "}
              <code className="text-xs">data_skus</code> (and their suppliers) that were not
              updated or appended — rows left with <code className="text-xs">isCurrent=false</code>{" "}
              because they were missing from the workbook.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          {importTabInfo?.url ? (
            <a
              href={importTabInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              Open {MASTER_PRICES_SKU_TAB_TITLE}
            </a>
          ) : null}
          {buildingTabInfo?.url ? (
            <a
              href={buildingTabInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              Open {MASTER_PRICES_BUILDING_TAB_TITLE}
            </a>
          ) : null}
          {labourTabInfo?.url ? (
            <a
              href={labourTabInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              Open {MASTER_PRICES_LABOUR_TAB_TITLE}
            </a>
          ) : null}
          {cascadesTabInfo?.url ? (
            <a
              href={cascadesTabInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              Open {MASTER_PRICES_CASCADES_TAB_TITLE}
            </a>
          ) : null}
          {supplierDiscountsTabInfo?.url ? (
            <a
              href={supplierDiscountsTabInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              Open {MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void runImport("sku_all")}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates
            }
            className={sfPrimaryToolbarButton}
          >
            {activeImportSource === "sku_all" ? "Importing…" : "Import SKUs (upsert)"}
          </button>
          <button
            type="button"
            onClick={() => void runImport("building")}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates ||
              !buildingTabInfo
            }
            className={sfPrimaryToolbarButton}
          >
            {activeImportSource === "building" ? "Importing…" : "Import Building"}
          </button>
          <button
            type="button"
            onClick={() => void runImport("labour")}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates ||
              !labourTabInfo
            }
            className={sfPrimaryToolbarButton}
          >
            {activeImportSource === "labour" ? "Importing…" : "Import Labour SKUs"}
          </button>
          <button
            type="button"
            onClick={() => void runImportLabourRates()}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates ||
              !labourTabInfo
            }
            className={sfPrimaryToolbarButton}
          >
            {importingLabourRates ? "Importing…" : "Import $ Labour Rates → data_labourrates"}
          </button>
          <button
            type="button"
            onClick={() => void runImportCascades()}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates ||
              !cascadesTabInfo
            }
            className={sfPrimaryToolbarButton}
          >
            {importingCascades ? "Importing…" : "Import Cascades"}
          </button>
          <button
            type="button"
            onClick={() => void runImportSupplierDiscounts()}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates ||
              !supplierDiscountsTabInfo
            }
            className={sfPrimaryToolbarButton}
          >
            {importingSupplierDiscounts
              ? "Importing…"
              : "Import Supplier Discounts"}
          </button>
          <button
            type="button"
            onClick={() => void runImportLists()}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates
            }
            className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
          >
            {importingLists ? "Importing lists…" : "Import Lists"}
          </button>
          <button
            type="button"
            onClick={() => setClearObjectsConfirmOpen(true)}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              clearingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates
            }
            className={`${sfNeutralToolbarButton} min-h-11 text-red-700 dark:text-red-400`}
          >
            {clearingObjects ? "Emptying…" : "Empty data_objects"}
          </button>
          <button
            type="button"
            onClick={() => void runPrepareObjects()}
            disabled={
              importing ||
              testLoading ||
              preparingObjects ||
              clearingObjects ||
              importingLists ||
              importingCascades ||
              importingLabourRates ||
              importingSupplierDiscounts ||
              importingObjectLabourRates
            }
            className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
          >
            {preparingObjects ? "Preparing…" : "Prepare Objects"}
          </button>
        </div>

        {importLabourRatesError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importLabourRatesError}</p>
        ) : null}
        {importLabourRatesResult ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
            Import labour rates — tab <strong>{importLabourRatesResult.tabTitle}</strong> (
            {importLabourRatesResult.range}, header row {importLabourRatesResult.headerRow1Based},
            data from row {importLabourRatesResult.dataStartRow1Based}):{" "}
            {importLabourRatesResult.parsed} row(s) written to{" "}
            <code className="text-xs">data_labourrates</code> (
            {importLabourRatesResult.deletedPrior} removed first).
            {importLabourRatesResult.parseErrors.length > 0 ? (
              <span className="block text-xs text-amber-800 dark:text-amber-200">
                Skipped with errors: {importLabourRatesResult.parseErrors.join(" ")}
              </span>
            ) : null}
          </p>
        ) : null}
        {importCascadesError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importCascadesError}</p>
        ) : null}
        {importCascadesResult ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
            Import cascades — tab <strong>{importCascadesResult.tabTitle}</strong> (
            {importCascadesResult.range}, header row {importCascadesResult.headerRow1Based}):{" "}
            {importCascadesResult.parsed} row(s) written to{" "}
            <code className="text-xs">cascades</code>
            {importCascadesResult.deletedPrior > 0
              ? ` (${importCascadesResult.deletedPrior} prior row(s) replaced)`
              : ""}
            .
          </p>
        ) : null}
        {importSupplierDiscountsError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importSupplierDiscountsError}</p>
        ) : null}
        {importSupplierDiscountsResult ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
            Import supplier discounts — tab{" "}
            <strong>{importSupplierDiscountsResult.tabTitle}</strong> (
            {importSupplierDiscountsResult.range}, header row{" "}
            {importSupplierDiscountsResult.headerRow1Based}, data from row{" "}
            {importSupplierDiscountsResult.dataStartRow1Based}):{" "}
            {importSupplierDiscountsResult.writtenRanges} range(s) →{" "}
            <code className="text-xs">data_supplier_discount_ranges</code>,{" "}
            {importSupplierDiscountsResult.writtenSuppliers} supplier(s) →{" "}
            <code className="text-xs">data_supplier_discounts</code> (collections cleared first).
            {importSupplierDiscountsResult.parseErrors.length > 0 ? (
              <span className="block text-xs text-amber-800 dark:text-amber-200">
                Skipped with errors: {importSupplierDiscountsResult.parseErrors.join(" ")}
              </span>
            ) : null}
          </p>
        ) : null}

        {importListsError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importListsError}</p>
        ) : null}
        {importListsResult ? (
          <div
            className="space-y-1 text-sm text-sf-text-secondary dark:text-zinc-400"
            role="status"
          >
            <p>
              Import lists — tab <strong>{importListsResult.tabTitle}</strong>. Existing rows are
              matched by key; only <strong>notes</strong> are updated. New rows are created.
            </p>
            <p>
              Styles ({importListsResult.styles.range}): {importListsResult.styles.parsed} row(s) —{" "}
              {importListsResult.styles.created} created, {importListsResult.styles.updated}{" "}
              updated in <code className="text-xs">lookups</code>.
            </p>
            <p>
              Colours ({importListsResult.colours.range}): {importListsResult.colours.parsed}{" "}
              row(s) — {importListsResult.colours.created} created,{" "}
              {importListsResult.colours.updated} updated in{" "}
              <code className="text-xs">lookups_colours</code>.
            </p>
            <p>
              UOM ({importListsResult.uom.range}): {importListsResult.uom.parsed} row(s) —{" "}
              {importListsResult.uom.created} created, {importListsResult.uom.updated} updated in{" "}
              <code className="text-xs">lookups</code> (type UOM).
            </p>
          </div>
        ) : null}

        {clearObjectsError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{clearObjectsError}</p>
        ) : null}
        {clearObjectsResult ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
            Emptied <code className="text-xs">data_objects</code> — {clearObjectsResult.deleted}{" "}
            row(s) deleted. Run <strong>Prepare Objects</strong> to rebuild from SKUs.
          </p>
        ) : null}

        {prepareError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{prepareError}</p>
        ) : null}
        {prepareResult ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
            Prepare objects: {prepareResult.distinctFromSkus} distinct category + product type
            line(s) from SKUs —{" "}
            {prepareResult.created} created, {prepareResult.skippedExisting} already in{" "}
            <code className="text-xs">data_objects</code>
            {prepareResult.skippedIncomplete > 0
              ? `, ${prepareResult.skippedIncomplete} SKU row(s) missing category or product type`
              : ""}
            .
          </p>
        ) : null}

        {importing || importProgress ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-sf-text dark:text-zinc-200">
                {importProgress
                  ? `${phaseLabel(importProgress.phase)} — ${importProgress.message}`
                  : "Starting…"}
              </span>
              <span className="tabular-nums text-sf-text-secondary dark:text-zinc-400">
                {importProgress?.percent ?? 0}%
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-sf-page dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={importProgress?.percent ?? 0}
            >
              <div
                className="h-full bg-sf-brand transition-[width] duration-300 ease-out dark:bg-[#58a9f5]"
                style={{ width: `${importProgress?.percent ?? 0}%` }}
              />
            </div>
            {importProgress?.deleteTotal != null && importProgress.deleteTotal > 0 ? (
              <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                Deleted {importProgress.deleted ?? 0} / {importProgress.deleteTotal}
              </p>
            ) : null}
            {importProgress?.writeTotal != null && importProgress.writeTotal > 0 ? (
              <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                Products {importProgress.writtenProducts ?? 0}, suppliers{" "}
                {importProgress.writtenSuppliers ?? 0} / {importProgress.writeTotal}
              </p>
            ) : null}
            {importProgress != null &&
            (importProgress.productsRemovedNotInSheet ?? 0) > 0 ? (
              <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                Removed {importProgress.productsRemovedNotInSheet} product(s) not on sheet
                {(importProgress.suppliersRemovedNotInSheet ?? 0) > 0
                  ? ` (${importProgress.suppliersRemovedNotInSheet} supplier row(s))`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {displayLog && summaryStatus ? (
          <ImportSummaryBanner log={displayLog} statusOverride={summaryStatus} />
        ) : null}

        {importLog.length > 0 ? (
          <div
            ref={logContainerRef}
            className="max-h-48 overflow-y-auto rounded border border-sf-border bg-zinc-950 p-3 font-mono text-xs text-zinc-200 dark:border-zinc-700"
          >
            {importLog.map((entry, i) => (
              <div key={`${entry.phase}-${i}-${entry.percent}`} className="py-0.5">
                <span className="text-zinc-500">[{entry.percent}%]</span>{" "}
                <span className="text-zinc-400">{phaseLabel(entry.phase)}:</span> {entry.message}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {displayLog ? <ImportLogAuditPanel log={displayLog} /> : null}

      {recentLogs.length > 0 ? (
        <section className={`${sfDataSurface} flex flex-col gap-2 p-4 md:p-5`}>
          <h2 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
            Recent importlog runs
          </h2>
          <ul className="text-sm text-sf-text-secondary dark:text-zinc-400">
            {recentLogs.map((log) => (
              <li key={log.importRunId}>
                <button
                  type="button"
                  className="text-left text-sf-brand hover:underline dark:text-[#58a9f5]"
                  onClick={() => setSavedImportLog(log)}
                >
                  {new Date(log.completedAt).toLocaleString()} — {log.kind} — {log.status} — found{" "}
                  {log.summary.rowsFound} / appended {log.summary.productsAppended} / updated{" "}
                  {log.summary.productsUpdated} / errors {log.summary.errorRows} / blank{" "}
                  {log.summary.blankRows}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`${sfDataSurface} flex flex-col gap-4 p-4 md:p-5`}>
        <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
          Workbook access test
        </h2>
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          <code className="text-xs">{MASTER_PRICES_SKU_TAB_TITLE}</code>,{" "}
          <code className="text-xs">{MASTER_PRICES_BUILDING_TAB_TITLE}</code>, and{" "}
          <code className="text-xs">{MASTER_PRICES_LABOUR_TAB_TITLE}</code> share the same column
          layout (Apend1Type/Spec … Apend3Type/Spec after UOM). SKU tab
          {importTabInfo ? (
            <> (gid <code className="text-xs">{importTabInfo.gid}</code>)</>
          ) : null}
          ; building
          {buildingTabInfo ? (
            <> (gid <code className="text-xs">{buildingTabInfo.gid}</code>)</>
          ) : null}
          ; labour
          {labourTabInfo ? (
            <> (gid <code className="text-xs">{labourTabInfo.gid}</code>)</>
          ) : null}
          . Other tabs are listed for reference only.
        </p>
        <div className="flex flex-wrap gap-3">
          {importTabInfo?.url ? (
            <a
              href={importTabInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
            >
              Open {MASTER_PRICES_SKU_TAB_TITLE}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={testLoading || importing}
            className={sfPrimaryToolbarButton}
          >
            {testLoading ? "Testing…" : "Test list workbook tabs"}
          </button>
        </div>

        {testFetchError ? (
          <section className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            <p className="font-semibold">Request failed (client)</p>
            <p className="mt-1 whitespace-pre-wrap">{testFetchError}</p>
          </section>
        ) : null}

        {testHttpStatus != null ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            HTTP status: <strong>{testHttpStatus}</strong>
          </p>
        ) : null}

        {testFailure ? (
          <section className="rounded border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
            <p className="font-semibold text-red-900 dark:text-red-200">API error</p>
            <p className="mt-1 text-sm text-red-800 dark:text-red-300">{testFailure.error}</p>
            {testFailure.hint ? (
              <p className="mt-2 text-sm text-red-800 dark:text-red-300">{testFailure.hint}</p>
            ) : null}
          </section>
        ) : null}

        {testSuccess ? (
          <section className="flex flex-col gap-3 rounded border border-sf-border p-4 dark:border-zinc-700">
            <p className="text-sm font-semibold text-green-800 dark:text-green-400">
              Connected — {testSuccess.sheets.length} tab(s)
            </p>
            <dl className="grid gap-1 text-sm text-sf-text-secondary dark:text-zinc-400">
              <div>
                <dt className="inline font-medium text-sf-text dark:text-zinc-300">Title: </dt>
                <dd className="inline">{testSuccess.spreadsheet.title ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-sf-text dark:text-zinc-300">ID: </dt>
                <dd className="inline font-mono text-xs">{testSuccess.spreadsheet.id}</dd>
              </div>
              {testSuccess.matchedTab ? (
                <div>
                  <dt className="inline font-medium text-sf-text dark:text-zinc-300">
                    Matched gid tab:{" "}
                  </dt>
                  <dd className="inline">{testSuccess.matchedTab.title}</dd>
                </div>
              ) : (
                <p className="text-amber-800 dark:text-amber-300">
                  No tab matched gid {testSuccess.requestedGid}.
                </p>
              )}
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-sf-border dark:border-zinc-700">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 pr-3 font-medium">gid</th>
                    <th className="py-2 pr-3 font-medium">Rows</th>
                    <th className="py-2 pr-3 font-medium">Cols</th>
                    <th className="py-2 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {testSuccess.sheets.map((tab) => (
                    <tr
                      key={`${tab.sheetId ?? tab.index}-${tab.title}`}
                      className={`border-b border-sf-border dark:border-zinc-800 ${
                        tab.matchesRequestedGid
                          ? "bg-sf-nav-active-bg/50 dark:bg-sf-brand/10"
                          : ""
                      }`}
                    >
                      <td className="py-2 pr-3">{tab.index}</td>
                      <td className="py-2 pr-3">
                        {tab.title}
                        {tab.hidden ? (
                          <span className="ml-1 text-xs text-sf-text-weak">(hidden)</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{tab.gid ?? "—"}</td>
                      <td className="py-2 pr-3">{tab.rowCount ?? "—"}</td>
                      <td className="py-2 pr-3">{tab.columnCount ?? "—"}</td>
                      <td className="py-2">
                        {tab.editUrl ? (
                          <a
                            href={tab.editUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sf-brand dark:text-[#58a9f5]"
                          >
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {testResult ? (
          <section className={`${sfDataSurface} flex flex-col gap-2 p-4 md:p-5`}>
            <h2 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
              Debug (raw JSON)
            </h2>
            <pre className="max-h-[480px] overflow-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </section>
        ) : null}
      </section>
        </>
      ) : null}

      <ConfirmDialog
        open={clearObjectsConfirmOpen}
        title="Empty data_objects?"
        description="Deletes every row in the data_objects collection (collection metadata is kept). Quote object links on deleted rows are removed. Use this before rebuilding with Prepare Objects after key changes. This cannot be undone."
        confirmLabel="Empty table"
        cancelLabel="Cancel"
        variant="danger"
        pending={clearingObjects}
        onCancel={() => setClearObjectsConfirmOpen(false)}
        onConfirm={() => void runClearDataObjects()}
      />
    </div>
  );
}
