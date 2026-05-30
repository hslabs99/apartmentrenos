"use client";

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

  return (
    <section className={`${sfDataSurface} flex flex-col gap-4 p-4 md:p-5`}>
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

      {(log.dataErrors ?? log.audit?.dataErrors ?? []).length > 0 ? (
        <details open className="text-sm">
          <summary className="cursor-pointer font-medium text-amber-900 dark:text-amber-200">
            Data errors ({(log.dataErrors ?? log.audit?.dataErrors ?? []).length}) — fix in
            spreadsheet
          </summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-sf-border dark:border-zinc-700">
                  <th className="py-1 pr-2">Workbook row</th>
                  <th className="py-1 pr-2">Code</th>
                  <th className="py-1 pr-2">Parsed key</th>
                  <th className="py-1">Message</th>
                </tr>
              </thead>
              <tbody>
                {(log.dataErrors ?? log.audit?.dataErrors ?? []).map((row) => (
                  <tr
                    key={`${row.sheetRowNumber}-${row.code}`}
                    className="border-b border-sf-border/60 dark:border-zinc-800"
                  >
                    <td className="py-1 pr-2 font-mono">{row.sheetRowNumber}</td>
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
