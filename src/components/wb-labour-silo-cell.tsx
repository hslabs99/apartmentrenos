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
  /** Typed over lookup import in workbench. */
  manualOverride?: boolean;
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

const wbLabourHoursClass =
  "text-xs font-normal tabular-nums text-sf-text dark:text-zinc-100";
const wbLabourHoursManualClass =
  "text-xs font-semibold tabular-nums text-red-600 dark:text-red-400";
const wbLabourCostClass =
  "text-[10px] tabular-nums text-sf-text-weak dark:text-zinc-500";
const wbLabourCostManualClass =
  "text-[10px] font-semibold tabular-nums text-red-600 dark:text-red-400";
const wbLabourInputManualClass = "text-red-600 dark:text-red-400";

function hasPositiveLabourHours(hours: number | null): boolean {
  return hours != null && Number.isFinite(hours) && hours > 0;
}

function wbLabourCellTitle(
  hours: number | null,
  cost: number | null,
  warningTitle: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (warningTitle) parts.push(warningTitle);
  if (hasPositiveLabourHours(hours)) {
    const hrs = `${formatLabourHours(hours)} hrs`;
    if (cost != null && Number.isFinite(cost) && cost > 0) {
      parts.push(`${hrs} · ${formatMoney(cost)}`);
    } else {
      parts.push(hrs);
    }
  }
  return parts.length ? parts.join("\n\n") : undefined;
}

type WbLabourSiloValueProps = {
  hours: number | null;
  cost: number | null;
  manualOverride?: boolean;
  /** When true, hours are edited above — show cost only (or —). */
  costOnly?: boolean;
  /** Match project-header summary financial typography ($ primary, hours secondary). */
  summary?: boolean;
  /** @deprecated Use default money styling; only override for exceptional cases. */
  primaryClassName?: string;
};

/**
 * Workbench labour display: hours and cost both visible.
 * Header / readonly cells show hours on top and $ below; editable cells use costOnly
 * (hours live in the input above).
 */
export function WbLabourSiloValue({
  hours,
  cost,
  manualOverride = false,
  costOnly = false,
  summary = false,
  primaryClassName,
}: WbLabourSiloValueProps) {
  const showCost =
    hasPositiveLabourHours(hours) && cost != null && Number.isFinite(cost) && cost > 0;
  const hoursClass =
    primaryClassName ??
    (manualOverride ? wbLabourHoursManualClass : wbLabourHoursClass);
  const costClass = manualOverride
    ? wbLabourCostManualClass
    : summary
      ? "text-sm tabular-nums text-sf-text dark:text-zinc-100"
      : wbLabourCostClass;
  const hoursSummaryClass = manualOverride
    ? wbLabourHoursManualClass
    : "text-xs tabular-nums text-sf-text-weak dark:text-zinc-400";

  if (costOnly) {
    return <span className={costClass}>{showCost ? formatMoney(cost!) : "—"}</span>;
  }

  if (summary) {
    return (
      <span className="flex flex-col items-end leading-tight">
        <span className={hoursSummaryClass}>
          {hasPositiveLabourHours(hours) ? formatLabourHours(hours) : "—"}
        </span>
        <span className={costClass}>{showCost ? formatMoney(cost!) : "—"}</span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={hoursClass}>
        {hasPositiveLabourHours(hours) ? formatLabourHours(hours) : "—"}
      </span>
      <span className={costClass}>{showCost ? formatMoney(cost!) : "—"}</span>
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
  manualOverride = false,
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
  const manualTitle = manualOverride ? "Manually edited labour hours" : undefined;
  const cellTitle = wbLabourCellTitle(
    hours,
    cost,
    [manualTitle, showBang ? warningTitle : undefined].filter(Boolean).join("\n\n") ||
      undefined,
  );

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
            className={`${inputClassName} ${manualOverride ? wbLabourInputManualClass : ""}`.trim()}
            title={manualTitle}
            onBlur={(e) => {
              const t = e.target.value.trim();
              const next = t === "" ? null : Number(t);
              const prev = hours;
              if (next === prev || (next != null && !Number.isFinite(next))) return;
              onHoursChange(next != null && Number.isFinite(next) ? next : null);
            }}
          />
        </div>
        <WbLabourSiloValue
          hours={hours}
          cost={cost}
          manualOverride={manualOverride}
          costOnly
        />
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
          <WbLabourSiloValue
            hours={hours}
            cost={cost}
            manualOverride={manualOverride}
          />
        </span>
      </div>
    </td>
  );
}
