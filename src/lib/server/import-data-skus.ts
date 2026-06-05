import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { FetchedMasterPricesSkus } from "@/lib/google/fetch-sku-rows-from-sheet";
import {
  fetchMasterPricesBuildingSkuRows,
  fetchMasterPricesPaintingSkuRows,
  fetchMasterPricesSkuRows,
} from "@/lib/google/fetch-master-prices-sku-rows";
import {
  MASTER_PRICES_BUILDING_TAB_TITLE,
  MASTER_PRICES_PAINTING_TAB_TITLE,
  MASTER_PRICES_SKU_TAB_TITLE,
} from "@/lib/google/master-prices-spreadsheet";
import {
  ensureDataSkuSuppliersBootstrap,
  ensureDataSkusBootstrap,
} from "@/lib/firestore/collection-bootstrap";
import { DATA_SKU_SUPPLIERS_COLLECTION } from "@/lib/firestore/data-sku-suppliers-collection";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";
import {
  deleteOrphanSuppliers,
  deleteProductsNotInSheet,
  deleteProductsNotInSheetForCategories,
  deleteSuppliersForSkuIds,
  markAllProductsNotCurrent,
  markProductsNotCurrentForCategories,
} from "@/lib/server/data-sku-maintenance";
import {
  loadExistingProductKeyMap,
  resolveSkuImportIds,
} from "@/lib/server/resolve-sku-import-ids";
import { saveDataSkusImportLog } from "@/lib/server/save-import-log";
import type { DataSku } from "@/types/data-sku";
import type { DataSkuSupplier } from "@/types/data-sku-supplier";
import type { ImportLogAudit, ImportLogKind, ImportLogStatus } from "@/types/import-log-types";

/** Which workbook tab drives this import run. */
export type DataSkusImportSource = "sku_all" | "building" | "painting";

export type DataSkusImportOptions = {
  /** After import: delete products left with isCurrent=false (not on that tab's sheet). */
  removeProductsNotInSheet?: boolean;
};

export function parseDataSkusImportOptions(body: unknown): DataSkusImportOptions {
  if (!body || typeof body !== "object") return {};
  const o = body as Record<string, unknown>;
  return {
    removeProductsNotInSheet: o.removeProductsNotInSheet === true,
  };
}

type DataSkusImportSourceConfig = {
  label: string;
  requiredTabTitle: string;
  importLogKind: ImportLogKind;
  /** Full-catalog import marks every product not current before re-flagging sheet matches. */
  markAllProductsNotCurrent: boolean;
  fetchRows: (spreadsheetId?: string) => Promise<FetchedMasterPricesSkus>;
};

const DATA_SKUS_IMPORT_SOURCES: Record<DataSkusImportSource, DataSkusImportSourceConfig> = {
  sku_all: {
    label: "SKU (all)",
    requiredTabTitle: MASTER_PRICES_SKU_TAB_TITLE,
    importLogKind: "data_skus_import",
    markAllProductsNotCurrent: true,
    fetchRows: fetchMasterPricesSkuRows,
  },
  building: {
    label: "Building",
    requiredTabTitle: MASTER_PRICES_BUILDING_TAB_TITLE,
    importLogKind: "data_skus_import_building",
    markAllProductsNotCurrent: false,
    fetchRows: fetchMasterPricesBuildingSkuRows,
  },
  painting: {
    label: "Painting",
    requiredTabTitle: MASTER_PRICES_PAINTING_TAB_TITLE,
    importLogKind: "data_skus_import_painting",
    markAllProductsNotCurrent: false,
    fetchRows: fetchMasterPricesPaintingSkuRows,
  },
};

export type ImportDataSkusPhase =
  | "resolving_tab"
  | "fetching_sheet"
  | "parsed"
  | "deleting"
  | "writing"
  | "done"
  | "error";

export type ImportDataSkusProgress = {
  phase: ImportDataSkusPhase;
  message: string;
  percent: number;
  tabTitle?: string;
  gid?: number;
  sheetRange?: string;
  parsedProducts?: number;
  parsedSuppliers?: number;
  productsCreated?: number;
  productsUpdated?: number;
  orphansDeleted?: number;
  productsRemovedNotInSheet?: number;
  suppliersRemovedNotInSheet?: number;
  skippedEmptyRows?: number;
  deleteTotal?: number;
  deleted?: number;
  writeTotal?: number;
  written?: number;
  writtenProducts?: number;
  writtenSuppliers?: number;
  warnings?: string[];
  audit?: ImportLogAudit;
  importRunId?: string;
  importLogId?: string;
  error?: string;
};

