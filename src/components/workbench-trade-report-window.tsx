"use client";

import { ModalFrame } from "@/components/modal-frame";
import { formatProjectNoteDate } from "@/lib/project-note-display";
import type {
  WbTradeReportData,
  WbTradeReportLine,
  WbTradeReportNoteItem,
} from "@/lib/workbench-trade-report";

type Props = {
  data: WbTradeReportData;
  onClose: () => void;
};

function formatQty(n: number): string {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(n);
}

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

function quantityLabel(line: WbTradeReportLine): string {
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

function InstallProductCell({
  line,
  mutedClass,
  titleClass,
  linkClass,
  noteClass,
}: {
  line: WbTradeReportLine;
  mutedClass: string;
  titleClass: string;
  linkClass: string;
  noteClass: string;
}) {
  const sku = line.supplierSku.trim();
  const model = line.model.trim();
  const fallback = line.skuProduct.trim();
  const title = line.objectType.trim() || fallback || "Install";
  const supplier = line.supplier.trim();
  const linkText = line.link.trim();
  const href = productHref(linkText);
  return (
    <div className="min-w-0">
      <p className={titleClass}>
        {line.bundled ? <span className={`${mutedClass} font-normal`}>↳ </span> : null}
        {title}
      </p>
      {supplier ? <p className={`mt-0.5 ${mutedClass}`}>{supplier}</p> : null}
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
      {line.lineNotes.trim() ? (
        <p className={`mt-1.5 whitespace-pre-wrap ${noteClass}`}>{line.lineNotes.trim()}</p>
      ) : null}
    </div>
  );
}

function NotesList({
  notes,
  variant,
}: {
  notes: WbTradeReportNoteItem[];
  variant: "screen" | "print";
}) {
  if (notes.length === 0) return null;
  const screen = variant === "screen";
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li
          key={n.id}
          className={
            screen
              ? "rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-3 dark:border-amber-700/60 dark:bg-amber-950/30"
              : "rounded border border-amber-400 bg-amber-50 p-3 text-sm text-black"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                screen
                  ? "inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 dark:bg-amber-800 dark:text-amber-50"
                  : "inline-flex rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950"
              }
            >
              Note
            </span>
            {n.objectLabel ? (
              <span
                className={
                  screen
                    ? "text-sm font-semibold text-sf-text dark:text-zinc-100"
                    : "text-sm font-semibold text-black"
                }
              >
                {n.objectLabel}
              </span>
            ) : null}
            <span
              className={
                screen
                  ? "text-xs text-sf-text-secondary dark:text-zinc-400"
                  : "text-xs text-zinc-700"
              }
            >
              {n.notetype}
              {n.author ? ` · ${n.author}` : ""}
              {n.notedatetime ? ` · ${formatProjectNoteDate(n.notedatetime)}` : ""}
            </span>
          </div>
          <p
            className={
              screen
                ? "mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-sf-text dark:text-zinc-200"
                : "mt-1 whitespace-pre-wrap leading-relaxed text-black"
            }
          >
            {n.text || "—"}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ScreenReportBody({ data }: { data: WbTradeReportData }) {
  const printedLabel = formatProjectNoteDate(data.printedAt.toISOString());
  const trade = data.config.label;

  return (
    <>
      <header className="mb-6 border-b-2 border-sf-brand pb-5 dark:border-sf-accent">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sf-text-secondary dark:text-zinc-400">
          Workbench · Trade
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-sf-brand dark:text-zinc-50">
          {trade} report
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
            <span className="font-medium text-sf-text dark:text-zinc-200">Installs:</span>{" "}
            {data.installCount}
          </span>
          <span>
            <span className="font-medium text-sf-text dark:text-zinc-200">Notes:</span>{" "}
            {data.noteCount}
          </span>
          <span>
            <span className="font-medium text-sf-text dark:text-zinc-200">Areas:</span>{" "}
            {data.areas.length}
          </span>
        </div>
        <p className="mt-2 text-xs text-sf-text-weak dark:text-zinc-500">
          Installs are products this trade will fit, with supplier SKU, description, and link.
          Notes are separate site instructions tagged {data.config.noteTradeTag}.
        </p>
      </header>

      {data.projectNotes.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-amber-800 dark:text-amber-300">
            Project notes
          </h2>
          <NotesList notes={data.projectNotes} variant="screen" />
        </section>
      ) : null}

      {data.areas.length === 0 && data.projectNotes.length === 0 ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          No {trade.toLowerCase()} installs or notes on this project.
        </p>
      ) : (
        <div className="space-y-10">
          {data.areas.map((area) => (
            <section key={area.areaid}>
              <h2 className="border-b border-sf-border pb-2 text-lg font-bold text-sf-brand dark:border-zinc-700 dark:text-zinc-50">
                {area.label}
              </h2>

              {area.retainItems.length > 0 ? (
                <div className="mt-4 rounded-lg border border-amber-500 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    Retain — do not remove
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-amber-950 dark:text-amber-100">
                    {area.retainItems.map((item) => (
                      <li key={item.objectLabel}>
                        <span className="font-semibold">{item.objectLabel}</span>
                        <ul className="mt-0.5 list-disc pl-5">
                          {item.labels.map((label) => (
                            <li key={label}>{label}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-sf-brand dark:text-emerald-300">
                    Installs
                  </h3>
                  <p className="text-xs text-sf-text-weak dark:text-zinc-500">
                    {area.installs.length} product
                    {area.installs.length === 1 ? "" : "s"} to install
                  </p>
                </div>
                {area.installs.length === 0 ? (
                  <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                    No {trade.toLowerCase()} installs in this area.
                  </p>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-sf-border text-left text-xs uppercase tracking-wide text-sf-text-weak dark:border-zinc-700 dark:text-zinc-500">
                        <th className="py-2 pr-3 font-semibold">
                          Product (supplier SKU, description)
                        </th>
                        <th className="py-2 pr-3 text-right font-semibold">Quantity</th>
                        <th className="py-2 text-right font-semibold">Labour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {area.installs.map((line) => (
                        <tr
                          key={line.id}
                          className="border-b border-sf-border/80 align-top dark:border-zinc-800"
                        >
                          <td className="py-3 pr-3">
                            <InstallProductCell
                              line={line}
                              titleClass="text-sm font-semibold text-sf-text dark:text-zinc-100"
                              mutedClass="text-xs text-sf-text-secondary dark:text-zinc-400"
                              linkClass="text-xs font-medium text-sf-brand underline underline-offset-2 hover:opacity-90 dark:text-[#58a9f5]"
                              noteClass="text-xs text-sf-text dark:text-zinc-300"
                            />
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-sf-text dark:text-zinc-200">
                            {quantityLabel(line)}
                          </td>
                          <td className="py-3 text-right tabular-nums text-sf-text-secondary dark:text-zinc-400">
                            {line.labourSummary}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    Notes
                  </h3>
                  <p className="text-xs text-sf-text-weak dark:text-zinc-500">
                    {area.notes.length} note{area.notes.length === 1 ? "" : "s"}
                  </p>
                </div>
                {area.notes.length === 0 ? (
                  <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                    No {trade.toLowerCase()} notes in this area.
                  </p>
                ) : (
                  <NotesList notes={area.notes} variant="screen" />
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function PrintReportBody({ data }: { data: WbTradeReportData }) {
  const printedLabel = formatProjectNoteDate(data.printedAt.toISOString());
  const trade = data.config.label;

  return (
    <>
      <header className="mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-xl font-bold text-black">{trade} report</h1>
        <p className="mt-2 text-base font-semibold text-black">{data.projectName}</p>
        <p className="mt-2 text-sm text-zinc-700">
          <span className="font-medium">Prepared:</span> {printedLabel}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Installs:</span> {data.installCount} ·{" "}
          <span className="font-medium">Notes:</span> {data.noteCount} ·{" "}
          <span className="font-medium">Areas:</span> {data.areas.length}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Installs list supplier SKU, description, and link. Notes are separate site instructions.
        </p>
      </header>

      {data.projectNotes.length > 0 ? (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold text-black">Project notes</h2>
          <NotesList notes={data.projectNotes} variant="print" />
        </section>
      ) : null}

      {data.areas.length === 0 && data.projectNotes.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No {trade.toLowerCase()} installs or notes on this project.
        </p>
      ) : (
        <div className="space-y-8">
          {data.areas.map((area) => (
            <section key={area.areaid}>
              <h2 className="break-after-avoid border-b border-zinc-300 pb-1 text-base font-semibold text-black">
                {area.label}
              </h2>

              {area.retainItems.length > 0 ? (
                <div className="mt-3 rounded border border-amber-500 bg-amber-50 p-2 text-sm text-black">
                  <p className="font-semibold text-amber-950">Retain — do not remove</p>
                  <ul className="mt-1 space-y-1">
                    {area.retainItems.map((item) => (
                      <li key={item.objectLabel}>
                        <span className="font-medium">{item.objectLabel}:</span>{" "}
                        {item.labels.join("; ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-black">
                  Installs ({area.installs.length})
                </h3>
                {area.installs.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-600">No installs in this area.</p>
                ) : (
                  <table className="mt-2 w-full border-collapse text-sm text-black">
                    <thead>
                      <tr className="border-b border-zinc-300 text-left text-xs text-zinc-600">
                        <th className="py-1 pr-3 font-medium">
                          Product (supplier SKU, description)
                        </th>
                        <th className="py-1 pr-3 text-right font-medium">Quantity</th>
                        <th className="py-1 text-right font-medium">Labour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {area.installs.map((line) => (
                        <tr key={line.id} className="border-b border-zinc-200 align-top">
                          <td className="py-2 pr-3">
                            <InstallProductCell
                              line={line}
                              titleClass="font-medium"
                              mutedClass="text-xs text-zinc-600"
                              linkClass="text-xs text-blue-800 underline"
                              noteClass="text-xs text-zinc-800"
                            />
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {quantityLabel(line)}
                          </td>
                          <td className="py-2 text-right tabular-nums">{line.labourSummary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-black">
                  Notes ({area.notes.length})
                </h3>
                {area.notes.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-600">No notes in this area.</p>
                ) : (
                  <div className="mt-2">
                    <NotesList notes={area.notes} variant="print" />
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export function WorkbenchTradeReportWindow({ data, onClose }: Props) {
  return (
    <>
      <div className="print:hidden">
        <ModalFrame
          title={`${data.config.label} report`}
          description={`${data.projectName} · installs and notes`}
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
        id="wb-trade-print-report"
        className="absolute left-0 top-0 hidden w-full bg-white text-black print:block"
        aria-hidden
      >
        <PrintReportBody data={data} />
      </div>
    </>
  );
}
