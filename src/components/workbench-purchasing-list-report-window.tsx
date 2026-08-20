"use client";

import { ModalFrame } from "@/components/modal-frame";
import { formatMoney } from "@/lib/client/format-money";
import { formatProjectNoteDate } from "@/lib/project-note-display";
import type {
  WbPurchasingListLine,
  WbPurchasingListReportData,
} from "@/lib/workbench-purchasing-list-report";
import { WB_PURCHASING_LIST_REPORT_WINDOW_LABEL } from "@/lib/workbench-purchasing-list-report";

type Props = {
  data: WbPurchasingListReportData;
  onClose: () => void;
};

function money(n: number): string {
  return `$${formatMoney(n)}`;
}

function formatQty(n: number): string {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(n);
}

/** Buyer-facing UOM: linear metres, square metres, litres, each. */
function formatUom(uom: string): string {
  const t = uom.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower === "m2" || lower === "m²" || lower === "sqm" || lower === "sq m") return "m²";
  if (lower === "m3" || lower === "m³") return "m³";
  if (lower === "lm-runs" || lower === "lm runs" || lower === "lm") return "LM";
  if (lower === "ltr" || lower === "l" || lower === "litre" || lower === "litres") return "Ltr";
  if (lower === "unit" || lower === "ea" || lower === "each") return "ea";
  if (lower === "kg" || lower === "kgs") return "kg";
  return t;
}

function quantityLabel(line: WbPurchasingListLine): string {
  if (line.quantity == null) return "—";
  const uom = formatUom(line.uom);
  return uom ? `${formatQty(line.quantity)} ${uom}` : formatQty(line.quantity);
}

function productHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return `https://${t}`;
}

function SupplierProductCell({
  line,
  mutedClass,
  titleClass,
  linkClass,
}: {
  line: WbPurchasingListLine;
  mutedClass: string;
  titleClass: string;
  linkClass: string;
}) {
  const sku = line.supplierSku.trim();
  const model = line.model.trim();
  const fallback = line.description.trim();
  const title = line.objectType.trim() || fallback || "Item";
  const linkText = line.link.trim();
  const href = productHref(linkText);
  return (
    <div className="min-w-0">
      <p className={titleClass}>{title}</p>
      <p className={`mt-0.5 tabular-nums ${mutedClass}`}>{sku || "—"}</p>
      {model ? <p className={mutedClass}>{model}</p> : null}
      {!model && fallback && fallback.toLowerCase() !== title.toLowerCase() ? (
        <p className={mutedClass}>{fallback}</p>
      ) : null}
      {href ? (
        <p className="mt-1">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`break-all ${linkClass}`}
          >
            {linkText}
          </a>
        </p>
      ) : null}
    </div>
  );
}

