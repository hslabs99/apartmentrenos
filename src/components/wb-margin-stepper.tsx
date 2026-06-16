"use client";

import { formatMoney } from "@/lib/client/format-money";
import { parseMarginPercent } from "@/lib/settings-margin";

const labelClass =
  "mb-0.5 block min-h-[2rem] text-xs font-semibold uppercase tracking-wide leading-tight text-sf-text-secondary hyphens-auto break-words dark:text-zinc-400";

const stepBtnClass =
  "flex h-3.5 w-4 shrink-0 items-center justify-center rounded border border-sf-border-strong bg-sf-surface text-[9px] leading-none text-sf-text-secondary hover:bg-sf-page disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Final − subtotal (margin dollars on project lines + charges). */
  realisedMarginExcGst?: number | null;
  /** Match project subtotal breakdown rows so $ columns align with area headers. */
  detailSpacerLines?: number;
};

const wbHdrDetailSpacerClass =
  "mt-0.5 block h-[1.125rem] text-[11px] leading-tight invisible select-none pointer-events-none";

function marginStepperDetailSpacers(count: number) {
  if (count <= 0) return null;
  return Array.from({ length: count }, (_, i) => (
    <span key={`margin-hdr-spacer-${i}`} className={wbHdrDetailSpacerClass} aria-hidden="true">
      —
    </span>
  ));
}

/** Workbench project header margin % — step 1% with up/down controls. */
export function WbMarginStepper({
  value,
  onChange,
  realisedMarginExcGst,
  detailSpacerLines = 0,
}: Props) {
  const bump = (delta: number) => {
    onChange(Math.min(999, Math.max(0, value + delta)));
  };

  return (
    <div className="flex shrink-0 items-end justify-end gap-2">
      <div className="text-right">
        <span className={labelClass}>Margin</span>
        {marginStepperDetailSpacers(detailSpacerLines)}
        <div className="flex items-center justify-end gap-0.5">
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
          <div className="flex flex-col gap-px">
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
      </div>
      <div className="text-right">
        <span className={labelClass}>Margin $</span>
        {marginStepperDetailSpacers(detailSpacerLines)}
        <span
          className="block text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200"
          title="Final (incl. margin) minus project subtotal"
        >
          {realisedMarginExcGst != null ? formatMoney(realisedMarginExcGst) : "—"}
        </span>
      </div>
    </div>
  );
}
