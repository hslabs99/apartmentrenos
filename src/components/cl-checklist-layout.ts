/**
 * Checklist (CL) scope/object row layout — single source of truth.
 * Checklist mode only (`ProjectChecklistPanel` with mode !== "workbench").
 *
 * Row 1: scope question + answer (inline, grouped).
 * Row 2: SKU · Measure · UOM · Non Std · Total price · Notes · Calculator · Actions (inline grid).
 */

export const CL_ANSWER_WIDTH = "20ch";
export const CL_SKU_WIDTH = "88ch";
export const CL_UOM_WIDTH = "10ch";
export const CL_MEASURE_WIDTH = "10ch";
export const CL_NON_STD_WIDTH = "5.5rem";
export const CL_TOTAL_PRICE_WIDTH = "10ch";
export const CL_NOTES_WIDTH = "2rem";
export const CL_CALCULATOR_WIDTH = "2rem";
export const CL_ACTIONS_WIDTH = "2rem";

/** Shared control height for checklist SKU / measure / UOM inputs (one row). */
export const CL_FIELD_CONTROL_HEIGHT_CLASS = "h-8";

export const CL_FIELDS_GRID_COLUMNS = `${CL_SKU_WIDTH} ${CL_MEASURE_WIDTH} ${CL_UOM_WIDTH} ${CL_NON_STD_WIDTH} ${CL_TOTAL_PRICE_WIDTH} ${CL_NOTES_WIDTH} ${CL_CALCULATOR_WIDTH} ${CL_ACTIONS_WIDTH}`;

export const clFieldsGridStyle = {
  gridTemplateColumns: CL_FIELDS_GRID_COLUMNS,
} as const;

export const clFieldsGridClass =
  "inline-grid w-max max-w-full items-end justify-items-stretch gap-x-1.5 px-4";

/** Scope card header: question/answer left, … menu top-right */
export const clScopeQuestionHeaderBarClass =
  "mb-1.5 flex w-full items-start justify-between gap-x-3 px-4";

/** Question + answer grouped at left (inside header bar) */
export const clScopeQuestionAnswerRowClass =
  "flex min-w-0 max-w-full flex-wrap items-center gap-x-3";

export const clScopeQuestionAnswerGroupClass =
  "flex shrink-0 items-center gap-x-3";

/** Question row with blinds fields — align answer + blinds selects (not question text). */
export const clScopeQuestionAnswerGroupBlindsClass =
  "flex shrink-0 items-end gap-x-3";

export const clInlineFieldLabelClass =
  "mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-sf-text-weak dark:text-zinc-400";

export const clScopeQuestionTextClass =
  "shrink-0 text-left text-base font-semibold leading-snug text-sf-brand dark:text-zinc-100";

/** Metric inputs row — directly under scope question + answer. */
export const clScopeMetricsRowClass =
  "mb-1.5 flex w-max max-w-full flex-wrap items-end gap-x-4 gap-y-2 px-4";

/** Object name on rows without inline answer (extra object lines) */
export const clObjectNameRowClass =
  "mb-1.5 flex w-max max-w-full flex-wrap items-baseline gap-x-2 px-4 text-left";

export const clObjectNameTextClass =
  "block min-w-0 text-left text-base font-semibold leading-snug text-sf-brand dark:text-zinc-100";

export const clScopeLineStackClass =
  "w-full max-w-full border-b border-sf-border bg-sf-surface py-2 transition-colors hover:bg-sf-accent-muted/30 dark:border-zinc-700 dark:bg-zinc-900/40";

/** Answer on the question row (no left padding — row provides pl-3); width via clAnswerWidthCh. */
export const clAnswerInlineFieldClass =
  "flex shrink-0 flex-col gap-0.5 overflow-hidden";

/** Thin rule between scope question/answer row and SKU field row. */
export const clScopeQuestionSkuDividerClass =
  "my-1.5 ml-4 mr-4 h-px shrink-0 border-0 bg-sf-border dark:bg-zinc-700";

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

/** Non Std — rounded control matching v0 line rows. */
export const clActionBtnClass =
  "min-h-8 shrink-0 rounded-lg border border-sf-border bg-sf-page px-3 py-1 text-xs font-semibold text-sf-text-weak transition hover:border-sf-border-strong hover:text-sf-text-secondary disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";

/** Shared line-row icon button (notes / calculator / …). */
export const clRowIconBtnClass =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-sf-border bg-sf-surface text-sf-text-weak transition hover:border-sf-border-strong hover:text-sf-text disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** Shared glyph size inside clRowIconBtnClass. */
export const clRowIconGlyphClass = "h-3.5 w-3.5";

/** Calculator trigger — icon only, no nested button chrome. */
export const clCalculatorIconBtnClass = clRowIconBtnClass;

/** Area-header calculator / notes / ⋮ on dark slate bar — same hit target always. */
export const clAreaHdrIconBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

/** Glyph inside clAreaHdrIconBtnClass (notes + ⋮ match). */
export const clAreaHdrIconGlyphClass = "h-4 w-4";

