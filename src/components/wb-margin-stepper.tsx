"use client";

import { formatMoney } from "@/lib/client/format-money";
import { parseMarginPercent } from "@/lib/settings-margin";
import { wbSummaryMoneyFinalValueClass } from "@/components/wb-summary-money-column";

const stepBtnClass =
  "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-sf-border-strong bg-sf-surface text-[9px] leading-none text-sf-text-secondary hover:bg-sf-page disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900";

type PercentProps = {
  value: number;
  onChange: (value: number) => void;
};

/** Margin % input with side-by-side stepper buttons. */
export function WbMarginPercentControl({ value, onChange }: PercentProps) {
  const bump = (delta: number) => {
    onChange(Math.min(999, Math.max(0, value + delta)));
  };

  return (
    <div className="flex w-full items-center justify-start gap-0.5">
      <input
        type="number"
        min={0}
        max={999}
        step={1}
        value={value}
        onChange={(e) => onChange(parseMarginPercent(e.target.value))}
        className="w-[5.25ch] rounded border border-sf-border-strong bg-sf-surface px-0.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950"
        aria-label="Margin percent"
      />
      <span className="text-xs text-sf-text-secondary dark:text-zinc-400">%</span>
      <div className="flex flex-row gap-px">
        <button
          type="button"
          onClick={() => bump(1)}
          disabled={value >= 999}
          className={stepBtnClass}
          aria-label="Increase margin by 1 percent"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => bump(-1)}
          disabled={value <= 0}
          className={stepBtnClass}
          aria-label="Decrease margin by 1 percent"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

type DollarProps = {
  realisedMarginExcGst?: number | null;
};

/** Realised margin dollars (final − subtotal; labour is already in both). */
export function WbMarginDollarValue({ realisedMarginExcGst }: DollarProps) {
  return (
    <span
      className={wbSummaryMoneyFinalValueClass}
      title="Final (incl. margin) minus project subtotal (material + labour)"
    >
      {realisedMarginExcGst != null ? formatMoney(realisedMarginExcGst) : "—"}
    </span>
  );
}

type Props = PercentProps & DollarProps;

/** Standalone margin stepper (labels included) — used outside summary column layout. */
export function WbMarginStepper({ value, onChange, realisedMarginExcGst }: Props) {
  return (
    <div className="flex shrink-0 items-end justify-end gap-2">
      <div className="text-right">
        <span className="mb-0.5 block min-h-[2rem] text-xs font-semibold uppercase tracking-wide leading-tight text-sf-text-secondary dark:text-zinc-400">
          Margin
        </span>
        <WbMarginPercentControl value={value} onChange={onChange} />
      </div>
      <div className="text-right">
        <span className="mb-0.5 block min-h-[2rem] text-xs font-semibold uppercase tracking-wide leading-tight text-sf-text-secondary dark:text-zinc-400">
          Margin $
        </span>
        <WbMarginDollarValue realisedMarginExcGst={realisedMarginExcGst} />
      </div>
    </div>
  );
}
