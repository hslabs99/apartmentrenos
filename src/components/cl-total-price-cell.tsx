"use client";

import {
  clScopeTotalPriceColClass,
  clTotalPriceFieldClass,
  CL_FIELD_CONTROL_HEIGHT_CLASS,
} from "@/components/cl-checklist-layout";
import { formatMoney } from "@/lib/client/format-money";
import { lineFinalPrice } from "@/lib/client/line-final-price";
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
};

/** Read-only checklist Total price (incl. margin). */
export function ClTotalPriceCell({
  line,
  marginPct,
  effectiveMeasure,
  unitPriceFallback,
  preferEffectiveMeasure,
}: Props) {
  const total = lineFinalPrice(
    line,
    marginPct,
    effectiveMeasure,
    unitPriceFallback,
    preferEffectiveMeasure,
  );

  return (
    <div className={`${clTotalPriceFieldClass} ${clScopeTotalPriceColClass}`}>
      <span className={wbHdrLabel}>Total price</span>
      <span
        className={`${CL_FIELD_CONTROL_HEIGHT_CLASS} flex items-center text-xs font-medium tabular-nums text-sf-text dark:text-zinc-100`}
      >
        {total != null ? formatMoney(total) : "—"}
      </span>
    </div>
  );
}
