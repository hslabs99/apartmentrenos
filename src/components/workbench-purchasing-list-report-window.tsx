"use client";

import { ModalFrame } from "@/components/modal-frame";
import { formatMoney } from "@/lib/client/format-money";
import { formatProjectNoteDate } from "@/lib/project-note-display";
import type { WbPurchasingListReportData } from "@/lib/workbench-purchasing-list-report";
import { WB_PURCHASING_LIST_REPORT_WINDOW_LABEL } from "@/lib/workbench-purchasing-list-report";

type Props = {
  data: WbPurchasingListReportData;
  onClose: () => void;
};

function money(n: number): string {
  return `$${formatMoney(n)}`;
}

/** Screen preview — uses app tokens. */
function ScreenReportBody({ data }: { data: WbPurchasingListReportData }) {
  const printedLabel = formatProjectNoteDate(data.printedAt.toISOString());

  return (
    <>
      <header className="mb-8 border-b-2 border-sf-brand pb-5 dark:border-sf-accent">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sf-text-secondary dark:text-zinc-400">
          Workbench · Purchasing
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-sf-brand dark:text-zinc-50">
          {WB_PURCHASING_LIST_REPORT_WINDOW_LABEL}
        </h1>
        <p className="mt-3 text-lg font-semibold text-sf-text dark:text-zinc-100">
          {data.projectName}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-sf-text-secondary dark:text-zinc-400">
          <span>
            <span className="font-medium text-sf-text dark:text-zinc-200">Prepared:</span>{" "}
            {printedLabel}
          </span>
          <span>
            <span className="font-medium text-sf-text dark:text-zinc-200">Suppliers:</span>{" "}
            {data.groups.length}
          </span>
          <span>
            <span className="font-medium text-sf-text dark:text-zinc-200">Items:</span>{" "}
            {data.lineCount}
          </span>
          <span>
            <span className="font-medium text-sf-text dark:text-zinc-200">
              Total to purchase:
            </span>{" "}
            <span className="font-bold tabular-nums text-sf-brand dark:text-emerald-300">
              {money(data.grandTotalExcGst)}
            </span>{" "}
            <span className="text-xs">ex GST</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-sf-text-weak dark:text-zinc-500">
          Sorted by supplier. Unit prices ex GST. Use Print / Save PDF when ready.
        </p>
      </header>

      {data.groups.length === 0 ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          No included products to purchase on this project.
        </p>
      ) : (
        <div className="space-y-10">
          {data.groups.map((group) => (
            <section key={group.supplier}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-sf-border pb-2 dark:border-zinc-700">
                <h2 className="text-lg font-bold text-sf-brand dark:text-zinc-50">
                  {group.supplier}
                </h2>
                <div className="text-right text-xs">
                  <p className="font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-500">
                    {group.itemCount} item{group.itemCount === 1 ? "" : "s"} to purchase
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-sf-text dark:text-zinc-100">
                    Supplier total {money(group.totalExcGst)}{" "}
                    <span className="text-[10px] font-semibold uppercase text-sf-text-weak">
                      ex GST
                    </span>
                  </p>
                </div>
              </div>
              <ul className="space-y-3">
                {group.lines.map((line, i) => {
                  const title =
                    line.description.trim() ||
                    line.model.trim() ||
                    line.catalogSkuId ||
                    "Item";
                  const supplierDesc = line.model.trim();
                  return (
                    <li
                      key={`${group.supplier}-${line.supplierSku}-${line.catalogSkuId}-${i}`}
                      className="rounded-lg border border-sf-border bg-sf-page/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-sf-text dark:text-zinc-100">
                            {title}
                          </p>
                          {supplierDesc &&
                          supplierDesc.toLowerCase() !== title.toLowerCase() ? (
                            <p className="mt-0.5 text-sm text-sf-text-secondary dark:text-zinc-400">
                              {supplierDesc}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-base font-bold tabular-nums text-sf-brand dark:text-emerald-300">
                          {line.price != null ? money(line.price) : "—"}
                          <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-500">
                            ex GST
                          </span>
                        </p>
                      </div>
                      <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="shrink-0 font-medium text-sf-text-weak dark:text-zinc-500">
                            Supplier SKU
                          </dt>
                          <dd className="min-w-0 break-all tabular-nums text-sf-text dark:text-zinc-200">
                            {line.supplierSku || "—"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 font-medium text-sf-text-weak dark:text-zinc-500">
                            Catalog SKU
                          </dt>
                          <dd className="min-w-0 break-all tabular-nums text-sf-text dark:text-zinc-200">
                            {line.catalogSkuId || "—"}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Print-only markup — black ink, same pattern as trade reports.
 * Must stay outside the modal so print CSS can reveal it.
 */
function PrintReportBody({ data }: { data: WbPurchasingListReportData }) {
  const printedLabel = formatProjectNoteDate(data.printedAt.toISOString());

  return (
    <>
      <header className="mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-xl font-bold text-black">{WB_PURCHASING_LIST_REPORT_WINDOW_LABEL}</h1>
        <p className="mt-2 text-base font-semibold text-black">{data.projectName}</p>
        <p className="mt-2 text-sm text-zinc-700">
          <span className="font-medium">Prepared:</span> {printedLabel}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Suppliers:</span> {data.groups.length} ·{" "}
          <span className="font-medium">Items:</span> {data.lineCount} ·{" "}
          <span className="font-medium">Total to purchase:</span>{" "}
          {money(data.grandTotalExcGst)} ex GST
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Sorted by supplier. Unit prices ex GST.
        </p>
      </header>

      {data.groups.length === 0 ? (
        <p className="text-sm text-zinc-600">No included products to purchase on this project.</p>
      ) : (
        <div className="space-y-8">
          {data.groups.map((group) => (
            <section key={group.supplier} className="break-inside-avoid">
              <div className="mb-2 flex items-end justify-between gap-3 border-b border-zinc-300 pb-1">
                <h2 className="text-base font-semibold text-black">{group.supplier}</h2>
                <div className="text-right text-xs text-zinc-700">
                  <p>
                    {group.itemCount} item{group.itemCount === 1 ? "" : "s"} to purchase
                  </p>
                  <p className="font-semibold tabular-nums text-black">
                    Supplier total {money(group.totalExcGst)} ex GST
                  </p>
                </div>
              </div>
              <table className="mt-2 w-full border-collapse text-sm text-black">
                <thead>
                  <tr className="border-b border-zinc-300 text-left text-xs text-zinc-600">
                    <th className="py-1 pr-3 font-medium">Description</th>
                    <th className="py-1 pr-3 font-medium">Supplier SKU</th>
                    <th className="py-1 pr-3 font-medium">Catalog SKU</th>
                    <th className="py-1 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map((line, i) => {
                    const title =
                      line.description.trim() ||
                      line.model.trim() ||
                      line.catalogSkuId ||
                      "—";
                    const model = line.model.trim();
                    return (
                      <tr
                        key={`${group.supplier}-${line.supplierSku}-${i}`}
                        className="border-b border-zinc-200 align-top"
                      >
                        <td className="py-2 pr-3">
                          <span className="font-medium">{title}</span>
                          {model && model.toLowerCase() !== title.toLowerCase() ? (
                            <span className="mt-0.5 block text-xs text-zinc-600">{model}</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{line.supplierSku || "—"}</td>
                        <td className="py-2 pr-3 tabular-nums">{line.catalogSkuId || "—"}</td>
                        <td className="py-2 text-right tabular-nums">
                          {line.price != null ? money(line.price) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/** On-screen purchasing report for PDF print — no area breakdown. */
export function WorkbenchPurchasingListReportWindow({ data, onClose }: Props) {
  return (
    <>
      <div className="print:hidden">
        <ModalFrame
          title={WB_PURCHASING_LIST_REPORT_WINDOW_LABEL}
          description={`${data.projectName} · sorted by supplier`}
          onClose={onClose}
          wide
          panelClassName="sm:max-w-4xl"
          contentClassName="bg-sf-surface"
          footer={
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-11 rounded-lg bg-sf-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
              >
                Print / Save PDF
              </button>
            </div>
          }
        >
          <ScreenReportBody data={data} />
        </ModalFrame>
      </div>

      <div
        id="wb-purchasing-list-report-window"
        className="absolute left-0 top-0 hidden w-full bg-white text-black print:block"
        aria-hidden
      >
        <PrintReportBody data={data} />
      </div>
    </>
  );
}
