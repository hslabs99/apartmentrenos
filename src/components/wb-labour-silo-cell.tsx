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

export function WbLabourSiloCell({
  siloKey,
  hours,
  contractRates,
  objectLabourDuplicate,
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
  const title = labourSiloWarningTitle(warn);
  const rate = contractLabourRateBySiloProduct(contractRates, siloKey);
  const cost = labourSiloCostExcGst(hours, rate);
  const showBang = warn.missingRate || warn.duplicateObjectLabour;

  if (editable && onHoursChange) {
    return (
      <td className={`${cellClassName} align-middle text-right tabular-nums`.trim()}>
        <div className="flex items-center justify-end gap-0.5">
          {showBang ? (
            <span
              className="shrink-0 text-amber-600 dark:text-amber-400"
              title={title}
              aria-label={title}
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
        {cost != null ? (
          <div className="text-[10px] text-sf-text-weak dark:text-zinc-500">{formatMoney(cost)}</div>
        ) : null}
      </td>
    );
  }

  return (
    <td className={`${cellClassName} align-middle text-right tabular-nums text-sm`.trim()}>
      <div className="flex items-center justify-end gap-0.5">
        {showBang ? (
          <span
            className="shrink-0 text-amber-600 dark:text-amber-400"
            title={title}
            aria-label={title}
          >
            !
          </span>
        ) : null}
        <span key={displayKey}>{formatLabourHours(hours)}</span>
      </div>
      {cost != null ? (
        <div className="text-[10px] text-sf-text-weak dark:text-zinc-500">{formatMoney(cost)}</div>
      ) : null}
    </td>
  );
}