const WRITE_BATCH_SIZE = 400;

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function deriveStatus(audit: ImportLogAudit, written: number, error?: string): ImportLogStatus {
  if (error) return "failed";
  if (audit.productsImported === 0 && audit.nonBlankRows > 0) return "partial";
  if (audit.dataErrors.length > 0 || audit.warnings.length > 0) return "partial";
  if (written < audit.productsImported + audit.suppliersImported) return "partial";
  return "success";
}

async function loadExistingProductKeys(
  db: Firestore,
): Promise<Map<string, string>> {
  const snap = await db.collection(DATA_SKUS_COLLECTION).get();
  const docs = snap.docs
    .filter((d) => !isDataSkusMetaDocument(d.id))
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        data: {
          category: String(data.category ?? ""),
          productType: String(data.productType ?? ""),
          product: String(data.product ?? data.description ?? ""),
          elevateLevel: String(data.elevateLevel ?? ""),
          style: String(data.style ?? ""),
          colourOptions: String(data.colourOptions ?? ""),
        },
      };
    });
  return loadExistingProductKeyMap(docs);
}

export async function runDataSkusImport(
  db: Firestore,
  onProgress: (event: ImportDataSkusProgress) => void,
  source: DataSkusImportSource = "sku_all",
  options: DataSkusImportOptions = {},
): Promise<{
  importRunId: string;
  written: number;
  deleted: number;
  writtenProducts: number;
  writtenSuppliers: number;
  productsCreated: number;
  productsUpdated: number;
  productsRemovedNotInSheet: number;
}> {
  const importRunId = crypto.randomUUID();
  const sourceConfig = DATA_SKUS_IMPORT_SOURCES[source];
  let fetched: FetchedMasterPricesSkus | null = null;
  let audit: ImportLogAudit | null = null;
  let deleted = 0;
  let writtenProducts = 0;
  let writtenSuppliers = 0;
  let productsCreated = 0;
  let productsUpdated = 0;
  let orphansDeleted = 0;
  let productsRemovedNotInSheet = 0;
  let suppliersRemovedNotInSheet = 0;

  try {
    onProgress({
      phase: "resolving_tab",
      message: `Resolving worksheet tab "${sourceConfig.requiredTabTitle}"…`,
      percent: 2,
      importRunId,
    });

    onProgress({
      phase: "fetching_sheet",
      message: `Downloading rows from "${sourceConfig.requiredTabTitle}"…`,
      percent: 8,
      importRunId,
    });

    fetched = await sourceConfig.fetchRows();
    let { products, suppliers } = fetched.parse;
    audit = fetched.parse.audit;

    onProgress({
      phase: "parsed",
      message:
        `Connected to "${fetched.tabTitle}" — API returned ${audit.apiRowsReturned} row(s). ` +
        `Products: ${audit.productsImported}, suppliers: ${audit.suppliersImported}, ` +
        `blank: ${audit.blankRowsSkipped}, data errors: ${audit.dataErrors.length}.`,
      percent: 18,
      tabTitle: fetched.tabTitle,
      gid: fetched.gid,
      sheetRange: fetched.range,
      parsedProducts: products.length,
      parsedSuppliers: suppliers.length,
      skippedEmptyRows: audit.blankRowsSkipped,
      warnings: audit.warnings,
      audit,
      importRunId,
    });

    if (audit.productsImported === 0 && audit.nonBlankRows > 0) {
      const status: ImportLogStatus =
        audit.skippedInvalidRows > 0 ? "partial" : "failed";
      await saveDataSkusImportLog(db, {
        importRunId,
        kind: sourceConfig.importLogKind,
        status,
        tabTitle: fetched.tabTitle,
        sheetRange: fetched.range,
        gid: fetched.gid,
        audit,
        deletedFromFirestore: 0,
        writtenToFirestore: 0,
        writtenProducts: 0,
        writtenSuppliers: 0,
      });
      throw new Error(
        `No products to import. Header row ${audit.headerRow1Based}. ` +
          `${audit.skippedInvalidRows} row(s) with errors. Check import log.`,
      );
    }

    await ensureDataSkusBootstrap(db);
    await ensureDataSkuSuppliersBootstrap(db);

    const sheetCategories = [
      ...new Set(products.map((p) => p.category.trim()).filter(Boolean)),
    ];

    if (sourceConfig.markAllProductsNotCurrent) {
      onProgress({
        phase: "deleting",
        message: "Marking all products not current (isCurrent=false)…",
        percent: 20,
        importRunId,
        audit,
      });

      await markAllProductsNotCurrent(db, (done, total) => {
        onProgress({
          phase: "deleting",
          message: `Marked ${done} of ${total} product(s) not current…`,
          percent: clampPercent(20 + (total === 0 ? 0 : (done / total) * 6)),
          importRunId,
          audit: audit!,
        });
      });
    } else if (options.removeProductsNotInSheet && sheetCategories.length > 0) {
      onProgress({
        phase: "deleting",
        message: `Marking products not current in ${sheetCategories.length} categor(ies) from this tab…`,
        percent: 20,
        importRunId,
        audit,
      });

      await markProductsNotCurrentForCategories(db, sheetCategories, (done, total) => {
        onProgress({
          phase: "deleting",
          message: `Marked ${done} of ${total} product(s) not current in tab categories…`,
          percent: clampPercent(20 + (total === 0 ? 0 : (done / total) * 6)),
          importRunId,
          audit: audit!,
        });
      });
    }

    onProgress({
      phase: "parsed",
      message: "Matching products to existing skuIds…",
      percent: 26,
      importRunId,
      audit,
    });

    const existingByKey = await loadExistingProductKeys(db);
    const resolved = resolveSkuImportIds(products, suppliers, existingByKey);
    products = resolved.products;
    suppliers = resolved.suppliers;
    productsCreated = resolved.productsCreated;
    productsUpdated = resolved.productsUpdated;
    audit = {
      ...audit,
      productsAppended: productsCreated,
      productsUpdated,
    };

    const skuIdsTouched = products.map((p) => p.skuId);

    onProgress({
      phase: "deleting",
      message: `Replacing supplier rows for ${skuIdsTouched.length} product(s)…`,
      percent: 28,
      importRunId,
      audit,
      productsCreated,
      productsUpdated,
    });

    deleted = await deleteSuppliersForSkuIds(db, skuIdsTouched, (d, t) => {
      onProgress({
        phase: "deleting",
        message: `Removed ${d} of ${t} prior supplier row(s)…`,
        percent: clampPercent(28 + (t === 0 ? 0 : (d / t) * 18)),
        deleteTotal: t,
        deleted: d,
        importRunId,
        audit: audit!,
        productsCreated,
        productsUpdated,
      });
    });

    const writeTotal = products.length + suppliers.length;

    onProgress({
      phase: "writing",
      message:
        writeTotal === 0
          ? "No documents to write."
          : `Upserting ${products.length} product(s) (${productsCreated} new, ${productsUpdated} updated) and ${suppliers.length} supplier row(s)…`,
      percent: 48,
      writeTotal,
      written: 0,
      writtenProducts: 0,
      writtenSuppliers: 0,
      importRunId,
      audit,
      productsCreated,
      productsUpdated,
    });

    for (let i = 0; i < products.length; i += WRITE_BATCH_SIZE) {
      const chunk = products.slice(i, i + WRITE_BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        const ref = db.collection(DATA_SKUS_COLLECTION).doc(row.skuId);
        batch.set(ref, dataSkuToFirestore(row, importRunId));
      }
      await batch.commit();
      writtenProducts += chunk.length;
      const done = writtenProducts + writtenSuppliers;
      onProgress({
        phase: "writing",
        message: `Written ${writtenProducts} product(s), ${writtenSuppliers} supplier(s)…`,
        percent: clampPercent(48 + (writeTotal === 0 ? 1 : (done / writeTotal) * 50)),
        writeTotal,
        written: done,
        writtenProducts,
        writtenSuppliers,
        importRunId,
        audit,
        productsCreated,
        productsUpdated,
      });
    }

    for (let i = 0; i < suppliers.length; i += WRITE_BATCH_SIZE) {
      const chunk = suppliers.slice(i, i + WRITE_BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        const docId = `${row.skuId}_${row.supplierOption}`;
        const ref = db.collection(DATA_SKU_SUPPLIERS_COLLECTION).doc(docId);
        batch.set(ref, dataSkuSupplierToFirestore(row, importRunId));
      }
      await batch.commit();
      writtenSuppliers += chunk.length;
      const done = writtenProducts + writtenSuppliers;
      onProgress({
        phase: "writing",
        message: `Written ${writtenProducts} product(s), ${writtenSuppliers} supplier(s)…`,
        percent: clampPercent(48 + (writeTotal === 0 ? 1 : (done / writeTotal) * 50)),
        writeTotal,
        written: done,
        writtenProducts,
        writtenSuppliers,
        importRunId,
        audit,
        productsCreated,
        productsUpdated,
      });
    }

    onProgress({
      phase: "deleting",
      message: "Removing orphan supplier rows (no parent product)…",
      percent: 96,
      importRunId,
      audit,
      productsCreated,
      productsUpdated,
    });

    orphansDeleted = await deleteOrphanSuppliers(db, (d, t) => {
      onProgress({
        phase: "deleting",
        message: `Removed ${d} of ${t} orphan supplier row(s)…`,
        percent: clampPercent(96 + (t === 0 ? 0 : (d / t) * 3)),
        importRunId,
        audit: audit!,
        orphansDeleted: d,
        productsCreated,
        productsUpdated,
      });
    });

    deleted += orphansDeleted;

    if (options.removeProductsNotInSheet) {
      onProgress({
        phase: "deleting",
        message: "Removing products not on sheet (isCurrent=false)…",
        percent: 97,
        importRunId,
        audit,
        productsCreated,
        productsUpdated,
      });

      const removed = sourceConfig.markAllProductsNotCurrent
        ? await deleteProductsNotInSheet(db, (ev) => {
            onProgress({
              phase: "deleting",
              message:
                ev.phase === "suppliers"
                  ? `Removed ${ev.deleted} of ${ev.total} supplier row(s) for off-sheet products…`
                  : `Removed ${ev.deleted} of ${ev.total} off-sheet product(s)…`,
              percent: clampPercent(
                97 +
                  (ev.phase === "suppliers"
                    ? ev.total === 0
                      ? 0
                      : (ev.deleted / ev.total) * 1.5
                    : 1.5 + (ev.total === 0 ? 0 : (ev.deleted / ev.total) * 1.5)),
              ),
              importRunId,
              audit: audit!,
              productsCreated,
              productsUpdated,
              productsRemovedNotInSheet,
              suppliersRemovedNotInSheet,
            });
          })
        : await deleteProductsNotInSheetForCategories(db, sheetCategories, (ev) => {
            onProgress({
              phase: "deleting",
              message:
                ev.phase === "suppliers"
                  ? `Removed ${ev.deleted} of ${ev.total} supplier row(s) for off-sheet tab products…`
                  : `Removed ${ev.deleted} of ${ev.total} off-sheet tab product(s)…`,
              percent: clampPercent(
                97 +
                  (ev.phase === "suppliers"
                    ? ev.total === 0
                      ? 0
                      : (ev.deleted / ev.total) * 1.5
                    : 1.5 + (ev.total === 0 ? 0 : (ev.deleted / ev.total) * 1.5)),
              ),
              importRunId,
              audit: audit!,
              productsCreated,
              productsUpdated,
              productsRemovedNotInSheet,
              suppliersRemovedNotInSheet,
            });
          });
      productsRemovedNotInSheet = removed.productsDeleted;
      suppliersRemovedNotInSheet = removed.suppliersDeleted;
      deleted += productsRemovedNotInSheet + suppliersRemovedNotInSheet;
    }

    const written = writtenProducts + writtenSuppliers;
    const status = deriveStatus(audit, written);
    let logSaveWarning: string | undefined;
    try {
      await saveDataSkusImportLog(db, {
        importRunId,
        kind: sourceConfig.importLogKind,
        status,
        tabTitle: fetched.tabTitle,
        sheetRange: fetched.range,
        gid: fetched.gid,
        audit,
        deletedFromFirestore: deleted,
        writtenToFirestore: written,
        writtenProducts,
        writtenSuppliers,
        productsAppended: productsCreated,
        productsUpdated,
      });
    } catch (logErr) {
      logSaveWarning =
        logErr instanceof Error ? logErr.message : "Failed to save importlog document";
      console.error("importlog save failed:", logErr);
    }

    const removedSummary =
      productsRemovedNotInSheet > 0
        ? `, ${productsRemovedNotInSheet} off-sheet product(s) deleted`
        : "";

    onProgress({
      phase: "done",
      message: logSaveWarning
        ? `Import complete — ${productsCreated} new, ${productsUpdated} updated, ${writtenSuppliers} supplier(s), ${orphansDeleted} orphan(s) removed${removedSummary}. importlog save failed: ${logSaveWarning}`
        : `Import complete — ${productsCreated} new, ${productsUpdated} updated, ${writtenSuppliers} supplier(s), ${orphansDeleted} orphan(s) removed${removedSummary}.`,
      percent: 100,
      tabTitle: fetched.tabTitle,
      gid: fetched.gid,
      sheetRange: fetched.range,
      parsedProducts: products.length,
      parsedSuppliers: suppliers.length,
      skippedEmptyRows: audit.blankRowsSkipped,
      deleteTotal: deleted,
      deleted,
      writeTotal,
      written,
      writtenProducts,
      writtenSuppliers,
      productsCreated,
      productsUpdated,
      productsRemovedNotInSheet,
      suppliersRemovedNotInSheet,
      warnings: audit.warnings,
      audit,
      importRunId,
      importLogId: importRunId,
    });

    return {
      importRunId,
      written,
      deleted,
      writtenProducts,
      writtenSuppliers,
      productsCreated,
      productsUpdated,
      productsRemovedNotInSheet,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failAudit: ImportLogAudit = audit ?? {
      headerRow1Based: 0,
      dataStartRow1Based: 0,
      detectedHeaderLabels: [],
      mappedFieldNames: [],
      apiRowsReturned: 0,
      sheetGridRowCount: null,
      totalDataRowsScanned: 0,
      blankRowsSkipped: 0,
      customElevateRowsSkipped: 0,
      nonBlankRows: 0,
      importedRows: 0,
      productsImported: 0,
      productsAppended: 0,
      productsUpdated: 0,
      suppliersImported: 0,
      skippedInvalidRows: 0,
      unmappedHeaders: [],
      warnings: [message],
      skippedRowSamples: [],
      customElevateSkippedSamples: [],
      dataErrors: [],
    };

    try {
      await saveDataSkusImportLog(db, {
        importRunId,
        kind: sourceConfig.importLogKind,
        status: "failed",
        tabTitle: fetched?.tabTitle ?? sourceConfig.requiredTabTitle,
        sheetRange: fetched?.range ?? "",
        gid: fetched?.gid ?? 0,
        audit: failAudit,
        deletedFromFirestore: deleted,
        writtenToFirestore: writtenProducts + writtenSuppliers,
        writtenProducts,
        writtenSuppliers,
        errorMessage: message,
      });
    } catch (logErr) {
      console.error("Failed to save importlog:", logErr);
    }

    const wroteData = writtenProducts + writtenSuppliers > 0;
    onProgress({
      phase: wroteData ? "done" : "error",
      message: wroteData
        ? `Imported ${writtenProducts + writtenSuppliers} document(s) but finished with error: ${message}`
        : message,
      percent: wroteData ? 100 : 0,
      error: message,
      audit: failAudit,
      importRunId,
      importLogId: importRunId,
      written: writtenProducts + writtenSuppliers,
      writtenProducts,
      writtenSuppliers,
      deleted,
      productsCreated,
      productsUpdated,
    });

    if (!wroteData) {
      throw err;
    }

    return {
      importRunId,
      written: writtenProducts + writtenSuppliers,
      deleted,
      writtenProducts,
      writtenSuppliers,
      productsCreated,
      productsUpdated,
      productsRemovedNotInSheet,
    };
  }
}

function dataSkuToFirestore(row: DataSku, importRunId: string): Record<string, unknown> {
  return {
    skuId: row.skuId,
    category: row.category,
    productType: row.productType,
    product: row.product,
    elevateLevel: row.elevateLevel,
    style: row.style,
    colourOptions: row.colourOptions,
    uom: row.uom,
    append1Type: row.append1Type,
    append1Spec: row.append1Spec,
    append2Type: row.append2Type,
    append2Spec: row.append2Spec,
    append3Type: row.append3Type,
    append3Spec: row.append3Spec,
    stockAvailable: row.stockAvailable,
    leadTime: row.leadTime,
    location: row.location,
    comments: row.comments,
    sourceSheetRows: row.sourceSheetRows,
    isCurrent: true,
    importRunId,
    importedAt: FieldValue.serverTimestamp(),
  };
}

function dataSkuSupplierToFirestore(
  row: DataSkuSupplier,
  importRunId: string,
): Record<string, unknown> {
  return {
    skuId: row.skuId,
    supplierOption: row.supplierOption,
    supplier: row.supplier,
    model: row.model,
    supplierSku: row.supplierSku,
    link: row.link,
    priceIncGst: row.priceIncGst,
    priceExcGst: row.priceExcGst,
    sourceSheetRows: row.sourceSheetRows,
    importRunId,
    importedAt: FieldValue.serverTimestamp(),
  };
}
