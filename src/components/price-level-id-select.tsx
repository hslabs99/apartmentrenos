"use client";

import { usePriceLevels } from "@/lib/client/use-price-levels";
import { useMemo } from "react";

type PriceLevelIdSelectProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  className: string;
  id?: string;
  disabled?: boolean;
  emptyLabel?: string;
};

export function PriceLevelIdSelect({
  value,
  onChange,
  className,
  id,
  disabled,
  emptyLabel = "Default (project)",
}: PriceLevelIdSelectProps) {
  const { levels, loading } = usePriceLevels();

  const idsWithLabels = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    for (const l of levels) {
      const pid = l.pricelevelid;
      if (typeof pid === "number" && Number.isInteger(pid)) {
        out.push({ id: pid, label: l.pricelevel });
      }
    }
    return out;
  }, [levels]);

  const knownIds = useMemo(() => new Set(idsWithLabels.map((x) => x.id)), [idsWithLabels]);

  const hasUnknown =
    value != null && Number.isInteger(value) && !knownIds.has(value);

  const selectValue = value == null ? "" : String(value);

  return (
    <select
      id={id}
      className={className}
      disabled={disabled || loading}
      value={selectValue}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange(null);
        else {
          const n = Number(v);
          onChange(Number.isInteger(n) ? n : null);
        }
      }}
    >
      <option value="">{emptyLabel}</option>
      {hasUnknown ? (
        <option value={String(value)}>ID {value} (saved)</option>
      ) : null}
      {idsWithLabels.map(({ id: pid, label }) => (
        <option key={pid} value={String(pid)}>
          {label}
        </option>
      ))}
    </select>
  );
}
