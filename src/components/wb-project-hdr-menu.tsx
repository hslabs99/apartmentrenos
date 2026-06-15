"use client";

import { IconDotsHorizontal } from "@/components/icons/lightning-icons";
import {
  WB_TRADE_REPORTS,
  type WbTradeReportId,
} from "@/lib/workbench-trade-report";
import { useEffect, useRef, useState } from "react";

type Props = {
  projectLabel: string;
  exportDisabled?: boolean;
  onPrintTradeReport: (tradeId: WbTradeReportId) => void;
  onExport: () => void;
  onAddArea: () => void;
};

const menuItemClass =
  "block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800";
const menuSectionLabelClass =
  "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-500";

export function WbProjectHdrMenu({
  projectLabel,
  exportDisabled = false,
  onPrintTradeReport,
  onExport,
  onAddArea,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-label={`Project actions for ${projectLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-sf-border-strong bg-sf-surface text-sf-text-secondary shadow-sm transition hover:bg-sf-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sf-brand dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        title="Project actions"
      >
        <IconDotsHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[12rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className={menuSectionLabelClass} role="presentation">
            Trade report
          </div>
          {WB_TRADE_REPORTS.map((report) => (
            <button
              key={report.id}
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                onPrintTradeReport(report.id);
              }}
            >
              {report.label}
            </button>
          ))}
          <div
            className="my-1 border-t border-sf-border dark:border-zinc-700"
            role="separator"
          />
          <button
            type="button"
            role="menuitem"
            disabled={exportDisabled}
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          >
            {exportDisabled ? "Exporting…" : "Export workbench (.xls)"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              onAddArea();
            }}
          >
            Add area…
          </button>
        </div>
      ) : null}
    </div>
  );
}