function ScreenReportBody({ data }: { data: WbPurchasingListReportData }) {
  const printedLabel = formatProjectNoteDate(data.printedAt.toISOString());

  return (
    <>
      <header className="mb-6 border-b-2 border-sf-brand pb-5 dark:border-sf-accent">
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
        </div>
        <p className="mt-2 text-xs text-sf-text-weak dark:text-zinc-500">
          Subtotals are unit price × quantity, ex GST. Quantity shows the unit of measure (ea, LM,
          m², Ltr).
        </p>
      </header>

      {data.groups.length === 0 ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          No included products to purchase on this project.
        </p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-bold text-sf-brand dark:text-zinc-50">
              Amount required by supplier
            </h2>
            <p className="mt-1 text-xs text-sf-text-weak dark:text-zinc-500">
              Totals to take to each supplier, then the item breakdown below.
            </p>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-sf-border text-left text-xs uppercase tracking-wide text-sf-text-weak dark:border-zinc-700 dark:text-zinc-500">
                  <th className="py-2 pr-3 font-semibold">Supplier</th>
                  <th className="py-2 pr-3 text-right font-semibold">Items</th>
                  <th className="py-2 text-right font-semibold">Total ex GST</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((group) => (
                  <tr
                    key={`summary-${group.supplier}`}
                    className="border-b border-sf-border/80 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-3 font-medium text-sf-text dark:text-zinc-100">
                      {group.supplier}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-sf-text-secondary dark:text-zinc-400">
                      {group.itemCount}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums text-sf-text dark:text-zinc-100">
                      {money(group.totalExcGst)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-sf-brand dark:border-sf-accent">
                  <td className="py-2.5 pr-3 font-bold text-sf-brand dark:text-zinc-50">
                    Grand total
                  </td>
                  <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-sf-brand dark:text-zinc-50">
                    {data.lineCount}
                  </td>
                  <td className="py-2.5 text-right font-bold tabular-nums text-sf-brand dark:text-emerald-300">
                    {money(data.grandTotalExcGst)}
                    <span className="ml-1 text-[10px] font-semibold uppercase text-sf-text-weak">
                      ex GST
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

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
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-sf-border text-left text-xs uppercase tracking-wide text-sf-text-weak dark:border-zinc-700 dark:text-zinc-500">
                    <th className="py-2 pr-3 font-semibold">Supplier Product (SKU, model)</th>
                    <th className="py-2 pr-3 text-right font-semibold">Unit Price</th>
                    <th className="py-2 pr-3 text-right font-semibold">Quantity</th>
                    <th className="py-2 text-right font-semibold">Sub Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map((line, i) => (
                    <tr
                      key={`${group.supplier}-${line.supplierSku}-${line.catalogSkuId}-${i}`}
                      className="border-b border-sf-border/80 align-top dark:border-zinc-800"
                    >
                      <td className="py-3 pr-3">
                        <SupplierProductCell
                          line={line}
                          titleClass="text-sm font-semibold text-sf-text dark:text-zinc-100"
                          mutedClass="text-xs text-sf-text-secondary dark:text-zinc-400"
                          linkClass="text-xs font-medium text-sf-brand underline underline-offset-2 hover:opacity-90 dark:text-[#58a9f5]"
                        />
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-sf-text dark:text-zinc-200">
                        {line.unitPrice != null ? money(line.unitPrice) : "—"}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-sf-text dark:text-zinc-200">
                        {quantityLabel(line)}
                      </td>
                      <td className="py-3 text-right font-bold tabular-nums text-sf-brand dark:text-emerald-300">
                        {line.subtotalExcGst != null ? money(line.subtotalExcGst) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          <span className="font-medium">Items:</span> {data.lineCount}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Subtotals are unit price × quantity, ex GST. Quantity includes unit of measure.
        </p>
      </header>

      {data.groups.length === 0 ? (
        <p className="text-sm text-zinc-600">No included products to purchase on this project.</p>
      ) : (
        <div className="space-y-8">
          <section className="break-inside-avoid">
            <h2 className="text-base font-semibold text-black">Amount required by supplier</h2>
            <table className="mt-2 w-full border-collapse text-sm text-black">
              <thead>
                <tr className="border-b border-zinc-300 text-left text-xs text-zinc-600">
                  <th className="py-1 pr-3 font-medium">Supplier</th>
                  <th className="py-1 pr-3 text-right font-medium">Items</th>
                  <th className="py-1 text-right font-medium">Total ex GST</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((group) => (
                  <tr key={`print-summary-${group.supplier}`} className="border-b border-zinc-200">
                    <td className="py-1.5 pr-3">{group.supplier}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{group.itemCount}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(group.totalExcGst)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-400">
                  <td className="py-2 pr-3 font-semibold">Grand total</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {data.lineCount}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {money(data.grandTotalExcGst)} ex GST
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

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
                    <th className="py-1 pr-3 font-medium">Supplier Product (SKU, model)</th>
                    <th className="py-1 pr-3 text-right font-medium">Unit Price</th>
                    <th className="py-1 pr-3 text-right font-medium">Quantity</th>
                    <th className="py-1 text-right font-medium">Sub Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map((line, i) => (
                    <tr
                      key={`${group.supplier}-${line.supplierSku}-${i}`}
                      className="border-b border-zinc-200 align-top"
                    >
                      <td className="py-2 pr-3">
                        <SupplierProductCell
                          line={line}
                          titleClass="font-medium"
                          mutedClass="text-xs text-zinc-600"
                          linkClass="text-xs text-blue-800 underline"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {line.unitPrice != null ? money(line.unitPrice) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{quantityLabel(line)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {line.subtotalExcGst != null ? money(line.subtotalExcGst) : "—"}
                      </td>
                    </tr>
                  ))}
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
          panelClassName="sm:max-w-5xl"
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
