import {
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";
import { ensureImportlogBootstrap } from "@/lib/firestore/collection-bootstrap";
import { IMPORTLOG_COLLECTION } from "@/lib/firestore/importlog-collection";
import { sanitizeForFirestore } from "@/lib/server/sanitize-for-firestore";
import type {
  ImportLogDataError,
  ImportLogKind,
  ImportLogStatus,
  ImportLogSummary,
} from "@/types/import-log-types";
import { MASTER_PRICES_SPREADSHEET_ID } from "@/lib/google/master-prices-spreadsheet";

export type SupportingImportLogKind =
  | "supporting_labour_rates"
  | "supporting_product_contractor_rates"
  | "supporting_building_elements"
  | "supporting_cascades"
  | "supporting_supplier_discounts"
  | "supporting_lists"
  | "supporting_incremental_labour";

export type SupportingImportLogParams = {
  importRunId: string;
  kind: SupportingImportLogKind;
  tabTitle: string;
  gid?: number;
  sheetRange: string;
  headerRow1Based?: number;
  rowsFound: number;
  blankRows?: number;
  rowsImported: number;
  rowsCreated?: number;
  rowsUpdated?: number;
  suppliersImported?: number;
  deletedPrior: number;
  parseErrors?: string[];
  errorMessage?: string;
  warnings?: string[];
};

function parseErrorToDataError(message: string, index: number): ImportLogDataError {
  const rowMatch = message.match(/Row\s+(\d+)\s*:/i);
  return {
    sheetRowNumber: rowMatch ? Number(rowMatch[1]) : index + 1,
    code: "incomplete_row",
    message,
    category: null,
    product: null,
  };
}

export function supportingImportStatus(
  params: Pick<
    SupportingImportLogParams,
    "parseErrors" | "rowsImported" | "errorMessage"
  >,
): ImportLogStatus {
  if (params.errorMessage) return "failed";
  const errorCount = params.parseErrors?.length ?? 0;
  if (errorCount > 0) return "partial";
  if (params.rowsImported === 0) return "failed";
  return "success";
}

function buildSummary(params: SupportingImportLogParams): ImportLogSummary {
  const errorRows = params.parseErrors?.length ?? 0;
  const rowsCreated = params.rowsCreated ?? params.rowsImported;
  const rowsUpdated = params.rowsUpdated ?? 0;
  return {
    rowsFound: params.rowsFound,
    blankRows: params.blankRows ?? 0,
    rowsImported: params.rowsImported,
    productsImported: params.rowsImported,
    productsAppended: rowsCreated,
    productsUpdated: rowsUpdated,
    suppliersImported: params.suppliersImported ?? 0,
    errorRows,
    headerRow: params.headerRow1Based ?? 0,
    apiRowsReturned: params.rowsFound,
  };
}

export async function saveSupportingImportLog(
  db: Firestore,
  params: SupportingImportLogParams,
): Promise<void> {
  await ensureImportlogBootstrap(db);

  const status = supportingImportStatus(params);
  const summary = buildSummary(params);
  const parseErrors = params.parseErrors ?? [];
  const dataErrors = parseErrors.slice(0, 50).map(parseErrorToDataError);
  const warnings = (params.warnings ?? []).slice(0, 30);

  const payload = sanitizeForFirestore({
    importRunId: params.importRunId,
    kind: params.kind,
    status,
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
    deletedPrior: params.deletedPrior,
    errorMessage: params.errorMessage ?? null,
    warnings,
    dataErrors,
  });

  await db.collection(IMPORTLOG_COLLECTION).doc(params.importRunId).set(payload);
}

export type SupportingImportRouteFallback = {
  tabTitle: string;
  sheetRange: string;
  gid?: number;
  kind: SupportingImportLogKind;
};

export function importRunIdFromError(e: unknown): string | undefined {
  if (e && typeof e === "object" && "importRunId" in e) {
    const id = (e as { importRunId?: unknown }).importRunId;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

/** Run a supporting import, persist importlog, return importRunId with the result. */
export async function runSupportingImportWithLog<T>(
  db: Firestore,
  fallback: SupportingImportRouteFallback,
  run: () => Promise<T>,
  mapSuccess: (result: T) => Omit<
    SupportingImportLogParams,
    "importRunId" | "kind" | "errorMessage"
  >,
): Promise<{ importRunId: string; result: T }> {
  const importRunId = crypto.randomUUID();
  try {
    const result = await run();
    const mapped = mapSuccess(result);
    await saveSupportingImportLog(db, {
      importRunId,
      kind: fallback.kind,
      tabTitle: mapped.tabTitle,
      gid: mapped.gid ?? fallback.gid,
      sheetRange: mapped.sheetRange,
      headerRow1Based: mapped.headerRow1Based,
      rowsFound: mapped.rowsFound,
      blankRows: mapped.blankRows,
      rowsImported: mapped.rowsImported,
      rowsCreated: mapped.rowsCreated,
      rowsUpdated: mapped.rowsUpdated,
      suppliersImported: mapped.suppliersImported,
      deletedPrior: mapped.deletedPrior,
      parseErrors: mapped.parseErrors,
      warnings: mapped.warnings,
    });
    return { importRunId, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await saveSupportingImportLog(db, {
      importRunId,
      kind: fallback.kind,
      tabTitle: fallback.tabTitle,
      gid: fallback.gid,
      sheetRange: fallback.sheetRange,
      rowsFound: 0,
      rowsImported: 0,
      deletedPrior: 0,
      errorMessage: message,
    });
    const err = e instanceof Error ? e : new Error(message);
    (err as Error & { importRunId?: string }).importRunId = importRunId;
    throw err;
  }
}
