"use client";

import { importLogDataErrors, importLogCustomElevateRowsSkipped, importLogCustomElevateSheetRows, importLogErrorSheetRows } from "@/lib/import-log-error-rows";
import { masterPricesSpreadsheetRowUrl } from "@/lib/google/master-prices-spreadsheet";
import type { ImportLogPublic, ImportLogStatus } from "@/types/import-log-types";

type Props = {
  log: ImportLogPublic;
  statusOverride?: ImportLogStatus | "running";
};

function statusLabel(status: ImportLogStatus | "running"): string {
  switch (status) {
    case "success":
      return "Import succeeded";
    case "partial":
      return "Import completed with issues";
    case "failed":
      return "Import failed";
    case "running":
      return "Import in progress…";
    default:
      return status;
  }
}

function statusBorder(status: ImportLogStatus | "running"): string {
  switch (status) {
    case "success":
      return "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30";
    case "partial":
      return "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30";
    case "failed":
      return "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30";
    default:
      return "border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900/50";
  }
}

export function ImportSummaryBanner({ log, statusOverride }: Props) {
  const status = statusOverride ?? log.status;
  const { summary } = log;
  const dataErrors = importLogDataErrors(log);
  const errorSheetRows = importLogErrorSheetRows(log);
  const customElevateCount = importLogCustomElevateRowsSkipped(log);
  const customElevateSheetRows = importLogCustomElevateSheetRows(log);
  const hasErrorDetails = summary.errorRows > 0 && dataErrors.length > 0;
  const hasCustomElevateDetails = customElevateCount > 0 && customElevateSheetRows.length > 0;

  const scrollToErrorDetails = () => {
    document.getElementById("import-data-errors")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToCustomElevateDetails = () => {
    document.getElementById("import-custom-elevate-skipped")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      className={`rounded-lg border p-4 md:p-5 ${statusBorder(status)}`}
      aria-live="polite"
    >
      <p className="text-base font-semibold text-sf-text dark:text-zinc-100">
        {statusLabel(status)}
      </p>
      <p className="mt-1 text-sm text-sf-text-secondary dark:text-zinc-300">
        Connected to sheet:{" "}
        <strong className="text-sf-text dark:text-zinc-100">{log.tabTitle}</strong>
        {log.gid ? (
          <span className="text-sf-text-weak dark:text-zinc-500"> (gid {log.gid})</span>
        ) : null}
      </p>

      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            Rows found
          </span>
          <span className="tabular-nums text-lg font-semibold">{summary.rowsFound}</span>
        </li>
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            Blank rows
          </span>
          <span className="tabular-nums text-lg font-semibold">{summary.blankRows}</span>
        </li>
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            Appended
          </span>
          <span className="tabular-nums text-lg font-semibold text-green-800 dark:text-green-400">
            {summary.productsAppended}
          </span>
        </li>
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            Updated
          </span>
          <span className="tabular-nums text-lg font-semibold text-blue-800 dark:text-blue-400">
            {summary.productsUpdated}
          </span>
        </li>
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            Suppliers
          </span>
          <span className="tabular-nums text-lg font-semibold text-green-800 dark:text-green-400">
            {summary.suppliersImported}
          </span>
        </li>
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            Error rows
          </span>
          {hasErrorDetails ? (
            <button
              type="button"
              onClick={scrollToErrorDetails}
              className="tabular-nums text-lg font-semibold text-amber-800 underline decoration-amber-400/60 underline-offset-2 hover:decoration-amber-600 dark:text-amber-300"
            >
              {summary.errorRows}
            </button>
          ) : (
            <span className="tabular-nums text-lg font-semibold text-amber-800 dark:text-amber-300">
              {summary.errorRows}
            </span>
          )}
        </li>
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            Header row
          </span>
          <span className="tabular-nums text-lg font-semibold">{summary.headerRow}</span>
        </li>
        <li className="rounded bg-white/60 px-3 py-2 dark:bg-zinc-950/40">
          <span className="block text-xs uppercase tracking-wide text-sf-text-weak">
            API rows
          </span>
          <span className="tabular-nums text-lg font-semibold">{summary.apiRowsReturned}</span>
        </li>
      </ul>

      {hasCustomElevateDetails && log.gid > 0 ? (
        <div className="mt-4 rounded border border-sf-border bg-white/50 p-3 dark:border-zinc-700 dark:bg-zinc-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-sf-text-secondary dark:text-zinc-300">
            Custom elevate skipped ({customElevateCount})
          </p>
          <p className="mt-1 text-xs text-sf-text-secondary dark:text-zinc-400">
            Column D is Custom — these rows are excluded from import.
          </p>
          <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {customElevateSheetRows.map((row) => (
              <a
                key={`ce-${row}`}
                href={masterPricesSpreadsheetRowUrl(log.gid, row)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-7 items-center rounded border border-sf-border bg-sf-page px-2 py-0.5 font-mono text-xs text-sf-text hover:bg-sf-surface dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {row}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={scrollToCustomElevateDetails}
            className="mt-2 text-xs text-sf-brand hover:underline dark:text-[#58a9f5]"
          >
            View full list below
          </button>
        </div>
      ) : null}

      {hasErrorDetails && log.gid > 0 && errorSheetRows.length > 0 ? (
        <div className="mt-4 rounded border border-amber-200/80 bg-white/50 p-3 dark:border-amber-900/50 dark:bg-zinc-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-200">
            Error sheet rows ({errorSheetRows.length})
          </p>
          <p className="mt-1 text-xs text-sf-text-secondary dark:text-zinc-400">
            Open in Google Sheets — row numbers match the spreadsheet row column.
          </p>
          <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {errorSheetRows.map((row) => (
              <a
                key={row}
                href={masterPricesSpreadsheetRowUrl(log.gid, row)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-7 items-center rounded border border-amber-300/80 bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
              >
                {row}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={scrollToErrorDetails}
            className="mt-2 text-xs text-sf-brand hover:underline dark:text-[#58a9f5]"
          >
            View full error details below
          </button>
        </div>
      ) : null}

      <p className="mt-3 text-sm text-sf-text-secondary dark:text-zinc-400">
        Found <strong>{summary.rowsFound}</strong> sheet row(s) — skipped{" "}
        <strong>{summary.blankRows}</strong> blank. Products:{" "}
        <strong className="text-green-800 dark:text-green-400">{summary.productsAppended}</strong>{" "}
        appended,{" "}
        <strong className="text-blue-800 dark:text-blue-400">{summary.productsUpdated}</strong>{" "}
        updated,{" "}
        <strong className="text-green-800 dark:text-green-400">{summary.suppliersImported}</strong>{" "}
        supplier row(s) written.{" "}
        {hasErrorDetails ? (
          <>
            <button
              type="button"
              onClick={scrollToErrorDetails}
              className="font-semibold text-amber-800 underline decoration-amber-400/60 underline-offset-2 hover:decoration-amber-600 dark:text-amber-300"
            >
              {summary.errorRows} data error(s)
            </button>
            .{" "}
          </>
        ) : (
          <>
            <strong className="text-amber-800 dark:text-amber-300">{summary.errorRows}</strong> data
            error(s).{" "}
          </>
        )}
        Replaced <strong>{log.deletedPrior}</strong> prior supplier row(s) for updated products.
      </p>

      {log.errorMessage ? (
        <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-300">
          {log.errorMessage}
        </p>
      ) : null}
    </section>
  );
}
