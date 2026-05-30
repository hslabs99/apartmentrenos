/**
 * Checklist (CL) scope/object row layout — single source of truth.
 * Checklist mode only (`ProjectChecklistPanel` with mode !== "workbench").
 *
 * Row 1: scope question + answer (inline, grouped).
 * Row 2: SKU · Measure · UOM · Non Std (inline grid; card width = column tracks).
 */

export const CL_ANSWER_WIDTH = "20ch";
export const CL_SKU_WIDTH = "70ch";
export const CL_UOM_WIDTH = "10ch";
export const CL_MEASURE_WIDTH = "10ch";
export const CL_NON_STD_WIDTH = "5.5rem";

export const CL_FIELDS_GRID_COLUMNS = `minmax(0, ${CL_SKU_WIDTH}) minmax(0, ${CL_MEASURE_WIDTH}) minmax(0, ${CL_UOM_WIDTH}) ${CL_NON_STD_WIDTH}`;

export const clFieldsGridStyle = {
  gridTemplateColumns: CL_FIELDS_GRID_COLUMNS,
} as const;

export const clFieldsGridClass =
  "inline-grid w-max max-w-full items-end justify-items-start gap-x-1.5 pl-3";

/** Question + answer grouped at left */
export const clScopeQuestionAnswerRowClass =
  "mb-1.5 flex w-max max-w-full flex-wrap items-center gap-x-3 pl-3 pr-3";

export const clScopeQuestionAnswerGroupClass =
  "flex shrink-0 items-center gap-x-3";

/** Question row with blinds fields — align answer + blinds selects (not question text). */
export const clScopeQuestionAnswerGroupBlindsClass =
  "flex shrink-0 items-end gap-x-3";

export const clInlineFieldLabelClass =
  "mb-0.5 block text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400";

export const clScopeQuestionTextClass =
  "shrink-0 text-left text-[1.3125rem] font-semibold leading-snug text-sf-text dark:text-zinc-100";

/** Object name on rows without inline answer (extra object lines) */
export const clObjectNameRowClass =
  "mb-1.5 flex w-max max-w-full flex-wrap items-baseline gap-x-2 pl-3 text-left";

export const clObjectNameTextClass =
  "block min-w-0 text-left text-[1.3125rem] font-semibold leading-snug text-sf-text dark:text-zinc-100";

export const clScopeLineStackClass = "w-max max-w-full";

/** Answer on the question row (no left padding — row provides pl-3) */
export const clAnswerInlineFieldClass =
  "flex w-[20ch] max-w-[20ch] shrink-0 flex-col gap-0.5 overflow-hidden";

export const clSkuFieldClass =
  "flex w-[70ch] max-w-[70ch] shrink-0 flex-col gap-0.5 overflow-hidden";

export const clSkuPickerWrapClass =
  "flex min-h-[2.125rem] w-full min-w-0 max-w-full items-center overflow-hidden";

/** Width/truncation for SKU select inside clSkuFieldClass (combine with selectBase in panel). */
export const clSkuSelectExtraClass =
  "block w-full min-w-0 max-w-full truncate text-xs py-0.5";

export const clUomFieldClass =
  "flex w-[10ch] max-w-[10ch] shrink-0 flex-col gap-0.5 overflow-hidden";

export const clMeasureFieldClass =
  "flex w-[10ch] max-w-[10ch] shrink-0 flex-col gap-0.5 overflow-hidden";

export const clNonStdCellClass =
  "flex shrink-0 items-end self-end pb-0.5 pr-3 [&_button]:min-h-[1.375rem] [&_button]:py-1";

export const clScopeSkuColClass = "col-start-1";

export const clScopeMeasureColClass = "col-start-2";

export const clScopeUomColClass = "col-start-3";

export const clScopeNonStdColClass = "col-start-4";
