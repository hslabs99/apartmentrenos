"use client";

import { masterPricesSpreadsheetRowUrl } from "@/lib/google/master-prices-spreadsheet";
import {
  importLogCustomElevateRowsSkipped,
  importLogDataErrors,
  importLogSkippedCustomElevateSamples,
} from "@/lib/import-log-error-rows";
import { sfDataSurface } from "@/lib/sf-layout";
import type { ImportLogPublic } from "@/types/import-log-types";

function statusColor(status: ImportLogPublic["status"]): string {
  switch (status) {
    case "success":
      return "text-green-800 dark:text-green-400";
    case "partial":
      return "text-amber-800 dark:text-amber-300";
    case "failed":
      return "text-red-800 dark:text-red-300";
    default:
      return "";
  }
}

export function ImportLogAuditPanel({ log }: { log: ImportLogPublic }) {
  const { summary } = log;
  const invalidSamples =
    log.skippedInvalidSamples ??
    log.audit?.skippedRowSamples.filter((s) => s.status === "skipped_invalid") ??
    [];
  const dataErrors = importLogDataErrors(log);
  const customElevateSkipped = importLogSkippedCustomElevateSamples(log);
  const customElevateCount = importLogCustomElevateRowsSkipped(log);
  const sheetGid = log.gid;

  return (
    <section id="import-data-errors" className={`${sfDataSurface} flex flex-col gap-4 p-4 md:p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
          importlog record
        </h2>
        <span className={`text-sm font-medium capitalize ${statusColor(log.status)}`}>
          {log.status}
        </span>
      </div>
      <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
        Run <code className="text-[0.7rem]">{log.importRunId}</code> ·{" "}
        {new Date(log.completedAt).toLocaleString()}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] border-collapse text-left text-sm">
          <tbody>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Tab</th>
              <td className="py-2">{log.tabTitle}</td>
            </tr>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Rows found</th>
              <td className="py-2 tabular-nums font-semibold">{summary.rowsFound}</td>
            </tr>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Blank rows</th>
              <td className="py-2 tabular-nums">{summary.blankRows}</td>
            </tr>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Products appended</th>
              <td className="py-2 tabular-nums font-semibold text-green-800 dark:text-green-400">
                {summary.productsAppended}
              </td>
            </tr>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Products updated</th>
              <td className="py-2 tabular-nums font-semibold text-blue-800 dark:text-blue-400">
                {summary.productsUpdated}
              </td>
            </tr>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Suppliers</th>
              <td className="py-2 tabular-nums font-semibold text-green-800 dark:text-green-400">
                {summary.suppliersImported}
              </td>
            </tr>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Error rows</th>
              <td className="py-2 tabular-nums text-amber-800 dark:text-amber-300">
                {summary.errorRows}
              </td>
            </tr>
            {customElevateCount > 0 ? (
              <tr className="border-b border-sf-border dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium text-sf-text-secondary">
                  Custom elevate skipped
                </th>
                <td className="py-2 tabular-nums text-sf-text-secondary dark:text-zinc-300">
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("import-custom-elevate-skipped")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className="text-sf-brand underline decoration-sf-brand/40 underline-offset-2 hover:decoration-sf-brand dark:text-[#58a9f5]"
                  >
                    {customElevateCount}
                  </button>
                </td>
              </tr>
            ) : null}
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Header row</th>
              <td className="py-2 tabular-nums">{summary.headerRow}</td>
            </tr>
            <tr className="border-b border-sf-border dark:border-zinc-800">
              <th className="py-2 pr-4 font-medium text-sf-text-secondary">Deleted prior</th>
              <td className="py-2 tabular-nums">{log.deletedPrior}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {log.warnings && log.warnings.length > 0 ? (
        <details className="text-sm text-amber-900 dark:text-amber-200">
          <summary className="cursor-pointer font-medium">
            {log.warnings.length} warning(s)
          </summary>
          <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto">
            {log.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {customElevateSkipped.length > 0 ? (
        <details id="import-custom-elevate-skipped" open className="text-sm">
          <summary className="cursor-pointer font-medium text-sf-text-secondary dark:text-zinc-300">
            Custom elevate skipped ({customElevateCount}
            {customElevateSkipped.length < customElevateCount
              ? ` — showing ${customElevateSkipped.length}`
              : ""}
            ) — column D is Custom
          </summary>
          <p className="mt-1 text-xs text-sf-text-secondary dark:text-zinc-400">
            These rows are intentionally excluded from import. Open in Google Sheets to review.
          </p>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full min-w-[500px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-sf-border dark:border-zinc-700">
                  <th className="py-1 pr-2">Sheet row</th>
                  <th className="py-1 pr-2">Category</th>
                  <th className="py-1 pr-2">Product</th>
                  <th className="py-1">Reason</th>
                </tr>
              </thead>
              <tbody>
                {customElevateSkipped.map((row) => (
                  <tr
                    key={`custom-elevate-${row.sheetRowNumber}`}
                    className="border-b border-sf-border/60 dark:border-zinc-800"
                  >
                    <td className="py-1 pr-2 font-mono align-top">
                      {sheetGid > 0 ? (
                        <a
                          href={masterPricesSpreadsheetRowUrl(sheetGid, row.sheetRowNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                          title="Open this row in Google Sheets"
                        >
                          {row.sheetRowNumber}
                        </a>
                      ) : (
                        row.sheetRowNumber
                      )}
                    </td>
                    <td className="py-1 pr-2">{row.category ?? "—"}</td>
                    <td className="py-1 pr-2 max-w-[200px] truncate">{row.product ?? "—"}</td>
                    <td className="py-1 text-sf-text-secondary dark:text-zinc-400">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {dataErrors.length > 0 ? (
        <details open className="text-sm">
          <summary className="cursor-pointer font-medium text-amber-900 dark:text-amber-200">
            Data errors ({dataErrors.length}) — fix in spreadsheet
          </summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-sf-border dark:border-zinc-700">
                  <th className="py-1 pr-2">Sheet row</th>
                  <th className="py-1 pr-2">Code</th>
                  <th className="py-1 pr-2">Parsed key</th>
                  <th className="py-1">Message</th>
                </tr>
              </thead>
              <tbody>
                {dataErrors.map((row) => (
                  <tr
                    key={`${row.sheetRowNumber}-${row.triggerSheetRowNumber ?? ""}-${row.code}-${row.message}`}
                    className="border-b border-sf-border/60 dark:border-zinc-800"
                  >
                    <td className="py-1 pr-2 font-mono align-top">
                      {sheetGid > 0 ? (
                        <a
                          href={masterPricesSpreadsheetRowUrl(sheetGid, row.sheetRowNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                          title="Open this row in Google Sheets"
                        >
                          {row.sheetRowNumber}
                        </a>
                      ) : (
                        row.sheetRowNumber
                      )}
                      {row.triggerSheetRowNumber != null ? (
                        <span className="mt-0.5 block text-[0.65rem] font-sans text-sf-text-secondary dark:text-zinc-400">
                          {sheetGid > 0 ? (
                            <>
                              option row{" "}
                              <a
                                href={masterPricesSpreadsheetRowUrl(
                                  sheetGid,
                                  row.triggerSheetRowNumber,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                              >
                                {row.triggerSheetRowNumber}
                              </a>
                            </>
                          ) : (
                            <>option row {row.triggerSheetRowNumber}</>
                          )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1 pr-2 font-mono text-[0.65rem]">{row.code}</td>
                    <td className="max-w-[14rem] py-1 pr-2 align-top text-[0.65rem] text-sf-text-secondary dark:text-zinc-400">
                      {row.productKey ? (
                        <span className="block whitespace-pre-wrap">
                          {row.productKey.category || "∅"} · {row.productKey.productType || "∅"} ·{" "}
                          {row.productKey.product || "∅"} · {row.productKey.elevateLevel || "∅"} ·{" "}
                          {row.productKey.style || "∅"} · {row.productKey.colourOptions || "∅"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1 text-amber-900 dark:text-amber-200">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      {invalidSamples.length > 0 ? (
        <details open className="text-sm">
          <summary className="cursor-pointer font-medium text-sf-text dark:text-zinc-200">
            Error row details ({invalidSamples.length}
            {summary.errorRows > invalidSamples.length
              ? ` of ${summary.errorRows}`
              : ""}
            )
          </summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-sf-border dark:border-zinc-700">
                  <th className="py-1 pr-2">Sheet row</th>
                  <th className="py-1 pr-2">SKU</th>
                  <th className="py-1 pr-2">Category</th>
                  <th className="py-1 pr-2">Product</th>
                  <th className="py-1">Reason</th>
                </tr>
              </thead>
              <tbody>
                {invalidSamples.map((row) => (
                  <tr
                    key={row.sheetRowNumber}
                    className="border-b border-sf-border/60 dark:border-zinc-800"
                  >
                    <td className="py-1 pr-2 font-mono">{row.sheetRowNumber}</td>
                    <td className="py-1 pr-2">{row.sku ?? "—"}</td>
                    <td className="py-1 pr-2">{row.category ?? "—"}</td>
                    <td className="py-1 pr-2 max-w-[200px] truncate">
                      {row.product ?? "—"}
                    </td>
                    <td className="py-1 text-amber-900 dark:text-amber-200">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
