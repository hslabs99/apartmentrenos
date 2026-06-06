/**
 * Checklist (CL) scope/object row layout — single source of truth.
 * Checklist mode only (`ProjectChecklistPanel` with mode !== "workbench").
 *
 * Row 1: scope question + answer (inline, grouped).
 * Row 2: SKU · Measure · UOM · Non Std (inline grid; card width = column tracks).
 */

export const CL_ANSWER_WIDTH = "20ch";
export const CL_SKU_WIDTH = "88ch";
export const CL_UOM_WIDTH = "10ch";
export const CL_MEASURE_WIDTH = "10ch";
export const CL_NON_STD_WIDTH = "5.5rem";
export const CL_TOTAL_PRICE_WIDTH = "10ch";
export const CL_TOOL_WIDTH = "2.25rem";

/** Shared control height for checklist SKU / measure / UOM inputs (one row). */
export const CL_FIELD_CONTROL_HEIGHT_CLASS = "h-[1.625rem]";

export const CL_FIELDS_GRID_COLUMNS = `${CL_SKU_WIDTH} ${CL_MEASURE_WIDTH} ${CL_UOM_WIDTH} ${CL_NON_STD_WIDTH} ${CL_TOTAL_PRICE_WIDTH} ${CL_TOOL_WIDTH}`;

export const clFieldsGridStyle = {
  gridTemplateColumns: CL_FIELDS_GRID_COLUMNS,
} as const;

export const clFieldsGridClass =
  "inline-grid w-max max-w-full items-end justify-items-stretch gap-x-1.5 pl-3";

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

/** Answer on the question row (no left padding — row provides pl-3); width via clAnswerWidthCh. */
export const clAnswerInlineFieldClass =
  "flex shrink-0 flex-col gap-0.5 overflow-hidden";

/** Thin rule between scope question/answer row and SKU field row. */
export const clScopeQuestionSkuDividerClass =
  "my-1.5 ml-3 mr-3 h-px shrink-0 border-0 bg-sf-border dark:bg-zinc-700";

/** Longest answer label length + 10% padding, in `ch` (checklist scope answer select). */
export function clAnswerWidthCh(answers: readonly { label: string }[]): string {
  let maxLen = 0;
  for (const a of answers) {
    if (a.label.length > maxLen) maxLen = a.label.length;
  }
  const padded = Math.ceil(Math.max(maxLen, 1) * 1.1);
  return `${padded}ch`;
}

export const clSkuFieldClass =
  "flex w-full min-w-0 shrink-0 flex-col gap-0.5 overflow-hidden";

export const clSkuPickerWrapClass =
  `flex w-full min-w-0 max-w-full items-center overflow-hidden ${CL_FIELD_CONTROL_HEIGHT_CLASS}`;

/** Width/truncation for SKU select inside clSkuFieldClass (combine with selectBase in panel). */
export const clSkuSelectExtraClass =
  `box-border block w-full min-w-0 max-w-full truncate text-xs leading-tight py-0 ${CL_FIELD_CONTROL_HEIGHT_CLASS}`;

export const clUomFieldClass =
  "flex w-[10ch] max-w-[10ch] shrink-0 flex-col gap-0.5 overflow-hidden";

export const clMeasureFieldClass =
  "flex w-[10ch] max-w-[10ch] shrink-0 flex-col gap-0.5 overflow-hidden";

/** Non Std, Add scope, Add object — square border, light grey background. */
export const clActionBtnClass =
  "min-h-8 shrink-0 rounded-none border border-sf-border-strong bg-zinc-100 px-2.5 py-1 text-xs font-medium text-sf-text transition hover:bg-zinc-200/90 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700";

export const clActionBtnActiveClass =
  "rounded-none border-red-500 bg-zinc-100 text-red-900 hover:bg-zinc-200/90 dark:border-red-600 dark:bg-zinc-800 dark:text-red-200 dark:hover:bg-zinc-700";

/** Destructive checklist action (e.g. remove area from project). */
export const clActionBtnDangerClass =
  "min-h-8 shrink-0 rounded-none border border-red-400 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-red-800 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-800 dark:text-red-200 dark:hover:bg-red-950/40";

export const clNonStdCellClass =
  "flex shrink-0 items-end self-end pb-0.5 pr-3";

export const clTotalPriceFieldClass =
  "flex w-[10ch] max-w-[10ch] shrink-0 flex-col gap-0.5 overflow-hidden";

export const clScopeSkuColClass = "col-start-1";

export const clScopeMeasureColClass = "col-start-2";

export const clScopeUomColClass = "col-start-3";

export const clScopeNonStdColClass = "col-start-4";

export const clScopeTotalPriceColClass = "col-start-5";

export const clScopeToolColClass = "col-start-6";

export const clToolCellClass =
  "flex shrink-0 items-end self-end pb-0.5";
