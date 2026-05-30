"use client";

import { BLIND_GENERIC_COLOURS } from "@/lib/blinds/blinds-generic-colours";
import {
  blindTypesForDropWidth,
  blindsSkuDisplayLabel,
  uniqueBlindDropValues,
  uniqueBlindWidthValues,
} from "@/lib/blinds/blinds-data-utils";
import type { DataBlindPublic } from "@/types/data-blind-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import { clInlineFieldLabelClass } from "@/components/cl-checklist-layout";
import { useMemo } from "react";

const labelClass = clInlineFieldLabelClass;

/** Inline CL row — style widened +50% from prior 12.5rem / 22.5rem max. */
const inlineStyleFieldClass = "flex w-[18.75rem] max-w-[33.75rem] shrink-0 flex-col gap-0.5";
const inlineColourFieldClass = "flex w-[6rem] shrink-0 flex-col gap-0.5";
const inlineStyleColourGroupClass = "flex shrink-0 items-end gap-x-1";

type BlindsPatch = {
  blindDropMm?: number | null;
  blindWidthMm?: number | null;
  blindType?: string | null;
  blindColour?: string | null;
};

type Props = {
  line: ProjectAreaObjectPublic;
  blindsRows: DataBlindPublic[];
  disabled?: boolean;
  selectClassName: string;
  dropWidthSelectClassName?: string;
  layout?: "inline" | "stacked";
  showSkuSummary?: boolean;
  onPatch: (patch: BlindsPatch) => void | Promise<void>;
};

export function BlindsScopeFields({
  line,
  blindsRows,
  disabled = false,
  selectClassName,
  dropWidthSelectClassName,
  layout = "inline",
  showSkuSummary = true,
  onPatch,
}: Props) {
  const dropOptions = useMemo(() => uniqueBlindDropValues(blindsRows), [blindsRows]);
  const widthOptions = useMemo(() => uniqueBlindWidthValues(blindsRows), [blindsRows]);

  const styleOptions = useMemo(() => {
    if (line.blindDropMm == null || line.blindWidthMm == null) return [];
    return blindTypesForDropWidth(blindsRows, line.blindDropMm, line.blindWidthMm);
  }, [blindsRows, line.blindDropMm, line.blindWidthMm]);

  const wrapClass =
    layout === "inline"
      ? "flex flex-wrap items-end gap-x-2 gap-y-2"
      : "grid gap-3 sm:grid-cols-2";

  const dropWidthSelect = dropWidthSelectClassName ?? selectClassName;
  const fillSelectClass = `${selectClassName} !w-full !min-w-0 !max-w-full`;

  const styleField = (
    <label className={layout === "inline" ? inlineStyleFieldClass : "flex min-w-[18.75rem] max-w-[33.75rem] flex-col gap-0.5"}>
      <span className={labelClass}>Style</span>
      <select
        className={layout === "inline" ? fillSelectClass : selectClassName}
        disabled={disabled || line.blindDropMm == null || line.blindWidthMm == null}
        value={line.blindType ?? ""}
        onChange={(e) => void onPatch({ blindType: e.target.value === "" ? null : e.target.value })}
      >
        <option value="">
          {line.blindDropMm == null || line.blindWidthMm == null
            ? "Pick drop & width"
            : styleOptions.length === 0
              ? "No styles"
              : "Select…"}
        </option>
        {styleOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );

  const colourField = (
    <label className={layout === "inline" ? inlineColourFieldClass : "flex min-w-[6rem] flex-col gap-0.5"}>
      <span className={labelClass}>Colour</span>
      <select
        className={layout === "inline" ? fillSelectClass : selectClassName}
        disabled={disabled}
        value={line.blindColour ?? ""}
        onChange={(e) =>
          void onPatch({ blindColour: e.target.value === "" ? null : e.target.value })
        }
      >
        <option value="">Select…</option>
        {BLIND_GENERIC_COLOURS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className={wrapClass}>
      <label className="flex min-w-[0.875rem] flex-col gap-0.5">
        <span className={labelClass}>Drop</span>
        <select
          className={dropWidthSelect}
          disabled={disabled}
          value={line.blindDropMm ?? ""}
          onChange={(e) => {
            const blindDropMm = e.target.value === "" ? null : Number(e.target.value);
            void onPatch({
              blindDropMm: Number.isFinite(blindDropMm) ? blindDropMm : null,
              blindType: null,
            });
          }}
        >
          <option value="">Select…</option>
          {dropOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[0.875rem] flex-col gap-0.5">
        <span className={labelClass}>Width</span>
        <select
          className={dropWidthSelect}
          disabled={disabled}
          value={line.blindWidthMm ?? ""}
          onChange={(e) => {
            const blindWidthMm = e.target.value === "" ? null : Number(e.target.value);
            void onPatch({
              blindWidthMm: Number.isFinite(blindWidthMm) ? blindWidthMm : null,
              blindType: null,
            });
          }}
        >
          <option value="">Select…</option>
          {widthOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
      {layout === "inline" ? (
        <div className={inlineStyleColourGroupClass}>
          {styleField}
          {colourField}
        </div>
      ) : (
        <>
          {styleField}
          {colourField}
        </>
      )}
      {showSkuSummary ? (
        <div className="flex min-w-[12rem] max-w-[28rem] flex-col gap-0.5">
          <span className={labelClass}>SKU</span>
          <div
            className="min-h-[2.125rem] rounded border border-sf-border-strong bg-sf-page px-2 py-1.5 text-xs text-sf-text dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            title={blindsSkuDisplayLabel(line)}
          >
            {blindsSkuDisplayLabel(line)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
