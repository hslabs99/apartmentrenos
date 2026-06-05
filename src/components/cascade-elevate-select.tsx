"use client";

import { PriceLevelIdSelect } from "@/components/price-level-id-select";
import {
  cascadeLevelFromPriceLevel,
  priceLevelIdForCascadeLevel,
  projectfinishForPriceLevelId,
} from "@/lib/cascades/cascade-level-from-price-level";
import {
  distinctCascadeLevels,
  type CascadeRow,
} from "@/lib/cascades/cascade-filter-options";
import { normalizeElevateLevel } from "@/lib/sku/normalize-sku-part";
import type { PriceLevelPublic } from "@/types/price-level";
import { useMemo } from "react";

export type CascadeElevateChange = {
  priceLevelId: number | null;
  projectFinish: string;
};

type CascadeElevateSelectProps = {
  cascades: CascadeRow[];
  priceLevels: PriceLevelPublic[];
  priceLevelId: number | null;
  projectFinish?: string | null;
  onChange: (next: CascadeElevateChange) => void;
  className: string;
  id?: string;
  disabled?: boolean;
  emptyLabel?: string;
};

export function CascadeElevateSelect({
  cascades,
  priceLevels,
  priceLevelId,
  projectFinish,
  onChange,
  className,
  id,
  disabled,
  emptyLabel = "Not set",
}: CascadeElevateSelectProps) {
  const levelOptions = useMemo(() => distinctCascadeLevels(cascades), [cascades]);

  const selectedLevel = useMemo(
    () =>
      cascadeLevelFromPriceLevel(priceLevels, priceLevelId, projectFinish, cascades),
    [priceLevels, priceLevelId, projectFinish, cascades],
  );

  const optionNorms = useMemo(
    () => new Set(levelOptions.map((o) => normalizeElevateLevel(o))),
    [levelOptions],
  );

  const selectValue = useMemo(() => {
    if (!selectedLevel) return "";
    const hit = levelOptions.find(
      (o) => normalizeElevateLevel(o) === normalizeElevateLevel(selectedLevel),
    );
    return hit ?? selectedLevel;
  }, [levelOptions, selectedLevel]);

  const hasUnknownSaved =
    Boolean(selectValue) &&
    levelOptions.length > 0 &&
    !optionNorms.has(normalizeElevateLevel(selectValue));

  if (levelOptions.length === 0) {
    return (
      <PriceLevelIdSelect
        id={id}
        value={priceLevelId}
        onChange={(nextId) =>
          onChange({
            priceLevelId: nextId,
            projectFinish: projectfinishForPriceLevelId(priceLevels, nextId, cascades),
          })
        }
        className={className}
        disabled={disabled}
        emptyLabel={emptyLabel}
      />
    );
  }

  return (
    <select
      id={id}
      className={className}
      disabled={disabled}
      value={selectValue}
      onChange={(e) => {
        const level = e.target.value.trim();
        if (!level) {
          onChange({ priceLevelId: null, projectFinish: "" });
          return;
        }
        onChange({
          priceLevelId: priceLevelIdForCascadeLevel(priceLevels, level, cascades),
          projectFinish: level,
        });
      }}
    >
      <option value="">{emptyLabel}</option>
      {hasUnknownSaved ? (
        <option value={selectValue}>{selectValue} (saved)</option>
      ) : null}
      {levelOptions.map((level) => (
        <option key={level} value={level}>
          {level}
        </option>
      ))}
    </select>
  );
}
