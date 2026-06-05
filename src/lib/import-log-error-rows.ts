import type { ImportLogDataError, ImportLogPublic, ImportLogRowSample } from "@/types/import-log-types";

/** Unique 1-based sheet rows referenced in import data errors (origin + trigger rows). */
export function importLogErrorSheetRows(log: ImportLogPublic): number[] {
  const errors = log.dataErrors ?? log.audit?.dataErrors ?? [];
  const rows = new Set<number>();
  for (const err of errors) {
    if (err.sheetRowNumber > 0) rows.add(err.sheetRowNumber);
    if (err.triggerSheetRowNumber != null && err.triggerSheetRowNumber > 0) {
      rows.add(err.triggerSheetRowNumber);
    }
  }
  return [...rows].sort((a, b) => a - b);
}

export function importLogDataErrors(log: ImportLogPublic): ImportLogDataError[] {
  return log.dataErrors ?? log.audit?.dataErrors ?? [];
}

export function importLogCustomElevateRowsSkipped(log: ImportLogPublic): number {
  if (typeof log.customElevateRowsSkipped === "number") return log.customElevateRowsSkipped;
  if (typeof log.audit?.customElevateRowsSkipped === "number") {
    return log.audit.customElevateRowsSkipped;
  }
  return importLogSkippedCustomElevateSamples(log).length;
}

export function importLogSkippedCustomElevateSamples(log: ImportLogPublic): ImportLogRowSample[] {
  if (log.skippedCustomElevateSamples?.length) return log.skippedCustomElevateSamples;
  if (log.audit?.customElevateSkippedSamples?.length) {
    return log.audit.customElevateSkippedSamples;
  }
  return (
    log.audit?.skippedRowSamples.filter((s) => s.status === "skipped_custom_elevate") ?? []
  );
}

export function importLogCustomElevateSheetRows(log: ImportLogPublic): number[] {
  return importLogSkippedCustomElevateSamples(log)
    .map((s) => s.sheetRowNumber)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
}
