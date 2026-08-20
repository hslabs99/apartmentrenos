"use client";

import { WbMarginPercentControl } from "@/components/wb-margin-stepper";
import { formatMoney } from "@/lib/client/format-money";
import {
  LOOKUP_LABOUR_SILO_KEYS,
  WB_WORKBENCH_LABOUR_SILO_HEADERS,
} from "@/lib/labour-silo";
import { useViewMode } from "@/lib/view-mode";
import type { ReactNode } from "react";

function moneyOrBlank(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "0.00";
  return formatMoney(n).replace(/^\$/, "");
}

function TradeDraftTag({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start gap-0 rounded border border-sf-border/70 bg-sf-page px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900/60">
      <span className="text-[8px] font-medium uppercase tracking-wider text-sf-text-weak dark:text-zinc-500">
        {label}
      </span>
      <span className="text-[10px] font-medium tabular-nums text-sf-text-weak dark:text-zinc-400">
        {value}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
  teal = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  teal?: boolean;
}) {
  const shell = teal
    ? "border-sf-accent bg-sf-accent text-white"
    : accent
      ? "border-sf-brand bg-sf-brand text-white"
      : "border-sf-border bg-sf-surface text-sf-text dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100";
  const labelTone = teal || accent ? "text-white/60" : "text-sf-text-secondary dark:text-zinc-400";
  const valueTone = teal
    ? "text-white"
    : accent
      ? "text-white"
      : "text-sf-brand dark:text-zinc-50";
  return (
    <div className={`flex min-w-[7.5rem] flex-col gap-0.5 rounded-lg border px-3 py-2 ${shell}`}>
      <span className={`text-[9px] font-semibold uppercase tracking-wider ${labelTone}`}>
        {label}
      </span>
      <span className={`text-xs font-bold tabular-nums sm:text-sm ${valueTone}`}>{value}</span>
    </div>
  );
}

export type WbLabourCostBySilo = Record<
  (typeof LOOKUP_LABOUR_SILO_KEYS)[number],
  number | null
>;

function tradeTotalFrom(
  labourCostBySilo: WbLabourCostBySilo,
  paintingExcGst = 0,
): number {
  let sum = paintingExcGst > 0 ? paintingExcGst : 0;
  for (const key of LOOKUP_LABOUR_SILO_KEYS) {
    const n = labourCostBySilo[key];
    if (n != null && Number.isFinite(n) && n > 0) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

type BlocksProps = {
  lineSubTotal: number;
  labourCostBySilo: WbLabourCostBySilo;
  paintingExcGst?: number;
  showPainting?: boolean;
  netTotal: number;
  marginExcGst: number | null;
  grandTotal: number;
  grandLabel?: string;
  marginControl?: ReactNode;
  ariaLabel: string;
  /** Teal accent on final/grand card (area FINAL in v0). */
  finalTeal?: boolean;
};

/** v0-style financials: muted trade tags | summary cards | optional margin %. */
function WbFinSummaryBlocks({
  lineSubTotal,
  labourCostBySilo,
  paintingExcGst = 0,
  showPainting = false,
  netTotal,
  marginExcGst,
  grandTotal,
  grandLabel = "Grand Total",
  marginControl,
  ariaLabel,
  finalTeal = false,
}: BlocksProps) {
  const { isAdminMode } = useViewMode();
  const tradeTotal = tradeTotalFrom(labourCostBySilo, showPainting ? paintingExcGst : 0);

  const tradeTags: { label: string; value: number | null | undefined }[] = [];
  if (showPainting) {
    tradeTags.push({ label: "PAINTING", value: paintingExcGst });
  }
  for (const { key, label } of WB_WORKBENCH_LABOUR_SILO_HEADERS) {
    tradeTags.push({
      label: label.toUpperCase(),
      value: labourCostBySilo[key as (typeof LOOKUP_LABOUR_SILO_KEYS)[number]],
    });
  }

  const summaryCards = [
    { label: "LINE SUB TOTAL", value: lineSubTotal, accent: false, teal: false },
    { label: "TRADE TOTAL", value: tradeTotal, accent: false, teal: false },
    ...(!isAdminMode
      ? [
          { label: "TOTAL", value: netTotal, accent: false, teal: false },
          { label: "MARGIN", value: marginExcGst, accent: !finalTeal, teal: false },
        ]
      : []),
    {
      label: grandLabel.toUpperCase(),
      value: grandTotal,
      accent: !finalTeal,
      teal: finalTeal,
    },
  ];

  return (
    <div
      className="flex flex-wrap items-stretch justify-end gap-2"
      role="group"
      aria-label={ariaLabel}
    >
      <div className="flex flex-wrap items-end gap-1">
        {tradeTags.map((t) => (
          <TradeDraftTag key={t.label} label={t.label} value={moneyOrBlank(t.value)} />
        ))}
      </div>
      <div className="mx-0.5 w-px self-stretch bg-sf-border dark:bg-zinc-600" aria-hidden />
      <div className="flex flex-wrap items-stretch gap-1.5">
        {summaryCards.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={moneyOrBlank(s.value)}
            accent={s.accent}
            teal={s.teal}
          />
        ))}
        {marginControl ? (
          <div className="flex flex-col justify-center gap-0.5 rounded-lg border border-sf-border bg-sf-surface px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-sf-text-secondary dark:text-zinc-400">
              Margin %
            </span>
            {marginControl}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ProjectProps = {
  lineSubTotal: number;
  paintingExcGst: number;
  labourCostBySilo: WbLabourCostBySilo;
  netTotal: number;
  marginPct: number;
  marginExcGst: number | null;
  grandTotal: number;
  canAdjustMargin: boolean;
  onMarginChange: (value: number) => void;
};

/** Project totals for the workbench header. */
export function WbProjectSummary({
  lineSubTotal,
  paintingExcGst,
  labourCostBySilo,
  netTotal,
  marginPct,
  marginExcGst,
  grandTotal,
  canAdjustMargin,
  onMarginChange,
}: ProjectProps) {
  return (
    <WbFinSummaryBlocks
      ariaLabel="Project summary"
      lineSubTotal={lineSubTotal}
      paintingExcGst={paintingExcGst}
      showPainting
      labourCostBySilo={labourCostBySilo}
      netTotal={netTotal}
      marginExcGst={marginExcGst}
      grandTotal={grandTotal}
      grandLabel="Grand Total"
      marginControl={
        canAdjustMargin ? (
          <WbMarginPercentControl value={marginPct} onChange={onMarginChange} />
        ) : undefined
      }
    />
  );
}

type AreaProps = {
  lineSubTotal: number;
  labourCostBySilo: WbLabourCostBySilo;
  netTotal: number;
  marginExcGst: number | null;
  finalTotal: number;
};

/** Area totals — same card layout as the project summary. */
export function WbAreaSummary({
  lineSubTotal,
  labourCostBySilo,
  netTotal,
  marginExcGst,
  finalTotal,
}: AreaProps) {
  return (
    <WbFinSummaryBlocks
      ariaLabel="Area summary"
      lineSubTotal={lineSubTotal}
      labourCostBySilo={labourCostBySilo}
      netTotal={netTotal}
      marginExcGst={marginExcGst}
      grandTotal={finalTotal}
      grandLabel="Final"
      finalTeal
    />
  );
}
