import {
  FieldValue,
  type DocumentData,
  type Firestore,
  type Timestamp,
} from "firebase-admin/firestore";
import { ensureImportlogBootstrap } from "@/lib/firestore/collection-bootstrap";
import { IMPORTLOG_COLLECTION } from "@/lib/firestore/importlog-collection";
import { sanitizeForFirestore } from "@/lib/server/sanitize-for-firestore";
import { auditToSummary, parseStoredImportLogKind } from "@/lib/import-log-utils";
import type {
  ImportLogAudit,
  ImportLogKind,
  ImportLogPublic,
  ImportLogStatus,
  ImportLogSummary,
} from "@/types/import-log-types";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";

export async function saveDataSkusImportLog(
  db: Firestore,
  params: {
    importRunId: string;
    kind: ImportLogKind;
    status: ImportLogStatus;
    tabTitle: string;
    sheetRange: string;
    gid?: number;
    audit: ImportLogAudit;
    deletedFromFirestore: number;
    writtenToFirestore: number;
    writtenProducts?: number;
    writtenSuppliers?: number;
    productsAppended?: number;
    productsUpdated?: number;
    errorMessage?: string;
  },
): Promise<void> {
  await ensureImportlogBootstrap(db);

  const summary: ImportLogSummary = {
    ...auditToSummary(params.audit),
    rowsImported: params.writtenToFirestore,
    productsImported: params.writtenProducts ?? params.audit.productsImported,
    productsAppended: params.productsAppended ?? params.audit.productsAppended,
    productsUpdated: params.productsUpdated ?? params.audit.productsUpdated,
    suppliersImported: params.writtenSuppliers ?? params.audit.suppliersImported,
  };

  const skippedInvalidSamples = params.audit.skippedRowSamples
    .filter((s) => s.status === "skipped_invalid")
    .slice(0, 50)
    .map((s) => ({
      sheetRowNumber: s.sheetRowNumber,
      status: s.status,
      reason: s.reason,
      sku: s.sku ?? null,
      category: s.category ?? null,
      product: s.product ?? null,
    }));

  const skippedCustomElevateSamples = params.audit.customElevateSkippedSamples
    .slice(0, 500)
    .map((s) => ({
      sheetRowNumber: s.sheetRowNumber,
      status: s.status,
      reason: s.reason,
      sku: s.sku ?? null,
      category: s.category ?? null,
      product: s.product ?? null,
    }));

  const warnings = params.audit.warnings.slice(0, 30);
  const dataErrors = params.audit.dataErrors.slice(0, 50);

  const payload = sanitizeForFirestore({
    importRunId: params.importRunId,
    kind: params.kind,
    status: params.status,
    tabTitle: params.tabTitle,
    gid: params.gid ?? 0,
    sheetRange: params.sheetRange,
    spreadsheetId: MASTER_PRICES_SPREADSHEET_ID,
    completedAt: FieldValue.serverTimestamp(),
    rowsFound: summary.rowsFound,
    blankRows: summary.blankRows,
    rowsImported: summary.rowsImported,
    productsImported: summary.productsImported,
    productsAppended: summary.productsAppended,
    productsUpdated: summary.productsUpdated,
    suppliersImported: summary.suppliersImported,
    errorRows: summary.errorRows,
    headerRow: summary.headerRow,
    apiRowsReturned: summary.apiRowsReturned,
    deletedPrior: params.deletedFromFirestore,
    errorMessage: params.errorMessage ?? null,
    warnings,
    skippedInvalidSamples,
    skippedCustomElevateSamples,
    customElevateRowsSkipped: params.audit.customElevateRowsSkipped,
    dataErrors,
  });

  await db.collection(IMPORTLOG_COLLECTION).doc(params.importRunId).set(payload);
}

export function importLogDocToPublic(id: string, data: DocumentData): ImportLogPublic {
  const completedAt = data.completedAt as Timestamp | undefined;

  const summary: ImportLogSummary = {
    rowsFound: Number(data.rowsFound ?? data.totalDataRowsScanned ?? 0),
    blankRows: Number(data.blankRows ?? data.blankRowsSkipped ?? 0),
    rowsImported: Number(data.rowsImported ?? data.writtenToFirestore ?? 0),
    productsImported: Number(data.productsImported ?? 0),
    productsAppended: Number(data.productsAppended ?? 0),
    productsUpdated: Number(data.productsUpdated ?? 0),
    suppliersImported: Number(data.suppliersImported ?? 0),
    errorRows: Number(data.errorRows ?? data.skippedInvalidRows ?? 0),
    headerRow: Number(data.headerRow ?? data.headerRow1Based ?? 0),
    apiRowsReturned: Number(data.apiRowsReturned ?? 0),
  };

  const audit = data.audit as ImportLogAudit | undefined;

  const kind = parseStoredImportLogKind(String(data.kind ?? "data_skus_import"));

  return {
    importRunId: id,
    kind,
    status: data.status as ImportLogStatus,
    tabTitle: String(data.tabTitle ?? ""),
    gid: typeof data.gid === "number" ? data.gid : 0,
    sheetRange: String(data.sheetRange ?? ""),
    completedAt: completedAt?.toDate?.()?.toISOString?.() ?? "",
    summary,
    deletedPrior: Number(data.deletedPrior ?? data.deletedFromFirestore ?? 0),
    errorMessage:
      typeof data.errorMessage === "string" && data.errorMessage
        ? data.errorMessage
        : undefined,
    warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : undefined,
    skippedInvalidSamples: Array.isArray(data.skippedInvalidSamples)
      ? (data.skippedInvalidSamples as ImportLogPublic["skippedInvalidSamples"])
      : undefined,
    skippedCustomElevateSamples: Array.isArray(data.skippedCustomElevateSamples)
      ? (data.skippedCustomElevateSamples as ImportLogPublic["skippedCustomElevateSamples"])
      : undefined,
    customElevateRowsSkipped:
      typeof data.customElevateRowsSkipped === "number"
        ? data.customElevateRowsSkipped
        : undefined,
    dataErrors: Array.isArray(data.dataErrors)
      ? (data.dataErrors as ImportLogPublic["dataErrors"])
      : undefined,
    audit,
  };
}
