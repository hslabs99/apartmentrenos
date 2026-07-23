"use client";

import type { ReactNode } from "react";

/** Shared workbench summary financial cell chrome (project + area headers). */
export const wbSummaryFinLabelCell =
  "border border-sf-border bg-sf-page px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400";

export const wbSummaryFinValueCell =
  "border border-sf-border bg-sf-surface px-2 py-1 text-right text-sm tabular-nums text-sf-text dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-100";

export const wbSummaryFinValueEmphasis =
  "font-semibold text-sf-accent dark:text-emerald-300";

export const wbSummaryFinValueDouble =
  "border-b-[3px] border-b-sf-text [border-bottom-style:double] dark:border-b-zinc-100";

const wbSummaryMoneyColumnTd = "p-0.5 align-bottom";

/** Tall enough for wrapped "Final (incl. margin)" — all summary labels use this height. */
const WB_SUMMARY_LABEL_HEIGHT = "h-[2.625rem]";

const wbSummaryMoneyLabelBoxBase = `flex ${WB_SUMMARY_LABEL_HEIGHT} items-end border border-sf-border px-1 py-1 text-xs font-semibold uppercase tracking-wide leading-tight text-sf-text-secondary hyphens-auto break-words dark:border-zinc-700 dark:text-zinc-400`;
const wbSummaryMoneyLabelBoxLeft = `${wbSummaryMoneyLabelBoxBase} justify-start text-left`;
const wbSummaryMoneyLabelBoxRight = `${wbSummaryMoneyLabelBoxBase} justify-end text-right`;

const wbSummaryMoneyDetailBoxBase =
  "border border-sf-border px-1 py-0.5 text-[11px] leading-tight tabular-nums text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400";
const wbSummaryMoneyDetailBoxLeft = `${wbSummaryMoneyDetailBoxBase} text-left`;
const wbSummaryMoneyDetailBoxRight = `${wbSummaryMoneyDetailBoxBase} text-right`;

const wbSummaryMoneyValueBoxBase =
  "flex min-h-[1.75rem] items-center border border-sf-border bg-sf-surface px-1 py-1 dark:border-zinc-700 dark:bg-zinc-950/50";
const wbSummaryMoneyValueBoxLeft = `${wbSummaryMoneyValueBoxBase} justify-start text-left`;
const wbSummaryMoneyValueBoxRight = `${wbSummaryMoneyValueBoxBase} justify-end text-right tabular-nums`;
const wbSummaryMoneyValueBoxFinal =
  `${wbSummaryMoneyValueBoxRight} font-semibold text-sf-accent dark:text-emerald-300`;

const wbSummaryDetailSpacerLine =
  "block h-[1.125rem] whitespace-nowrap leading-tight";

function summaryDetailSpacerBox(
  count: number,
  align: "left" | "right",
): ReactNode {
  if (count <= 0) return null;
  const boxClass =
    align === "left" ? wbSummaryMoneyDetailBoxLeft : wbSummaryMoneyDetailBoxRight;
  return (
    <div className={boxClass} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={`summary-detail-spacer-${i}`} className={wbSummaryDetailSpacerLine}>
          <span className="invisible select-none">—</span>
        </span>
      ))}
    </div>
  );
}

type WbSummaryMoneyColumnProps = {
  label: string;
  title?: string;
  align?: "left" | "right";
  /** Lighter slate tint for area header rows. */
  areaBand?: boolean;
  /** Bordered detail lines between label and value (e.g. lines + paint fee). */
  detail?: ReactNode;
  /** Empty bordered rows so value columns align when another column has detail. */
  detailSpacerLines?: number;
  valueClassName?: string;
  children: ReactNode;
};

