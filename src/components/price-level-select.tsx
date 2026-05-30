"use client";

import { usePriceLevels } from "@/lib/client/use-price-levels";
import { useMemo } from "react";

type PriceLevelSelectProps = {
  value: string;
  onChange: (value: string) => void;
  className: string;
  id?: string;
  disabled?: boolean;
  /** First option when nothing selected */
  emptyLabel?: string;
};

export function PriceLevelSelect({
  value,
  onChange,
  className,
  id,
  disabled,
  emptyLabel = "Select price level",
}: PriceLevelSelectProps) {
  const { levels, loading } = usePriceLevels();

  const known = useMemo(() => new Set(levels.map((l) => l.pricelevel)), [levels]);
  const hasLegacy = value.trim() !== "" && !known.has(value);
  const selectValue =
    value === "" ? "" : hasLegacy || known.has(value) ? value : "";

  return (
    <select
      id={id}
      className={className}
      disabled={disabled || loading}
      value={selectValue}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {hasLegacy ? (
        <option value={value}>{value} (saved)</option>
      ) : null}
      {levels.map((p) => (
        <option key={p.id} value={p.pricelevel}>
          {p.pricelevel}
        </option>
      ))}
    </select>
  );
}
