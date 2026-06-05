import type { ImportDataSkusProgress } from "@/lib/server/import-data-skus";
import { auditToSummary, importLogKindFromTabTitle } from "@/lib/import-log-utils";
import type { ImportLogPublic, ImportLogStatus } from "@/types/import-log-types";

function phaseToStatus(phase: ImportDataSkusProgress["phase"]): ImportLogStatus {
  if (phase === "done") return "success";
  if (phase === "error") return "failed";
  return "partial";
}

/** Build a display log from stream progress when Firestore log is not loaded yet. */
export function importLogFromProgress(
  event: ImportDataSkusProgress,
): ImportLogPublic | null {
  if (!event.audit || !event.importRunId) return null;

  const summary = auditToSummary(event.audit);
  if (event.written != null) {
    summary.rowsImported = event.written;
  }
  if (event.productsCreated != null) {
    summary.productsAppended = event.productsCreated;
  }
  if (event.productsUpdated != null) {
    summary.productsUpdated = event.productsUpdated;
  }

  const kind = importLogKindFromTabTitle(event.tabTitle ?? "");

  return {
    importRunId: event.importRunId,
    kind,
    status: phaseToStatus(event.phase),
    tabTitle: event.tabTitle ?? "unknown",
    gid: event.gid ?? 0,
    sheetRange: event.sheetRange ?? "",
    completedAt: new Date().toISOString(),
    summary,
    deletedPrior: event.deleted ?? 0,
    errorMessage: event.error,
    warnings: event.audit.warnings,
    skippedInvalidSamples: event.audit.skippedRowSamples.filter(
      (s) => s.status === "skipped_invalid",
    ),
    skippedCustomElevateSamples: event.audit.customElevateSkippedSamples,
    customElevateRowsSkipped: event.audit.customElevateRowsSkipped,
    dataErrors: event.audit.dataErrors,
    audit: event.audit,
  };
}