/** Workbench summary column: bordered label box + optional detail + bordered value box. */
export function WbSummaryMoneyColumn({
  label,
  title,
  align = "right",
  areaBand = false,
  detail,
  detailSpacerLines = 0,
  valueClassName,
  children,
}: WbSummaryMoneyColumnProps) {
  const labelBand = areaBand ? "bg-[#f0f4f8] dark:bg-slate-900/55" : "bg-sf-page dark:bg-zinc-900/70";
  const valueBand = areaBand ? "bg-sf-surface dark:bg-slate-950/40" : "";
  const labelBox =
    align === "left"
      ? `${wbSummaryMoneyLabelBoxLeft} ${labelBand}`
      : `${wbSummaryMoneyLabelBoxRight} ${labelBand}`;
  const detailBox =
    align === "left" ? wbSummaryMoneyDetailBoxLeft : wbSummaryMoneyDetailBoxRight;
  const valueBox =
    valueClassName ??
    (align === "left" ? wbSummaryMoneyValueBoxLeft : wbSummaryMoneyValueBoxRight);
  const showDetail = detail != null || detailSpacerLines > 0;

  return (
    <td className={wbSummaryMoneyColumnTd}>
      <div className="flex flex-col gap-px">
        <div className={labelBox} title={title}>
          {label}
        </div>
        {showDetail ? (
          <div className={detailBox}>
            {detail ?? summaryDetailSpacerBox(detailSpacerLines, align)}
          </div>
        ) : null}
        <div className={`${valueBox} ${valueBand}`.trim()}>{children}</div>
      </div>
    </td>
  );
}

export const wbSummaryMoneyValueClass =
  "text-sm font-semibold tabular-nums text-sf-text dark:text-zinc-100";

export const wbSummaryMoneyFinalValueClass =
  "text-sm font-semibold tabular-nums text-sf-accent dark:text-emerald-300";

export function wbSummaryMoneyFinalValueBox(areaBand = false): string {
  const band = areaBand ? "bg-sf-surface dark:bg-slate-950/40" : "";
  return `${wbSummaryMoneyValueBoxFinal} ${band}`.trim();
}

type WbSummaryMoneyValueOnlyProps = {
  title?: string;
  /** Emerald emphasis (e.g. final price). */
  emphasis?: boolean;
  children: ReactNode;
};

/**
 * Compact value cell matching project-header summary financials —
 * for area header totals when column headers already label the data.
 */
export function WbSummaryMoneyValueOnly({
  title,
  emphasis = false,
  children,
}: WbSummaryMoneyValueOnlyProps) {
  return (
    <td className={`${wbSummaryMoneyColumnTd} align-middle`}>
      <div
        className={`${wbSummaryFinValueCell}${emphasis ? ` ${wbSummaryFinValueEmphasis}` : ""}`}
        title={title}
      >
        {children}
      </div>
    </td>
  );
}

type WbSummaryMarginColumnProps = {
  detail?: ReactNode;
  detailSpacerLines?: number;
  /** Margin % control — sits under the Margin label cell. */
  percent: ReactNode;
  /** Margin $ amount — sits under the Margin $ label cell. */
  dollars: ReactNode;
};

/** Margin column: paired label + value cells for Margin % and Margin $. */
export function WbSummaryMarginColumn({
  detail,
  detailSpacerLines = 0,
  percent,
  dollars,
}: WbSummaryMarginColumnProps) {
  const labelBand = "bg-sf-page dark:bg-zinc-900/70";
  const showDetail = detail != null || detailSpacerLines > 0;

  return (
    <td className={wbSummaryMoneyColumnTd}>
      <div className="flex flex-col gap-px">
        <div className="flex gap-px">
          <div className={`${wbSummaryMoneyLabelBoxLeft} min-w-0 flex-1 ${labelBand}`}>
            Margin
          </div>
          <div className={`${wbSummaryMoneyLabelBoxRight} min-w-0 flex-1 ${labelBand}`}>
            Margin $
          </div>
        </div>
        {showDetail ? (
          <div className="flex gap-px">
            <div className={`${wbSummaryMoneyDetailBoxRight} min-w-0 flex-1`}>
              {detail ?? summaryDetailSpacerBox(detailSpacerLines, "right")}
            </div>
            <div className={`${wbSummaryMoneyDetailBoxRight} min-w-0 flex-1`} aria-hidden="true">
              {summaryDetailSpacerBox(detailSpacerLines, "right")}
            </div>
          </div>
        ) : null}
        <div className="flex gap-px">
          <div className={`${wbSummaryMoneyValueBoxRight} min-w-0 flex-1`}>{percent}</div>
          <div className={`${wbSummaryMoneyValueBoxFinal} min-w-0 flex-1`}>{dollars}</div>
        </div>
      </div>
    </td>
  );
}
