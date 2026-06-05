"use client";

import { importLogCustomElevateRowsSkipped } from "@/lib/import-log-error-rows";
import { sfDataSurface } from "@/lib/sf-layout";
import type { ImportLogPublic } from "@/types/import-log-types";

type Props = {
  logs: ImportLogPublic[];
  selectedImportRunId: string | null;
  onSelect: (importRunId: string) => void;
};

function statusClass(status: ImportLogPublic["status"]): string {
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

export function ImportLogIndexPanel({ logs, selectedImportRunId, onSelect }: Props) {
  if (logs.length === 0) return null;

  return (
    <section className={`${sfDataSurface} flex flex-col gap-3 p-4 md:p-5`}>
      <div>
        <h2 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
          Import log index
        </h2>
        <p className="mt-1 text-xs text-sf-text-secondary dark:text-zinc-400">
          {logs.length} import run{logs.length === 1 ? "" : "s"} this session — select a row to
          view full details below.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-sf-border dark:border-zinc-700">
              <th className="py-2 pr-3 font-medium text-sf-text-secondary">Tab</th>
              <th className="py-2 pr-3 font-medium text-sf-text-secondary">Status</th>
              <th className="py-2 pr-3 font-medium text-sf-text-secondary tabular-nums">Appended</th>
              <th className="py-2 pr-3 font-medium text-sf-text-secondary tabular-nums">Updated</th>
              <th className="py-2 pr-3 font-medium text-sf-text-secondary tabular-nums">
                Suppliers
              </th>
              <th className="py-2 pr-3 font-medium text-sf-text-secondary tabular-nums">Errors</th>
              <th className="py-2 pr-3 font-medium text-sf-text-secondary tabular-nums">
                Custom elev.
              </th>
              <th className="py-2 pr-3 font-medium text-sf-text-secondary">Completed</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const selected = log.importRunId === selectedImportRunId;
              const customElevate = importLogCustomElevateRowsSkipped(log);
              return (
                <tr
                  key={log.importRunId}
                  className={`border-b border-sf-border/60 dark:border-zinc-800 ${
                    selected ? "bg-sf-brand/5 dark:bg-[#58a9f5]/10" : ""
                  }`}
                >
                  <td className="py-2 pr-3 align-top">
                    <button
                      type="button"
                      onClick={() => onSelect(log.importRunId)}
                      className={`text-left hover:underline ${
                        selected
                          ? "font-semibold text-sf-brand dark:text-[#58a9f5]"
                          : "text-sf-text dark:text-zinc-100"
                      }`}
                    >
                      {log.tabTitle}
                    </button>
                  </td>
                  <td className={`py-2 pr-3 capitalize align-top ${statusClass(log.status)}`}>
                    {log.status}
                  </td>
                  <td className="py-2 pr-3 tabular-nums align-top">{log.summary.productsAppended}</td>
                  <td className="py-2 pr-3 tabular-nums align-top">{log.summary.productsUpdated}</td>
                  <td className="py-2 pr-3 tabular-nums align-top">{log.summary.suppliersImported}</td>
                  <td className="py-2 pr-3 tabular-nums align-top text-amber-800 dark:text-amber-300">
                    {log.summary.errorRows}
                  </td>
                  <td className="py-2 pr-3 tabular-nums align-top">{customElevate}</td>
                  <td className="py-2 pr-3 align-top text-xs text-sf-text-secondary dark:text-zinc-400">
                    {log.completedAt
                      ? new Date(log.completedAt).toLocaleTimeString()
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
