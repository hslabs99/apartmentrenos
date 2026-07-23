"use client";

import {
  MASTER_PRICES_BUILDING_TAB_TITLE,
  MASTER_PRICES_CASCADES_TAB_TITLE,
  MASTER_PRICES_LABOUR_TAB_TITLE,
  MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE,
  MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE,
  MASTER_PRICES_PAINTING_TAB_TITLE,
  MASTER_PRICES_LISTS_TAB_TITLE,
  MASTER_PRICES_SKU_TAB_TITLE,
  MASTER_PRICES_SKU_TAB_GID,
  MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
  MASTER_PRICES_SUPPLIER_DISCOUNTS_TAB_TITLE,
  masterPricesSpreadsheetEditUrl,
} from "@/lib/google/master-prices-spreadsheet";

/** Shown even when Sheets API credentials fail (live without secret). */
const FALLBACK_SKU_SHEET_URL = masterPricesSpreadsheetEditUrl(MASTER_PRICES_SKU_TAB_GID);
import { ConfirmDialog } from "@/components/confirm-dialog";
import { clearLookupsCache } from "@/lib/client/use-lookups";
import { clearLookupsColoursCache } from "@/lib/client/use-lookups-colours";
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
import {
  BLINDS_PRICES_SPREADSHEET_ID,
  blindsPricesSpreadsheetEditUrl,
} from "@/lib/google/blinds-prices-spreadsheet";
import { PriceBookTestingPanel } from "@/components/price-book-testing-panel";
import { ImportLogAuditPanel } from "@/components/import-log-audit-panel";
import { ImportLogIndexPanel } from "@/components/import-log-index-panel";
import { ImportSummaryBanner } from "@/components/import-summary-banner";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { SKU_DATA_START_ROW_1_BASED, SKU_HEADER_ROW_1_BASED } from "@/lib/google/parse-master-prices-skus";
import type { ImportLogPublic } from "@/types/import-log-types";
import { useCallback, useEffect, useRef, useState } from "react";

function elementCoverageWarningClass(message: string): string {
  if (message.includes("element matrix")) {
    return "block text-xs font-semibold text-red-800 dark:text-red-300";
  }
  if (message.includes("no matching SKU product")) {
    return "block text-xs text-amber-800 dark:text-amber-200";
  }
  return "block text-xs text-sf-text-secondary dark:text-zinc-400";
}

function renderElementImportWarnings(warnings: string[]) {
  if (warnings.length === 0) return null;
  return (
    <span className="mt-1 block space-y-0.5">
      {warnings.map((w) => (
        <span key={w} className={elementCoverageWarningClass(w)}>
          {w}
        </span>
      ))}
    </span>
  );
}

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
  importProductCount: number | null;
  importSupplierCount: number | null;
  importNonBlankRows: number | null;
};

function formatSkuTabImportCounts(tab: ImportTabInfo): string | null {
  if (tab.importProductCount == null) return null;
  const products = tab.importProductCount;
  const suppliers = tab.importSupplierCount ?? 0;
  if (suppliers > 0) {
    return `~${products} product(s) · ~${suppliers} supplier row(s)`;
  }
  return `~${products} product(s)`;
}

const DATA_SKUS_IMPORT_ENDPOINTS: Record<DataSkusImportSource, string> = {
  sku_all: "/api/import-master-prices/import-data-skus",
  building: "/api/import-master-prices/import-data-skus-building",
  painting: "/api/import-master-prices/import-data-skus-painting",
};

const DATA_SKUS_SOURCE_LABEL: Record<DataSkusImportSource, string> = {
  sku_all: MASTER_PRICES_SKU_TAB_TITLE,
  building: MASTER_PRICES_BUILDING_TAB_TITLE,
  painting: MASTER_PRICES_PAINTING_TAB_TITLE,
};

type SkuImportBatchMode = "single" | "start" | "continue";

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

type PageTab = "import" | "data" | "data-objects" | "price-book-testing";

