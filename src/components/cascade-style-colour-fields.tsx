"use client";

import {
  cascadeColoursForLevelStyle,
  cascadeStylesForLevel,
  withSavedChoice,
  type CascadeRow,
} from "@/lib/cascades/cascade-filter-options";
import { useMemo } from "react";

function stripSavedSuffix(value: string): string {
  const m = value.match(/^(.+)\s+\(saved\)$/i);
  return m ? m[1]!.trim() : value.trim();
}

const compactLabelClass =
  "mb-0.5 block text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400";

function useCascadeColourOptions(
  cascades: CascadeRow[],
  level: string,
  styleForFilter: string,
  savedColour: string,
) {
  const levelTrim = level.trim();
  const filterStyleTrim = styleForFilter.trim();
  return useMemo(() => {
    const base = cascadeColoursForLevelStyle(cascades, levelTrim, filterStyleTrim);
    return withSavedChoice(base, savedColour.trim());
  }, [cascades, levelTrim, filterStyleTrim, savedColour]);
}

type CascadeColourSelectProps = {
  cascades: CascadeRow[];
  level: string;
  /** Style used to filter colours from cascades (may differ from stored override when inheriting). */
  styleForFilter: string;
  colour: string;
  onColourChange: (value: string) => void;
  disabled?: boolean;
  selectClassName: string;
  emptyLabel?: string;
  label?: string;
  /** compact = label above select (workbench table cell). */
  layout?: "inline" | "compact";
  /** compact layout: omit label (parent renders column header). */
  suppressLabel?: boolean;
};

export function CascadeColourSelect({
  cascades,
  level,
  styleForFilter,
  colour,
  onColourChange,
  disabled = false,
  selectClassName,
  emptyLabel = "Default",
  label,
  layout = "inline",
  suppressLabel = false,
}: CascadeColourSelectProps) {
  const levelTrim = level.trim();
  const filterStyleTrim = styleForFilter.trim();
  const colourOptions = useCascadeColourOptions(cascades, level, styleForFilter, colour);
  const colourDisabled = disabled || !levelTrim || !filterStyleTrim;

  const select = (
    <select
      className={selectClassName}
      disabled={colourDisabled}
      value={colour}
      title={
        !levelTrim
          ? "Set price level first"
          : !filterStyleTrim
            ? "Set style first"
            : undefined
      }
      onChange={(e) => onColourChange(stripSavedSuffix(e.target.value))}
    >
      <option value="">{emptyLabel}</option>
      {colourOptions.map((opt) => (
        <option key={opt} value={opt.includes("(saved)") ? stripSavedSuffix(opt) : opt}>
          {opt}
        </option>
      ))}
    </select>
  );

  if (layout === "compact" && label && !suppressLabel) {
    return (
      <label className="flex min-w-0 flex-col gap-0.5">
        <span className={compactLabelClass}>{label}</span>
        {select}
      </label>
    );
  }

  return select;
}

type Props = {
  cascades: CascadeRow[];
  /** Cascade level name (Price Level display name / SKU elevate level). */
  level: string;
  style: string;
  colour: string;
  onStyleChange: (value: string) => void;
  onColourChange: (value: string) => void;
  disabled?: boolean;
  selectClassName: string;
  styleLabel?: string;
  colourLabel?: string;
  styleEmptyLabel?: string;
  colourEmptyLabel?: string;
  /** When set, filters colour options (e.g. project default style while area style override is empty). */
  colourFilterStyle?: string;
  /** compact = label above each select, fields in one horizontal group (workbench). */
  layout?: "inline" | "compact";
  /** With layout compact: render only style or colour (for column-aligned area header cells). */
  compactField?: "style" | "colour";
  styleSelectClassName?: string;
  colourSelectClassName?: string;
  /** compact + compactField: omit label (parent renders column header). */
  suppressLabel?: boolean;
};

export function CascadeStyleColourFields({
  cascades,
  level,
  style,
  colour,
  onStyleChange,
  onColourChange,
  disabled = false,
  selectClassName,
  styleLabel = "Style",
  colourLabel = "Colour",
  styleEmptyLabel = "Not set",
  colourEmptyLabel = "Not set",
  colourFilterStyle,
  layout = "inline",
  compactField,
  styleSelectClassName,
  colourSelectClassName,
  suppressLabel = false,
}: Props) {
  const levelTrim = level.trim();
  const styleTrim = style.trim();
  const filterStyleTrim = (colourFilterStyle ?? style).trim();

  const styleOptions = useMemo(() => {
    const base = cascadeStylesForLevel(cascades, levelTrim);
    return withSavedChoice(base, styleTrim);
  }, [cascades, levelTrim, styleTrim]);

  const colourOptions = useCascadeColourOptions(cascades, level, colourFilterStyle ?? style, colour);

  const colourDisabled = disabled || !levelTrim || !filterStyleTrim;
  const styleSelectCls = styleSelectClassName ?? selectClassName;
  const colourSelectCls = colourSelectClassName ?? selectClassName;

  const styleSelect = (
    <select
      className={styleSelectCls}
      disabled={disabled || !levelTrim}
      value={style}
      title={!levelTrim ? "Set price level first" : undefined}
      onChange={(e) => {
        const v = e.target.value;
        onStyleChange(stripSavedSuffix(v));
        onColourChange("");
      }}
    >
      <option value="">{styleEmptyLabel}</option>
      {styleOptions.map((opt) => (
        <option key={opt} value={opt.includes("(saved)") ? stripSavedSuffix(opt) : opt}>
          {opt}
        </option>
      ))}
    </select>
  );

  const colourSelect = (
    <select
      className={colourSelectCls}
      disabled={colourDisabled}
      value={colour}
      title={
        !levelTrim
          ? "Set price level first"
          : !filterStyleTrim
            ? "Set style first"
            : undefined
      }
      onChange={(e) => onColourChange(stripSavedSuffix(e.target.value))}
    >
      <option value="">{colourEmptyLabel}</option>
      {colourOptions.map((opt) => (
        <option key={opt} value={opt.includes("(saved)") ? stripSavedSuffix(opt) : opt}>
          {opt}
        </option>
      ))}
    </select>
  );

  if (layout === "compact") {
    if (compactField === "style") {
      return suppressLabel ? (
        styleSelect
      ) : (
        <label className="flex min-w-0 flex-col gap-0.5">
          <span className={compactLabelClass}>{styleLabel}</span>
          {styleSelect}
        </label>
      );
    }
    if (compactField === "colour") {
      return suppressLabel ? (
        colourSelect
      ) : (
        <label className="flex min-w-0 flex-col gap-0.5">
          <span className={compactLabelClass}>{colourLabel}</span>
          {colourSelect}
        </label>
      );
    }
    return (
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <label className="flex flex-col gap-0.5">
          <span className={compactLabelClass}>{styleLabel}</span>
          {styleSelect}
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={compactLabelClass}>{colourLabel}</span>
          {colourSelect}
        </label>
      </div>
    );
  }

  return (
    <>
      <span className="text-sm font-medium text-sf-text dark:text-zinc-200">{styleLabel}</span>
      {styleSelect}
      <span className="text-sm font-medium text-sf-text dark:text-zinc-200">{colourLabel}</span>
      {colourSelect}
    </>
  );
}