/** @deprecated Use clAreaHdrIconBtnClass */
export const clAreaHdrCalculatorBtnClass = clAreaHdrIconBtnClass;

/**
 * Project header notes / ⋮ — 25% larger than area header (h-8 → h-10).
 * Keep notes and ⋮ on the same class so they stay matched.
 */
export const clProjectHdrIconBtnClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-sf-border bg-sf-surface text-sf-text-weak shadow-sm transition hover:border-sf-border-strong hover:bg-sf-page hover:text-sf-text disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** Glyph inside clProjectHdrIconBtnClass (notes + ⋮ match). */
export const clProjectHdrIconGlyphClass = "h-5 w-5";

/** Project name in checklist project header — text-lg (1.125rem) × 1.25. */
export const clProjectHdrNameClass =
  "text-[1.40625rem] font-bold leading-tight text-sf-brand dark:text-zinc-50";

/** Object / scope line calculator icon size. */
export const clCalculatorIconClass = clRowIconGlyphClass;

/** Area header calculator icon — same as other area header glyphs. */
export const clAreaCalculatorIconClass = clAreaHdrIconGlyphClass;

/** Area name + nickname group in the checklist area header. */
export const clAreaNameNicknameGroupClass = "flex shrink-0 items-end gap-x-3";

/** Nickname field stack (label + input) beside the template area name. */
export const clAreaNicknameFieldClass = "flex shrink-0 flex-col gap-0.5";

/** Nickname text input — display-only label, not used as a key. */
export const clAreaNicknameInputClass =
  "h-8 w-[18ch] max-w-full rounded-md border border-white/20 bg-white/10 px-2.5 text-xs text-white outline-none placeholder:text-white/30 focus:bg-white/15 focus:ring-2 focus:ring-sf-accent/60";

export const clActionBtnActiveClass =
  "rounded-lg border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";

/** Destructive checklist action (e.g. remove area from project). */
export const clActionBtnDangerClass =
  "min-h-8 shrink-0 rounded-lg border border-red-400 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-red-800 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-800 dark:text-red-200 dark:hover:bg-red-950/40";

export const clNonStdCellClass =
  "flex shrink-0 items-end self-end pb-0.5 pr-3";

export const clTotalPriceFieldClass =
  "flex w-[10ch] max-w-[10ch] shrink-0 flex-col gap-0.5 overflow-hidden";

export const clScopeSkuColClass = "col-start-1";

export const clScopeMeasureColClass = "col-start-2";

export const clScopeUomColClass = "col-start-3";

export const clScopeNonStdColClass = "col-start-4";

export const clScopeTotalPriceColClass = "col-start-5";

export const clScopeNotesColClass = "col-start-6";

export const clScopeCalculatorColClass = "col-start-7";

export const clScopeActionsColClass = "col-start-8";

/** Notes icon + optional count — fixed grid track width. */
export const clNotesCellClass =
  `flex w-full min-w-0 shrink-0 items-end justify-center self-end ${CL_FIELD_CONTROL_HEIGHT_CLASS}`;

/** Calculator icon slot — always reserved so action column aligns. */
export const clCalculatorCellClass =
  `flex w-full min-w-0 shrink-0 items-end justify-center self-end ${CL_FIELD_CONTROL_HEIGHT_CLASS}`;

/** Line … menu (and manual-line delete) — right-aligned in fixed track. */
export const clActionsCellClass =
  `flex w-full min-w-0 shrink-0 items-end justify-center gap-0 self-end ${CL_FIELD_CONTROL_HEIGHT_CLASS}`;

/** Fixed scroll-context rail (area + project totals) — viewport-left, works on tablet. */
export const clScrollContextRailClass =
  "pointer-events-none fixed bottom-5 left-5 z-50 min-w-[10.5rem] overflow-hidden rounded-xl border border-sf-border bg-sf-surface/90 shadow-lg shadow-black/10 backdrop-blur-sm dark:border-zinc-600 dark:bg-zinc-900/95";

export const clScrollContextRailSectionClass = "min-w-0 space-y-0.5 px-4";

export const clScrollContextRailAreaLabelClass =
  "mb-0.5 block text-[9px] font-bold uppercase tracking-widest text-sf-text-weak dark:text-zinc-400";

export const clScrollContextRailAreaNameClass =
  "block truncate text-sm font-bold leading-tight text-sf-brand dark:text-zinc-50";

export const clScrollContextRailSectionLabelClass =
  "mt-1.5 block text-[9px] font-semibold uppercase tracking-wider text-sf-text-weak dark:text-zinc-400";

export const clScrollContextRailMoneyClass =
  "block text-base font-bold tabular-nums text-sf-accent dark:text-emerald-300";

export const clScrollContextRailDividerClass =
  "my-0 h-px w-full bg-sf-border/70 dark:bg-zinc-700";

export const clScrollContextRailAccentBarClass = "h-0.5 bg-sf-accent";