export function ImportMasterPricesPanel() {
  const [pageTab, setPageTab] = useState<PageTab>("import");
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [dataObjectsRefreshKey, setDataObjectsRefreshKey] = useState(0);
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
    distinctFromLabourRates: number;
    created: number;
    mergedExisting: number;
    skippedIncomplete: number;
    labourSkusCreated: number;
    labourSkusUpdated: number;
    removedDataObjects: number;
    quoteObjectsCreated: number;
    quoteObjectsUpdated: number;
    removedQuoteObjects: number;
    objectCategoryLookupsCreated: number;
    objectCategoryLookupsAlreadyPresent: number;
  } | null>(null);
  /** Prepare Objects: drop data_objects not derived from current data_skus or data_labourrates. */
  const [removeDataObjectsNotInSkus, setRemoveDataObjectsNotInSkus] = useState(false);
  /** Prepare Objects: drop SKU-pipeline quote_objects with no matching data_objects row. */
  const [removeQuoteObjectsNotInDataObjects, setRemoveQuoteObjectsNotInDataObjects] =
    useState(false);
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
  const [importingBuildingElements, setImportingBuildingElements] = useState(false);
  const [importingPaintingElements, setImportingPaintingElements] = useState(false);
  const [importBuildingElementsResult, setImportBuildingElementsResult] = useState<{
    tabTitle: string;
    range: string;
    dataStartRow1Based: number;
    parsedElements: number;
    parsedLines: number;
    written: number;
    deletedPrior: number;
    parseErrors: string[];
    warnings: string[];
  } | null>(null);
  const [importBuildingElementsError, setImportBuildingElementsError] = useState<string | null>(
    null,
  );
  const [importPaintingElementsResult, setImportPaintingElementsResult] = useState<{
    tabTitle: string;
    range: string;
    dataStartRow1Based: number;
    parsedElements: number;
    parsedLines: number;
    written: number;
    deletedPrior: number;
    parseErrors: string[];
    warnings: string[];
  } | null>(null);
  const [importPaintingElementsError, setImportPaintingElementsError] = useState<string | null>(
    null,
  );
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
    written: number;
    deletedPrior: number;
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
  const [removeProductsNotInSheet, setRemoveProductsNotInSheet] = useState(true);
  const [importSkuAllSelected, setImportSkuAllSelected] = useState(true);
  const [importBuildingSelected, setImportBuildingSelected] = useState(false);
  const [importPaintingSelected, setImportPaintingSelected] = useState(false);
  const [importLabourRatesSelected, setImportLabourRatesSelected] = useState(false);
  const [importBuildingElementsSelected, setImportBuildingElementsSelected] = useState(false);
  const [importPaintingElementsSelected, setImportPaintingElementsSelected] = useState(false);
  const [importCascadesSelected, setImportCascadesSelected] = useState(false);
  const [importSupplierDiscountsSelected, setImportSupplierDiscountsSelected] = useState(false);
  const [importListsSelected, setImportListsSelected] = useState(false);
  const [importIncrementalLabourSelected, setImportIncrementalLabourSelected] = useState(false);
  const [listsTabInfo, setListsTabInfo] = useState<ImportTabInfo | null>(null);
  const [listsTabError, setListsTabError] = useState<string | null>(null);
  const importing = activeImportSource != null;
  const importBusy =
    importing ||
    importingLists ||
    importingCascades ||
    importingLabourRates ||
    importingBuildingElements ||
    importingPaintingElements ||
    importingSupplierDiscounts ||
    importingObjectLabourRates;
  const [importProgress, setImportProgress] = useState<ImportDataSkusProgress | null>(null);
  const [importLog, setImportLog] = useState<ImportDataSkusProgress[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [sessionImportLogs, setSessionImportLogs] = useState<ImportLogPublic[]>([]);
  const [selectedImportLogId, setSelectedImportLogId] = useState<string | null>(null);
  /** Imports after this page load — excludes historical Firestore logs from earlier sessions. */
  const importSessionStartedAtRef = useRef(new Date().toISOString());
  const [importTabInfo, setImportTabInfo] = useState<ImportTabInfo | null>(null);
  const [buildingTabInfo, setBuildingTabInfo] = useState<ImportTabInfo | null>(null);
  const [buildingTabError, setBuildingTabError] = useState<string | null>(null);
  const [labourTabInfo, setLabourTabInfo] = useState<ImportTabInfo | null>(null);
  const [labourTabError, setLabourTabError] = useState<string | null>(null);
  const [buildingElementsTabInfo, setBuildingElementsTabInfo] = useState<ImportTabInfo | null>(null);
  const [buildingElementsTabError, setBuildingElementsTabError] = useState<string | null>(null);
  const [paintingElementsTabInfo, setPaintingElementsTabInfo] = useState<ImportTabInfo | null>(null);
  const [paintingElementsTabError, setPaintingElementsTabError] = useState<string | null>(null);
  const [paintingTabInfo, setPaintingTabInfo] = useState<ImportTabInfo | null>(null);
  const [paintingTabError, setPaintingTabError] = useState<string | null>(null);
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
        buildingElements?: ImportTabInfo | null;
        buildingElementsError?: string | null;
        paintingElements?: ImportTabInfo | null;
        paintingElementsError?: string | null;
        painting?: ImportTabInfo | null;
        paintingError?: string | null;
        cascades?: ImportTabInfo | null;
        cascadesError?: string | null;
        supplierDiscounts?: ImportTabInfo | null;
        supplierDiscountsError?: string | null;
        lists?: ImportTabInfo | null;
        listsError?: string | null;
        incrementalLabourProducts?: ImportTabInfo | null;
        incrementalLabourProductsError?: string | null;
        error?: string;
        spreadsheet?: { id?: string; url?: string };
      }>(res);
      if (!res.ok || data.error || !data.skuAll) {
        setImportTabError(data.error ?? `Import tab not found (${res.status})`);
        setImportTabInfo(null);
        setBuildingTabInfo(null);
        setBuildingTabError(null);
        setLabourTabInfo(null);
        setLabourTabError(null);
        setBuildingElementsTabInfo(null);
        setBuildingElementsTabError(null);
        setPaintingElementsTabInfo(null);
        setPaintingElementsTabError(null);
        setPaintingTabInfo(null);
        setPaintingTabError(null);
        setCascadesTabInfo(null);
        setCascadesTabError(null);
        setSupplierDiscountsTabInfo(null);
        setSupplierDiscountsTabError(null);
        setListsTabInfo(null);
        setListsTabError(null);
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
      setBuildingElementsTabInfo(data.buildingElements ?? null);
      setBuildingElementsTabError(data.buildingElementsError ?? null);
      setPaintingElementsTabInfo(data.paintingElements ?? null);
      setPaintingElementsTabError(data.paintingElementsError ?? null);
      setPaintingTabInfo(data.painting ?? null);
      setPaintingTabError(data.paintingError ?? null);
      setCascadesTabInfo(data.cascades ?? null);
      setCascadesTabError(data.cascadesError ?? null);
      setSupplierDiscountsTabInfo(data.supplierDiscounts ?? null);
      setSupplierDiscountsTabError(data.supplierDiscountsError ?? null);
      setListsTabInfo(data.lists ?? null);
      setListsTabError(data.listsError ?? null);
      setIncrementalLabourProductsTabInfo(data.incrementalLabourProducts ?? null);
      setIncrementalLabourProductsTabError(data.incrementalLabourProductsError ?? null);
    } catch (e) {
      setImportTabError(e instanceof Error ? e.message : String(e));
      setImportTabInfo(null);
      setBuildingTabInfo(null);
      setBuildingTabError(null);
      setLabourTabInfo(null);
      setLabourTabError(null);
      setBuildingElementsTabInfo(null);
      setBuildingElementsTabError(null);
      setPaintingElementsTabInfo(null);
      setPaintingElementsTabError(null);
      setPaintingTabInfo(null);
      setPaintingTabError(null);
      setCascadesTabInfo(null);
      setCascadesTabError(null);
      setSupplierDiscountsTabInfo(null);
      setSupplierDiscountsTabError(null);
      setListsTabInfo(null);
      setListsTabError(null);
      setIncrementalLabourProductsTabInfo(null);
      setIncrementalLabourProductsTabError(null);
    }
  }, []);

  const upsertSessionImportLog = useCallback((log: ImportLogPublic) => {
    setSessionImportLogs((prev) => {
      const index = prev.findIndex((entry) => entry.importRunId === log.importRunId);
      if (index >= 0) {
        const next = [...prev];
        next[index] = log;
        return next;
      }
      return [...prev, log];
    });
  }, []);

  const loadImportLogs = useCallback(
    async (importRunId?: string) => {
      try {
        if (importRunId) {
          const res = await fetch(
            `/api/import-master-prices/import-log?importRunId=${encodeURIComponent(importRunId)}`,
          );
          const data = await readApiJson<{ log: ImportLogPublic | null }>(res);
          if (data.log) {
            upsertSessionImportLog(data.log);
            setSelectedImportLogId(data.log.importRunId);
            return data.log;
          }
        }
        const listRes = await fetch("/api/import-master-prices/import-log?limit=20");
        const listData = await readApiJson<{ logs: ImportLogPublic[] }>(listRes);
        const sessionStart = importSessionStartedAtRef.current;
        const sessionLogs = (listData.logs ?? []).filter(
          (log) => log.completedAt && log.completedAt >= sessionStart,
        );
        if (sessionLogs.length > 0) {
          setSessionImportLogs((prev) => {
            const byId = new Map(prev.map((entry) => [entry.importRunId, entry]));
            for (const log of sessionLogs) {
              byId.set(log.importRunId, log);
            }
            return [...byId.values()].sort((a, b) =>
              (b.completedAt || "").localeCompare(a.completedAt || ""),
            );
          });
        }
        return null;
      } catch {
        return null;
      }
    },
    [upsertSessionImportLog],
  );

  useEffect(() => {
    void loadImportTab();
  }, [loadImportTab]);

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

  const resolveImportRunLog = useCallback(
    async (importRunId?: string | null) => {
      if (importRunId) {
        await loadImportLogs(importRunId);
        return;
      }
      await loadImportLogs();
    },
    [loadImportLogs],
  );

  const runImportLists = useCallback(async (): Promise<boolean> => {
    setImportingLists(true);
    setImportListsError(null);
    setImportListsResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-lists", { method: "POST" });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        importRunId?: string;
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
      if (!res.ok) {
        await resolveImportRunLog(data.importRunId);
        throw new Error(data.error ?? "Import lists failed");
      }
      await resolveImportRunLog(data.importRunId);
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
      clearLookupsColoursCache();
      return true;
    } catch (e) {
      setImportListsError(e instanceof Error ? e.message : "Import lists failed");
      return false;
    } finally {
      setImportingLists(false);
    }
  }, [resolveImportRunLog]);

  const runImportLabourRates = useCallback(async (): Promise<boolean> => {
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
        importRunId?: string;
        tabTitle?: string;
        range?: string;
        headerRow1Based?: number;
        dataStartRow1Based?: number;
        parsed?: number;
        written?: number;
        deletedPrior?: number;
        parseErrors?: string[];
      }>(res);
      if (!res.ok) {
        await resolveImportRunLog(data.importRunId);
        throw new Error(data.error ?? "Import labour rates failed");
      }
      await resolveImportRunLog(data.importRunId);
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
      return true;
    } catch (e) {
      setImportLabourRatesError(
        e instanceof Error ? e.message : "Import labour rates failed",
      );
      return false;
    } finally {
      setImportingLabourRates(false);
    }
  }, [resolveImportRunLog]);

  const runImportBuildingElements = useCallback(async (): Promise<boolean> => {
    setImportingBuildingElements(true);
    setImportBuildingElementsError(null);
    setImportBuildingElementsResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-building-elements", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        importRunId?: string;
        tabTitle?: string;
        range?: string;
        dataStartRow1Based?: number;
        parsedElements?: number;
        parsedLines?: number;
        written?: number;
        deletedPrior?: number;
        parseErrors?: string[];
        warnings?: string[];
      }>(res);
      if (!res.ok) {
        await resolveImportRunLog(data.importRunId);
        throw new Error(data.error ?? "Import building elements failed");
      }
      await resolveImportRunLog(data.importRunId);
      setImportBuildingElementsResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_BUILDING_ELEMENTS_TAB_TITLE,
        range: data.range ?? "A1:BA100",
        dataStartRow1Based: data.dataStartRow1Based ?? 9,
        parsedElements: data.parsedElements ?? 0,
        parsedLines: data.parsedLines ?? 0,
        written: data.written ?? 0,
        deletedPrior: data.deletedPrior ?? 0,
        parseErrors: data.parseErrors ?? [],
        warnings: data.warnings ?? [],
      });
      return true;
    } catch (e) {
      setImportBuildingElementsError(
        e instanceof Error ? e.message : "Import building elements failed",
      );
      return false;
    } finally {
      setImportingBuildingElements(false);
    }
  }, [resolveImportRunLog]);

  const runImportPaintingElements = useCallback(async (): Promise<boolean> => {
    setImportingPaintingElements(true);
    setImportPaintingElementsError(null);
    setImportPaintingElementsResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-painting-elements", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        importRunId?: string;
        tabTitle?: string;
        range?: string;
        dataStartRow1Based?: number;
        parsedElements?: number;
        parsedLines?: number;
        written?: number;
        deletedPrior?: number;
        parseErrors?: string[];
        warnings?: string[];
      }>(res);
      if (!res.ok) {
        await resolveImportRunLog(data.importRunId);
        throw new Error(data.error ?? "Import painting elements failed");
      }
      await resolveImportRunLog(data.importRunId);
      setImportPaintingElementsResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_PAINTING_ELEMENTS_TAB_TITLE,
        range: data.range ?? "A1:BA100",
        dataStartRow1Based: data.dataStartRow1Based ?? 9,
        parsedElements: data.parsedElements ?? 0,
        parsedLines: data.parsedLines ?? 0,
        written: data.written ?? 0,
        deletedPrior: data.deletedPrior ?? 0,
        parseErrors: data.parseErrors ?? [],
        warnings: data.warnings ?? [],
      });
      return true;
    } catch (e) {
      setImportPaintingElementsError(
        e instanceof Error ? e.message : "Import painting elements failed",
      );
      return false;
    } finally {
      setImportingPaintingElements(false);
    }
  }, [resolveImportRunLog]);

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

  const runImportSupplierDiscounts = useCallback(async (): Promise<boolean> => {
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
        importRunId?: string;
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
      if (!res.ok) {
        await resolveImportRunLog(data.importRunId);
        throw new Error(data.error ?? "Import supplier discounts failed");
      }
      await resolveImportRunLog(data.importRunId);
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
      return true;
    } catch (e) {
      setImportSupplierDiscountsError(
        e instanceof Error ? e.message : "Import supplier discounts failed",
      );
      return false;
    } finally {
      setImportingSupplierDiscounts(false);
    }
  }, [resolveImportRunLog]);

  const runImportObjectLabourRates = useCallback(async (): Promise<boolean> => {
    setImportingObjectLabourRates(true);
    setImportObjectLabourRatesError(null);
    setImportObjectLabourRatesResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-object-labour-rates", {
        method: "POST",
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        importRunId?: string;
        tabTitle?: string;
        range?: string;
        headerRow1Based?: number;
        dataStartRow1Based?: number;
        parsed?: number;
        written?: number;
        deletedPrior?: number;
        parseErrors?: string[];
      }>(res);
      if (!res.ok) {
        await resolveImportRunLog(data.importRunId);
        throw new Error(data.error ?? "Import incremental labour products failed");
      }
      await resolveImportRunLog(data.importRunId);
      setImportObjectLabourRatesResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_INCREMENTAL_LABOUR_PRODUCTS_TAB_TITLE,
        range: data.range ?? "A3:I150",
        headerRow1Based: data.headerRow1Based ?? 3,
        dataStartRow1Based: data.dataStartRow1Based ?? 4,
        parsed: data.parsed ?? 0,
        written: data.written ?? 0,
        deletedPrior: data.deletedPrior ?? 0,
        parseErrors: data.parseErrors ?? [],
      });
      return true;
    } catch (e) {
      setImportObjectLabourRatesError(
        e instanceof Error ? e.message : "Import incremental labour products failed",
      );
      return false;
    } finally {
      setImportingObjectLabourRates(false);
    }
  }, [resolveImportRunLog]);

  const runImportCascades = useCallback(async (): Promise<boolean> => {
    setImportingCascades(true);
    setImportCascadesError(null);
    setImportCascadesResult(null);
    try {
      const res = await fetch("/api/import-master-prices/import-cascades", { method: "POST" });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        importRunId?: string;
        tabTitle?: string;
        range?: string;
        headerRow1Based?: number;
        parsed?: number;
        written?: number;
        deletedPrior?: number;
      }>(res);
      if (!res.ok) {
        await resolveImportRunLog(data.importRunId);
        throw new Error(data.error ?? "Import cascades failed");
      }
      await resolveImportRunLog(data.importRunId);
      setImportCascadesResult({
        tabTitle: data.tabTitle ?? MASTER_PRICES_CASCADES_TAB_TITLE,
        range: data.range ?? "A1:C50",
        headerRow1Based: data.headerRow1Based ?? 0,
        parsed: data.parsed ?? 0,
        written: data.written ?? 0,
        deletedPrior: data.deletedPrior ?? 0,
      });
      return true;
    } catch (e) {
      setImportCascadesError(e instanceof Error ? e.message : "Import cascades failed");
      return false;
    } finally {
      setImportingCascades(false);
    }
  }, [resolveImportRunLog]);

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
      const res = await fetch("/api/data-objects/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removeDataObjectsNotInSkus,
          removeQuoteObjectsNotInDataObjects,
        }),
      });
      const data = await readApiJson<{
        ok?: boolean;
        distinctFromSkus?: number;
        distinctFromLabourRates?: number;
        created?: number;
        mergedExisting?: number;
        skippedIncomplete?: number;
        labourSkusCreated?: number;
        labourSkusUpdated?: number;
        removedDataObjects?: number;
        quoteObjectsCreated?: number;
        quoteObjectsUpdated?: number;
        removedQuoteObjects?: number;
        objectCategoryLookupsCreated?: number;
        objectCategoryLookupsAlreadyPresent?: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Prepare objects failed");
      setPrepareResult({
        distinctFromSkus: data.distinctFromSkus ?? 0,
        distinctFromLabourRates: data.distinctFromLabourRates ?? 0,
        created: data.created ?? 0,
        mergedExisting: data.mergedExisting ?? 0,
        skippedIncomplete: data.skippedIncomplete ?? 0,
        labourSkusCreated: data.labourSkusCreated ?? 0,
        labourSkusUpdated: data.labourSkusUpdated ?? 0,
        removedDataObjects: data.removedDataObjects ?? 0,
        quoteObjectsCreated: data.quoteObjectsCreated ?? 0,
        quoteObjectsUpdated: data.quoteObjectsUpdated ?? 0,
        removedQuoteObjects: data.removedQuoteObjects ?? 0,
        objectCategoryLookupsCreated: data.objectCategoryLookupsCreated ?? 0,
        objectCategoryLookupsAlreadyPresent: data.objectCategoryLookupsAlreadyPresent ?? 0,
      });
      clearLookupsCache();
      setDataObjectsRefreshKey((k) => k + 1);
      setPageTab("data-objects");
    } catch (e) {
      setPrepareError(e instanceof Error ? e.message : "Prepare objects failed");
    } finally {
      setPreparingObjects(false);
    }
  }, [removeDataObjectsNotInSkus, removeQuoteObjectsNotInDataObjects]);

  const runImport = useCallback(
    async (
      source: DataSkusImportSource,
      options?: { batchMode?: SkuImportBatchMode },
    ): Promise<boolean> => {
      const batchMode = options?.batchMode ?? "single";
      setPageTab("import");
      setActiveImportSource(source);
      setImportError(null);
      setImportProgress(null);
      if (batchMode === "single" || batchMode === "start") {
        setImportLog([]);
        if (batchMode === "start") {
          setSessionImportLogs([]);
          setSelectedImportLogId(null);
        }
      } else {
        setImportLog((prev) => [
          ...prev,
          {
            phase: "fetching_sheet",
            message: `——— ${DATA_SKUS_SOURCE_LABEL[source]} ———`,
            percent: 0,
          },
        ]);
      }
      scrollToImportTop();
      const endpoint = DATA_SKUS_IMPORT_ENDPOINTS[source];
      try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removeProductsNotInSheet,
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
      if (finalEvent?.phase === "error") {
        const errorFallback = finalEvent.audit
          ? importLogFromProgress(finalEvent)
          : null;
        const runId = finalEvent.importRunId;
        if (runId) {
          await loadImportLogs(runId);
        } else if (errorFallback) {
          upsertSessionImportLog(errorFallback);
          setSelectedImportLogId(errorFallback.importRunId);
        }
        await loadImportLogs();
        return false;
      }
      const fallback = finalEvent ? importLogFromProgress(finalEvent) : null;
      const runId = finalEvent?.importRunId;
      let resolvedLog: ImportLogPublic | null = null;
      if (runId) {
        resolvedLog = (await loadImportLogs(runId)) ?? null;
      }
      if (!resolvedLog && fallback) {
        upsertSessionImportLog(fallback);
        setSelectedImportLogId(fallback.importRunId);
        resolvedLog = fallback;
      }
      await loadImportLogs();
      setDataRefreshKey((k) => k + 1);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setImportError(msg);
      appendLog({ phase: "error", message: msg, percent: 0, error: msg });
      return false;
    } finally {
      setActiveImportSource(null);
    }
  },
    [
      appendLog,
      loadImportLogs,
      removeProductsNotInSheet,
      scrollToImportTop,
      upsertSessionImportLog,
    ],
  );

  const runImportSkuData = useCallback(async () => {
    const sources: DataSkusImportSource[] = [];
    if (importSkuAllSelected) sources.push("sku_all");
    if (importBuildingSelected) sources.push("building");
    if (importPaintingSelected) sources.push("painting");
    if (sources.length === 0) {
      setImportError("Select at least one SKU source to import.");
      scrollToImportTop();
      return;
    }
    for (let i = 0; i < sources.length; i++) {
      const ok = await runImport(sources[i], {
        batchMode: i === 0 ? "start" : "continue",
      });
      if (!ok) break;
    }
  }, [
    importSkuAllSelected,
    importBuildingSelected,
    importPaintingSelected,
    runImport,
    scrollToImportTop,
  ]);

  const runImportSupportingData = useCallback(async () => {
    const tasks: { selected: boolean; ready: boolean; run: () => Promise<boolean> }[] = [
      {
        selected: importLabourRatesSelected,
        ready: Boolean(labourTabInfo),
        run: runImportLabourRates,
      },
      {
        selected: importBuildingElementsSelected,
        ready: Boolean(buildingElementsTabInfo),
        run: runImportBuildingElements,
      },
      {
        selected: importPaintingElementsSelected,
        ready: Boolean(paintingElementsTabInfo),
        run: runImportPaintingElements,
      },
      {
        selected: importCascadesSelected,
        ready: Boolean(cascadesTabInfo),
        run: runImportCascades,
      },
      {
        selected: importSupplierDiscountsSelected,
        ready: Boolean(supplierDiscountsTabInfo),
        run: runImportSupplierDiscounts,
      },
      {
        selected: importListsSelected,
        ready: Boolean(listsTabInfo),
        run: runImportLists,
      },
      {
        selected: importIncrementalLabourSelected,
        ready: Boolean(incrementalLabourProductsTabInfo),
        run: runImportObjectLabourRates,
      },
    ];
    const selected = tasks.filter((t) => t.selected);
    if (selected.length === 0) {
      setImportError("Select at least one supporting data source to import.");
      scrollToImportTop();
      return;
    }
    const notReady = selected.filter((t) => !t.ready);
    if (notReady.length > 0) {
      setImportError("One or more selected supporting imports are unavailable (tab not found).");
      scrollToImportTop();
      return;
    }
    setImportError(null);
    setPageTab("import");
    setImportProgress(null);
    setImportLog([]);
    setSessionImportLogs([]);
    setSelectedImportLogId(null);
    scrollToImportTop();
    for (const task of selected) {
      const ok = await task.run();
      if (!ok) break;
    }
  }, [
    importLabourRatesSelected,
    importBuildingElementsSelected,
    importPaintingElementsSelected,
    importCascadesSelected,
    importSupplierDiscountsSelected,
    importListsSelected,
    importIncrementalLabourSelected,
    labourTabInfo,
    buildingElementsTabInfo,
    paintingElementsTabInfo,
    cascadesTabInfo,
    supplierDiscountsTabInfo,
    listsTabInfo,
    incrementalLabourProductsTabInfo,
    runImportLabourRates,
    runImportBuildingElements,
    runImportPaintingElements,
    runImportCascades,
    runImportSupplierDiscounts,
    runImportLists,
    runImportObjectLabourRates,
    scrollToImportTop,
  ]);

  const testSuccess = testResult?.ok === true ? testResult : null;
  const testFailure = testResult?.ok === false ? testResult : null;
  const importDone = importProgress?.phase === "done";
  const importFailed = importProgress?.phase === "error" || Boolean(importError);

  const displayLog =
    sessionImportLogs.find((log) => log.importRunId === selectedImportLogId) ??
    sessionImportLogs[0] ??
    (importProgress ? importLogFromProgress(importProgress) : null);

  const sessionImportLogsSorted = [...sessionImportLogs].sort((a, b) =>
    (a.completedAt || "").localeCompare(b.completedAt || ""),
  );

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
          Select SKU tabs and supporting data to import, then run <strong>Prepare Objects</strong> to
          build <code className="text-xs">data_objects</code> from{" "}
          <code className="text-xs">data_skus</code>.
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

      <div role="tabpanel" hidden={pageTab !== "price-book-testing"}>
        <PriceBookTestingPanel isActive={pageTab === "price-book-testing"} />
      </div>

      {pageTab === "import" ? (
        <>
      <div ref={importAnchorRef} className="scroll-mt-4" />
      <section className={`${sfDataSurface} flex flex-col gap-4 p-4 md:p-5`}>
        {importTabError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importTabError}</p>
        ) : null}

        <section className="flex flex-col gap-3 rounded-lg border-2 border-sf-brand/30 bg-sf-page px-4 py-4 dark:border-[#58a9f5]/30 dark:bg-zinc-900/60">
          <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
            SKU data → <code className="text-xs font-normal">data_skus</code>
          </h2>
          <p className="text-xs text-sf-text-weak dark:text-zinc-500">
            Populates product rows and suppliers. Run <strong>Prepare Objects</strong> afterward to
            build <code className="text-xs">data_objects</code>.
          </p>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importSkuAllSelected}
              disabled={importBusy || testLoading || preparingObjects || clearingObjects}
              onChange={(e) => setImportSkuAllSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                SKU (all) — full catalog upsert
              </span>
              {importTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{importTabInfo.tabTitle}</strong>
                  {formatSkuTabImportCounts(importTabInfo) ? (
                    <span> · {formatSkuTabImportCounts(importTabInfo)}</span>
                  ) : null}
                  {" "}
                  ·{" "}
                  <a
                    href={importTabInfo.url || FALLBACK_SKU_SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                  >
                    Open tab
                  </a>
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  <a
                    href={FALLBACK_SKU_SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                  >
                    Open {MASTER_PRICES_SKU_TAB_TITLE}
                  </a>
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importBuildingSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !buildingTabInfo
              }
              onChange={(e) => setImportBuildingSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">Building</span>
              {buildingTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {buildingTabError}
                </span>
              ) : buildingTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{buildingTabInfo.tabTitle}</strong>
                  {formatSkuTabImportCounts(buildingTabInfo) ? (
                    <span> · {formatSkuTabImportCounts(buildingTabInfo)}</span>
                  ) : null}
                  · upserts matching keys only
                  {buildingTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={buildingTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importPaintingSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !paintingTabInfo
              }
              onChange={(e) => setImportPaintingSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">Painting</span>
              {paintingTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {paintingTabError}
                </span>
              ) : paintingTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{paintingTabInfo.tabTitle}</strong>
                  {formatSkuTabImportCounts(paintingTabInfo) ? (
                    <span> · {formatSkuTabImportCounts(paintingTabInfo)}</span>
                  ) : null}
                  · upserts matching keys only
                  {paintingTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={paintingTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-sf-border bg-sf-surface px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={removeProductsNotInSheet}
              disabled={importBusy || testLoading || preparingObjects || clearingObjects}
              onChange={(e) => setRemoveProductsNotInSheet(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Remove products not on sheet
              </span>
              <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                Applies to each selected SKU import. Matches products by key columns{" "}
                <strong>A–F</strong> (Category, Product Type, Product, Elevate, Style, Colour —
                not UOM). Marks off-sheet rows <code className="text-xs">isCurrent=false</code>,
                then deletes them and their suppliers.{" "}
                <strong>SKU (all)</strong> scans the full catalog; Building / Painting only remove
                within categories present on that tab.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runImportSkuData()}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                (!importSkuAllSelected && !importBuildingSelected && !importPaintingSelected)
              }
              className={sfPrimaryToolbarButton}
            >
              {importing ? "Importing SKU data…" : "Import SKU Data"}
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-sf-border bg-sf-page px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
            Supporting data
          </h2>
          <p className="text-xs text-sf-text-weak dark:text-zinc-500">
            Lookup tables, labour rates, cascades, supplier discounts, and incremental labour products
            — separate from the SKU product catalog.
          </p>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importLabourRatesSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !labourTabInfo
              }
              onChange={(e) => setImportLabourRatesSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Import $ Labour Rates
              </span>
              {labourTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {labourTabError}
                </span>
              ) : labourTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{labourTabInfo.tabTitle}</strong>
                  {labourTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={labourTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                  · → <code className="text-xs">data_labourrates</code> (columns A–E, row 5 headers)
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importBuildingElementsSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !buildingElementsTabInfo
              }
              onChange={(e) => setImportBuildingElementsSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Building Elements
              </span>
              {buildingElementsTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {buildingElementsTabError}
                </span>
              ) : buildingElementsTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{buildingElementsTabInfo.tabTitle}</strong>
                  {buildingElementsTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={buildingElementsTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                  · → <code className="text-xs">data_building_elements</code> (cols F+, rows 2–6
                  headers, rows 9–100 detail, replaces collection each import)
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importPaintingElementsSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !paintingElementsTabInfo
              }
              onChange={(e) => setImportPaintingElementsSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Painting Elements
              </span>
              {paintingElementsTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {paintingElementsTabError}
                </span>
              ) : paintingElementsTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{paintingElementsTabInfo.tabTitle}</strong>
                  {paintingElementsTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={paintingElementsTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                  · → <code className="text-xs">data_painting_elements</code> (cols H+, rows 2–6
                  headers, rows 9–100 detail, replaces collection each import)
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importCascadesSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !cascadesTabInfo
              }
              onChange={(e) => setImportCascadesSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">Cascades</span>
              {cascadesTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {cascadesTabError}
                </span>
              ) : cascadesTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{cascadesTabInfo.tabTitle}</strong>
                  {cascadesTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={cascadesTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                  · replaces <code className="text-xs">cascades</code> collection
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importSupplierDiscountsSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !supplierDiscountsTabInfo
              }
              onChange={(e) => setImportSupplierDiscountsSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Supplier Discounts
              </span>
              {supplierDiscountsTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {supplierDiscountsTabError}
                </span>
              ) : supplierDiscountsTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{supplierDiscountsTabInfo.tabTitle}</strong>
                  {supplierDiscountsTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={supplierDiscountsTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                  · replaces discount ranges and supplier rows
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importListsSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !listsTabInfo
              }
              onChange={(e) => setImportListsSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">Lists</span>
              {listsTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {listsTabError}
                </span>
              ) : listsTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{listsTabInfo.tabTitle}</strong>
                  {listsTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={listsTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                  · styles, colours, UOM → <code className="text-xs">lookups</code> /{" "}
                  <code className="text-xs">lookups_colours</code>
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={importIncrementalLabourSelected}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                !incrementalLabourProductsTabInfo
              }
              onChange={(e) => setImportIncrementalLabourSelected(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Incremental Labour - Products
              </span>
              {incrementalLabourProductsTabError ? (
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-200">
                  {incrementalLabourProductsTabError}
                </span>
              ) : incrementalLabourProductsTabInfo ? (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab <strong>{incrementalLabourProductsTabInfo.tabTitle}</strong>
                  {incrementalLabourProductsTabInfo.gridRowCount != null ? (
                    <span> · ~{incrementalLabourProductsTabInfo.gridRowCount} grid rows</span>
                  ) : null}
                  {incrementalLabourProductsTabInfo.url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={incrementalLabourProductsTabInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                      >
                        Open tab
                      </a>
                    </>
                  ) : null}
                  · → <code className="text-xs">data_objectlabourrates</code> (A3:I150, replaces
                  collection each import)
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Tab not found
                </span>
              )}
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runImportSupportingData()}
              disabled={
                importBusy ||
                testLoading ||
                preparingObjects ||
                clearingObjects ||
                (!importLabourRatesSelected &&
                  !importBuildingElementsSelected &&
                  !importPaintingElementsSelected &&
                  !importCascadesSelected &&
                  !importSupplierDiscountsSelected &&
                  !importListsSelected &&
                  !importIncrementalLabourSelected)
              }
              className={sfPrimaryToolbarButton}
            >
              {importingLabourRates ||
              importingBuildingElements ||
              importingPaintingElements ||
              importingPaintingElements ||
              importingCascades ||
              importingSupplierDiscounts ||
              importingLists ||
              importingObjectLabourRates
                ? "Importing supporting data…"
                : "Import Supporting Data"}
            </button>
          </div>

          {importObjectLabourRatesError ? (
            <p className="text-sm text-red-800 dark:text-red-300">{importObjectLabourRatesError}</p>
          ) : null}
          {importObjectLabourRatesResult ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
              Incremental labour — imported from{" "}
              <strong>{importObjectLabourRatesResult.tabTitle}</strong> (
              {importObjectLabourRatesResult.range}): {importObjectLabourRatesResult.parsed} row(s)
              → <code className="text-xs">data_objectlabourrates</code>
              {importObjectLabourRatesResult.deletedPrior > 0
                ? ` (${importObjectLabourRatesResult.deletedPrior} prior row(s) replaced)`
                : ""}
              .
              {importObjectLabourRatesResult.parseErrors.length > 0 ? (
                <span className="block text-xs text-amber-800 dark:text-amber-200">
                  Skipped: {importObjectLabourRatesResult.parseErrors.join(" ")}
                </span>
              ) : null}
            </p>
          ) : null}
        </section>

        {importError && !importing ? (
          <p className="text-sm text-red-800 dark:text-red-300" role="alert">
            {importError}
          </p>
        ) : null}

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
                importingBuildingElements ||
              importingPaintingElements ||
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
                importingBuildingElements ||
              importingPaintingElements ||
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
                importingBuildingElements ||
              importingPaintingElements ||
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
              {importBlindsResult.writtenFooters} footer(s). Browse in{" "}
              <strong>System → Blinds</strong>.
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

        <section className="flex flex-col gap-3 rounded-lg border-2 border-sf-brand/30 bg-sf-page px-4 py-4 dark:border-[#58a9f5]/30 dark:bg-zinc-900/60">
          <h3 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
            Create objects — <code className="text-xs font-normal">data_skus</code> +{" "}
            <code className="text-xs font-normal">data_labourrates</code> →{" "}
            <code className="text-xs font-normal">data_objects</code> →{" "}
            <code className="text-xs font-normal">quote_objects</code>
          </h3>
          <p className="text-xs text-sf-text-weak dark:text-zinc-500">
            <strong>Prepare Objects</strong> merges distinct category + product type rows from SKUs
            and every row from <code className="text-xs">data_labourrates</code> (product type =
            rate product, tier/style/colour All on matching SKUs) into{" "}
            <code className="text-xs">data_objects</code>, then creates or updates matching{" "}
            <code className="text-xs">quote_objects</code>. Existing rows are merged; new rows are
            appended. Use the checkboxes to remove rows that no longer belong in the pipeline
            (optional).
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={removeDataObjectsNotInSkus}
              disabled={preparingObjects || clearingObjects || importing}
              onChange={(e) => setRemoveDataObjectsNotInSkus(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Remove data_objects not in current SKUs or labour rates
              </span>
              <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                Deletes <code className="text-xs">data_objects</code> whose keys are not present in{" "}
                <code className="text-xs">data_skus</code> or{" "}
                <code className="text-xs">data_labourrates</code> (runs before creating missing
                rows).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={removeQuoteObjectsNotInDataObjects}
              disabled={preparingObjects || clearingObjects || importing}
              onChange={(e) => setRemoveQuoteObjectsNotInDataObjects(e.target.checked)}
            />
            <span className="text-sf-text-secondary dark:text-zinc-300">
              <span className="font-medium text-sf-text dark:text-zinc-100">
                Remove quote_objects not in data_objects
              </span>
              <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                Deletes SKU-pipeline <code className="text-xs">quote_objects</code> with no
                matching <code className="text-xs">data_objects</code> row (category + object name).
                Blinds quote objects are not removed.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
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
              importingBuildingElements ||
              importingPaintingElements ||
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
              importingBuildingElements ||
              importingPaintingElements ||
              importingSupplierDiscounts ||
              importingObjectLabourRates
            }
            className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
          >
            {preparingObjects ? "Preparing…" : "Prepare Objects"}
          </button>
          </div>
        </section>

        {importLabourRatesError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importLabourRatesError}</p>
        ) : null}
        {importBuildingElementsError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importBuildingElementsError}</p>
        ) : null}
        {importPaintingElementsError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{importPaintingElementsError}</p>
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
        {importBuildingElementsResult ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
            Import building elements — tab <strong>{importBuildingElementsResult.tabTitle}</strong> (
            {importBuildingElementsResult.range}, data rows{" "}
            {importBuildingElementsResult.dataStartRow1Based}–100):{" "}
            {importBuildingElementsResult.parsedElements} element(s),{" "}
            {importBuildingElementsResult.parsedLines} line(s) →{" "}
            <code className="text-xs">data_building_elements</code> (
            {importBuildingElementsResult.deletedPrior} removed first).
            {importBuildingElementsResult.parseErrors.length > 0 ? (
              <span className="block text-xs text-amber-800 dark:text-amber-200">
                Skipped with errors: {importBuildingElementsResult.parseErrors.join(" ")}
              </span>
            ) : null}
            {renderElementImportWarnings(importBuildingElementsResult.warnings)}
          </p>
        ) : null}
        {importPaintingElementsResult ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400" role="status">
            Import painting elements — tab <strong>{importPaintingElementsResult.tabTitle}</strong> (
            {importPaintingElementsResult.range}, data rows{" "}
            {importPaintingElementsResult.dataStartRow1Based}–100):{" "}
            {importPaintingElementsResult.parsedElements} element(s),{" "}
            {importPaintingElementsResult.parsedLines} line(s) →{" "}
            <code className="text-xs">data_painting_elements</code> (
            {importPaintingElementsResult.deletedPrior} removed first).
            {importPaintingElementsResult.parseErrors.length > 0 ? (
              <span className="block text-xs text-amber-800 dark:text-amber-200">
                Skipped with errors: {importPaintingElementsResult.parseErrors.join(" ")}
              </span>
            ) : null}
            {renderElementImportWarnings(importPaintingElementsResult.warnings)}
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
            . Browse in <strong>System → Cascades</strong>.
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
            Prepare objects: {prepareResult.distinctFromSkus} distinct SKU line(s),{" "}
            {prepareResult.distinctFromLabourRates} labour rate line(s) —{" "}
            {prepareResult.created} data_object(s) added, {prepareResult.mergedExisting} merged
            {prepareResult.removedDataObjects > 0
              ? `, ${prepareResult.removedDataObjects} data_object(s) removed (not in sources)`
              : ""}
            {prepareResult.quoteObjectsCreated > 0 || prepareResult.quoteObjectsUpdated > 0
              ? ` · quote_objects: ${prepareResult.quoteObjectsCreated} created, ${prepareResult.quoteObjectsUpdated} updated`
              : ""}
            {prepareResult.removedQuoteObjects > 0
              ? `, ${prepareResult.removedQuoteObjects} quote_object(s) removed (not in data_objects)`
              : ""}
            {prepareResult.labourSkusCreated > 0 || prepareResult.labourSkusUpdated > 0
              ? ` · labour SKUs: ${prepareResult.labourSkusCreated} added, ${prepareResult.labourSkusUpdated} updated`
              : ""}
            {prepareResult.skippedIncomplete > 0
              ? ` · ${prepareResult.skippedIncomplete} source row(s) missing required fields`
              : ""}
            {prepareResult.objectCategoryLookupsCreated > 0 ||
            prepareResult.objectCategoryLookupsAlreadyPresent > 0
              ? ` · ObjectCategory lookups: ${prepareResult.objectCategoryLookupsCreated} added, ${prepareResult.objectCategoryLookupsAlreadyPresent} already present`
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

        {sessionImportLogsSorted.length > 0 ? (
          <ImportLogIndexPanel
            logs={sessionImportLogsSorted}
            selectedImportRunId={selectedImportLogId ?? displayLog?.importRunId ?? null}
            onSelect={setSelectedImportLogId}
          />
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

      <section className={`${sfDataSurface} flex flex-col gap-4 p-4 md:p-5`}>
        <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
          Workbook access test
        </h2>
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          <code className="text-xs">{MASTER_PRICES_SKU_TAB_TITLE}</code>,{" "}
          <code className="text-xs">{MASTER_PRICES_BUILDING_TAB_TITLE}</code>, and{" "}
          <code className="text-xs">{MASTER_PRICES_PAINTING_TAB_TITLE}</code> share the same column
          layout (Apend1Type/Spec … Apend3Type/Spec after UOM).{" "}
          <code className="text-xs">{MASTER_PRICES_LABOUR_TAB_TITLE}</code> is labour rates only
          (A–E). SKU tab
          {importTabInfo ? (
            <> (gid <code className="text-xs">{importTabInfo.gid}</code>)</>
          ) : null}
          ; building
          {buildingTabInfo ? (
            <> (gid <code className="text-xs">{buildingTabInfo.gid}</code>)</>
          ) : null}
          ; painting
          {paintingTabInfo ? (
            <> (gid <code className="text-xs">{paintingTabInfo.gid}</code>)</>
          ) : null}
          ; labour
          {labourTabInfo ? (
            <> (gid <code className="text-xs">{labourTabInfo.gid}</code>)</>
          ) : null}
          . Other tabs are listed for reference only.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={importTabInfo?.url || FALLBACK_SKU_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
          >
            Open {MASTER_PRICES_SKU_TAB_TITLE}
          </a>
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
