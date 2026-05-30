"use client";



import { formatMoney } from "@/lib/client/format-money";

import {

  activeScopeLineSkuPickValue,

  buildScopeLineSkuPicks,

  decodeScopeLineSkuPickValue,

  effectiveElevateLevelForLine,

  effectiveStyleColourForLine,

  encodeScopeLineSkuPickValue,

  matchingSkusForScopeLine,

  scopeLineSkuPickAllModeLabel,
  scopeLineSkuPickLabel,

  skuOptionLabel,

  scopeLineMatchesSkuPick,
  type ScopeLineSkuPick,

} from "@/lib/client/scope-line-sku-match";

import type { DataSkuPublic } from "@/types/data-sku-public";

import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";

import type { PriceLevelPublic } from "@/types/price-level";

import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

import type { ProjectAreaPublic } from "@/types/project-area";

import type { ProjectPublic } from "@/types/project";

import type { QuoteObjectPublic } from "@/types/quote-object";

import { useEffect, useMemo, useRef } from "react";



type Props = {

  line: ProjectAreaObjectPublic;

  quoteObject: QuoteObjectPublic | undefined;

  catalogSkus: DataSkuPublic[];

  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;

  priceLevels: PriceLevelPublic[];

  pa: ProjectAreaPublic;

  project: ProjectPublic | null;

  disabled?: boolean;

  selectClassName: string;

  onSelectSku: (pick: ScopeLineSkuPick) => void;

  /** compact = checklist inline row; block = workbench list */

  variant?: "compact" | "block";

  /** When false, price is shown only on the row unit-price field (workbench table). */

  showSupplierPrice?: boolean;

  /** Persist SKU (and parent applies unit price) when exactly one pick. */

  autoApplySingleMatch?: boolean;

  /** When set with autoApplySingleMatch, only auto-apply if the line has no SKU yet (workbench). */

  autoApplyOnlyWhenEmptySku?: boolean;

  /** Omit "SKU" prefix on match labels (workbench table). */

  shortMatchLabels?: boolean;

  /** Single-line badge + select (workbench table row). */

  inlineRow?: boolean;

  /** Admin workbench: show all supplier priorities (not only P1). */

  includeAllSupplierOptions?: boolean;

  onIncludeAllSupplierOptionsChange?: (checked: boolean) => void;

  showIncludeAllSupplierOptions?: boolean;

};



function SkuPriceLine({

  pick,

  variant,

}: {

  pick: ScopeLineSkuPick;

  variant: "compact" | "block";

}) {

  if (pick.priceExcGst == null) return null;

  const cls =

    variant === "block"

      ? "mt-0.5 block text-xs tabular-nums font-medium text-teal-900 dark:text-teal-200"

      : "mt-0.5 block text-[10px] tabular-nums font-medium text-teal-900 dark:text-teal-200";

  return (

    <span className={cls}>

      {formatMoney(pick.priceExcGst)} ex GST

      {pick.supplier ? (

        <span className="font-normal text-sf-text-secondary dark:text-zinc-400">

          {" "}

          · {pick.supplier}

        </span>

      ) : null}

    </span>

  );

}



