"use client";

import {
  labourSiloCellWarning,
  labourSiloWarningTitle,
} from "@/lib/client/labour-rate-index";
import { contractLabourRateBySiloProduct, labourSiloCostExcGst } from "@/lib/labour-rate-lookup";
import { formatLabourHours, type LabourSiloKey } from "@/lib/labour-silo";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

type Props = {
  siloKey: LabourSiloKey;
  hours: number | null;
  contractRates: DataLabourRatePublic[];
  objectLabourDuplicate: boolean;
  /** Line object name used for Object Labour Rates lookup (for duplicate warning tooltip). */
  objectLabourMatchName?: string;
  /** Line SKU product — narrows labour rows with a set Product column. */
  skuProduct?: string | null;
  editable?: boolean;
  disabled?: boolean;
  cellClassName?: string;
  inputClassName?: string;
  inputKey?: string;
  /** Forces readonly hour text to refresh when hours change (e.g. after measure edit). */
  displayKey?: string;
  onHoursChange?: (next: number | null) => void;
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const wbLabourMoneyClass =
  "text-xs font-normal tabular-nums text-sf-text dark:text-zinc-100";

function hasPositiveLabourHours(hours: number | null): boolean {
  return hours != null && Number.isFinite(hours) && hours > 0;
}

function labourHoursHoverTitle(hours: number | null): string | undefined {
  if (!hasPositiveLabourHours(hours)) return undefined;
  return `${formatLabourHours(hours)} hrs`;
}

function wbLabourCellTitle(
  hours: number | null,
  warningTitle: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (warningTitle) parts.push(warningTitle);
  const hrs = labourHoursHoverTitle(hours);
  if (hrs) parts.push(hrs);
  return parts.length ? parts.join("\n\n") : undefined;
}

type WbLabourSiloValueProps = {
  hours: number | null;
  cost: number | null;
  /** @deprecated Use default money styling; only override for exceptional cases. */
  primaryClassName?: string;
};

/** Workbench labour cell: cost only; hours on hover when non-zero. */
export function WbLabourSiloValue({
  hours,
  cost,
  primaryClassName,
}: WbLabourSiloValueProps) {
  const moneyClass = primaryClassName ?? wbLabourMoneyClass;
  const showCost =
    hasPositiveLabourHours(hours) && cost != null && Number.isFinite(cost) && cost > 0;
  return (
    <span className={moneyClass}>
      {showCost ? formatMoney(cost) : "—"}
    </span>
  );
}

export function WbLabourSiloCell({
  siloKey,
  hours,
  contractRates,
  objectLabourDuplicate,
  objectLabourMatchName,
  skuProduct,
  editable = false,
  disabled = false,
  cellClassName = "",
  inputClassName = "",
  inputKey,
  displayKey,
  onHoursChange,
}: Props) {
  const warn = labourSiloCellWarning(
    hours,
    siloKey,
    contractRates,
    objectLabourDuplicate,
  );
  const warningTitle = labourSiloWarningTitle(warn, objectLabourMatchName, skuProduct);
  const rate = contractLabourRateBySiloProduct(contractRates, siloKey);
  const cost = labourSiloCostExcGst(hours, rate);
  const hasHours = hasPositiveLabourHours(hours);
  const showBang =
    warn.duplicateObjectLabour || (warn.missingRate && hasHours);
  const cellTitle = wbLabourCellTitle(hours, showBang ? warningTitle : undefined);

  if (editable && onHoursChange) {
    return (
      <td className={`${cellClassName} align-middle text-right tabular-nums`.trim()}>
        <div
          className="flex items-center justify-end gap-0.5"
          title={cellTitle}
        >
          {showBang ? (
            <span
              className="shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            >
              !
            </span>
          ) : null}
          <input
            key={inputKey}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            defaultValue={hours != null ? String(hours) : ""}
            placeholder="—"
            className={inputClassName}
            onBlur={(e) => {
              const t = e.target.value.trim();
              const next = t === "" ? null : Number(t);
              const prev = hours;
              if (next === prev || (next != null && !Number.isFinite(next))) return;
              onHoursChange(next != null && Number.isFinite(next) ? next : null);
            }}
          />
        </div>
        <WbLabourSiloValue hours={hours} cost={cost} />
      </td>
    );
  }

  return (
    <td
      className={`${cellClassName} align-middle text-right tabular-nums`.trim()}
      title={cellTitle}
      aria-label={cellTitle}
    >
      <div className="flex items-center justify-end gap-0.5">
        {showBang ? (
          <span
            className="shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          >
            !
          </span>
        ) : null}
        <span key={displayKey}>
          <WbLabourSiloValue hours={hours} cost={cost} />
        </span>
      </div>
    </td>
  );
}
