"use client";

import {
  clScopeTotalPriceColClass,
  clTotalPriceFieldClass,
  CL_FIELD_CONTROL_HEIGHT_CLASS,
} from "@/components/cl-checklist-layout";
import { formatMoney } from "@/lib/client/format-money";
import {
  lineChecklistTradeHoursTitle,
  lineFinalPriceBreakdown,
} from "@/lib/client/line-final-price";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

const wbHdrLabel =
  "block text-[10px] font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400";

type Props = {
  line: ProjectAreaObjectPublic;
  marginPct: number;
  /** Scope metric / inherit measure when line.custommeasure is null. */
  effectiveMeasure?: number | null;
  /** Supplier / pick price when line.customumprice is not stored yet. */
  unitPriceFallback?: number | null;
  /** Scope metric inherit: use effective measure instead of stored custommeasure. */
  preferEffectiveMeasure?: boolean;
  /** Contract labour rates — labour on the line is included in Total price (retail). */
  contractLabourRates?: DataLabourRatePublic[];
};

/**
 * Read-only checklist Total price (material + labour, incl. margin).
 * Trade $ stay in the total; hours-only breakdown is on hover (no SKU / markup).
 */
export function ClTotalPriceCell({
  line,
  marginPct,
  effectiveMeasure,
  unitPriceFallback,
  preferEffectiveMeasure,
  contractLabourRates,
}: Props) {
  const breakdown = lineFinalPriceBreakdown(
    line,
    marginPct,
    effectiveMeasure,
    unitPriceFallback,
    preferEffectiveMeasure,
    contractLabourRates,
  );
  const total = breakdown?.finalExcGst ?? null;
  const hoursTitle = lineChecklistTradeHoursTitle(line);

  return (
    <div className={`${clTotalPriceFieldClass} ${clScopeTotalPriceColClass}`}>
      <span className={wbHdrLabel}>Total price</span>
      <span
        className={`${CL_FIELD_CONTROL_HEIGHT_CLASS} flex cursor-default items-center text-xs font-medium tabular-nums text-sf-text dark:text-zinc-100 ${
          hoursTitle ? "underline decoration-dotted decoration-sf-border underline-offset-2" : ""
        }`}
        title={hoursTitle}
      >
        {total != null ? formatMoney(total) : "—"}
      </span>
    </div>
  );
}