export function ScopeLineSkuPicker({

  line,

  quoteObject,

  catalogSkus,

  suppliersBySkuId,

  priceLevels,

  pa,

  project,

  disabled = false,

  selectClassName,

  onSelectSku,

  variant = "compact",

  showSupplierPrice = true,

  autoApplySingleMatch = false,

  autoApplyOnlyWhenEmptySku = false,

  shortMatchLabels = false,

  inlineRow = false,

  includeAllSupplierOptions = false,

  onIncludeAllSupplierOptionsChange,

  showIncludeAllSupplierOptions = false,

}: Props) {

  const filters = useMemo(() => {

    const { style, colour } = effectiveStyleColourForLine(pa, project, line);

    const elevateLevel = effectiveElevateLevelForLine(priceLevels, line, pa, project);

    return { style, colour, elevateLevel };

  }, [line, pa, project, priceLevels]);



  const catalogMatches = useMemo(

    () => matchingSkusForScopeLine(catalogSkus, quoteObject, filters),

    [catalogSkus, quoteObject, filters],

  );



  const picks = useMemo(

    () =>

      buildScopeLineSkuPicks(

        catalogMatches,

        suppliersBySkuId,

        includeAllSupplierOptions,

        line,

      ),

    [catalogMatches, suppliersBySkuId, includeAllSupplierOptions, line],

  );



  const value = activeScopeLineSkuPickValue(line, picks);

  const singlePickKey =
    picks.length === 1
      ? `${picks[0]!.skuId}|${picks[0]!.supplierOption}|${picks[0]!.priceExcGst ?? ""}`
      : null;
  const onSelectSkuRef = useRef(onSelectSku);
  onSelectSkuRef.current = onSelectSku;
  /** One auto-apply per line + single-match identity (reset when match changes). */
  const autoApplyAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    autoApplyAttemptRef.current = null;
  }, [line.id, singlePickKey]);

  useEffect(() => {
    if (!autoApplySingleMatch || disabled || picks.length !== 1) return;
    if (autoApplyOnlyWhenEmptySku && (line.skuId ?? "").trim()) return;

    const only = picks[0]!;
    if (scopeLineMatchesSkuPick(line, only)) return;

    const attemptKey = `${line.id}|${singlePickKey}`;
    if (autoApplyAttemptRef.current === attemptKey) return;

    autoApplyAttemptRef.current = attemptKey;
    onSelectSkuRef.current(only);
  }, [
    autoApplySingleMatch,
    autoApplyOnlyWhenEmptySku,
    disabled,
    singlePickKey,
    line.id,
    line.skuId,
    line.supplierOption,
    line.customumprice,
    picks.length,
  ]);



  const labelClass =

    variant === "block"

      ? "text-xs text-teal-800 dark:text-teal-300"

      : `block truncate text-sm leading-tight ${

          value

            ? "text-sf-text dark:text-zinc-100"

            : "text-amber-800 dark:text-amber-300"

        }`;



  const optionLabel = (pick: ScopeLineSkuPick) => {
    if (includeAllSupplierOptions) {
      const price =
        pick.priceExcGst != null ? formatMoney(pick.priceExcGst) : "—";
      return scopeLineSkuPickAllModeLabel(pick, price);
    }
    const base = scopeLineSkuPickLabel(pick);
    if (!showSupplierPrice) return base;
    return pick.priceExcGst != null
      ? `${base} · ${formatMoney(pick.priceExcGst)} ex GST`
      : base;
  };



  const selectedPick = value

    ? picks.find(

        (p) => encodeScopeLineSkuPickValue(p.skuId, p.supplierOption) === value,

      )

    : undefined;



  if (picks.length === 0) {

    return (

      <span className={labelClass}>

        {shortMatchLabels ? "No matching SKU" : "SKU: No matching SKU"}

      </span>

    );

  }



  const matchBadge = shortMatchLabels

    ? `${picks.length} match${picks.length === 1 ? "" : "es"}`

    : `SKU (${picks.length} match${picks.length === 1 ? "" : "es"})`;



  if (inlineRow) {

    return (

      <div className="flex min-w-0 items-center gap-1">

        {showIncludeAllSupplierOptions ? (

          <label

            className="flex shrink-0 cursor-pointer items-center gap-0.5"

            title="Show all supplier priorities (not only priority 1)"

          >

            <input

              type="checkbox"

              className="h-3 w-3 shrink-0 rounded border-sf-border-strong"

              checked={includeAllSupplierOptions}

              disabled={disabled}

              onChange={(e) =>

                onIncludeAllSupplierOptionsChange?.(e.target.checked)

              }

            />

            <span className="text-[10px] font-medium leading-none text-sf-text-secondary dark:text-zinc-400">

              All

            </span>

          </label>

        ) : null}

        <span

          className="shrink-0 rounded bg-amber-100 px-1 py-px text-[10px] font-medium leading-none text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"

          title={matchBadge}

        >

          {picks.length}

        </span>

        <select

          className={`min-w-0 flex-1 ${selectClassName}`}

          disabled={disabled}

          value={value}

          onChange={(e) => {

            const decoded = decodeScopeLineSkuPickValue(e.target.value);

            if (!decoded) return;

            const hit = picks.find(

              (p) =>

                p.skuId === decoded.skuId &&

                p.supplierOption === decoded.supplierOption,

            );

            if (hit) onSelectSku(hit);

          }}

        >

          {picks.length > 1 ? <option value="">Select…</option> : null}

          {picks.map((pick) => (

            <option

              key={encodeScopeLineSkuPickValue(pick.skuId, pick.supplierOption)}

              value={encodeScopeLineSkuPickValue(pick.skuId, pick.supplierOption)}

            >

              {optionLabel(pick)}

            </option>

          ))}

        </select>

      </div>

    );

  }



  if (picks.length === 1 && !includeAllSupplierOptions) {

    const only = picks[0]!;

    const skuRow = catalogMatches.find((m) => m.skuId === only.skuId) ?? catalogMatches[0]!;

    return (

      <div className="min-w-0 truncate">

        <span className={`${labelClass} truncate`}>

          {shortMatchLabels ? skuOptionLabel(skuRow) : `SKU: ${skuOptionLabel(skuRow)}`}

        </span>

        {showSupplierPrice ? (

          <SkuPriceLine pick={only} variant={variant} />

        ) : null}

      </div>

    );

  }



  return (

    <label

      className={`flex min-w-0 flex-col justify-center gap-0.5 ${variant === "block" ? "" : "max-w-full"}`}

    >

      <span className="text-[10px] font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">

        {matchBadge}

      </span>

      <select

        className={selectClassName}

        disabled={disabled}

        value={value}

        onChange={(e) => {

          const decoded = decodeScopeLineSkuPickValue(e.target.value);

          if (!decoded) return;

          const hit = picks.find(

            (p) =>

              p.skuId === decoded.skuId &&

              p.supplierOption === decoded.supplierOption,

          );

          if (hit) onSelectSku(hit);

        }}

      >

        <option value="">Select SKU…</option>

        {picks.map((pick) => (

          <option

            key={encodeScopeLineSkuPickValue(pick.skuId, pick.supplierOption)}

            value={encodeScopeLineSkuPickValue(pick.skuId, pick.supplierOption)}

          >

            {optionLabel(pick)}

          </option>

        ))}

      </select>

      {showSupplierPrice && selectedPick ? (

        <SkuPriceLine pick={selectedPick} variant={variant} />

      ) : null}

    </label>

  );

}


