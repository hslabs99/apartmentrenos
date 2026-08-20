"use client";

import {
  CascadeColourSelect,
  CascadeStyleColourFields,
} from "@/components/cascade-style-colour-fields";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ClNonStdTierModal,
  ClNonStdTierOpenButton,
  hasClNonStandardTierStyleColour,
  type ClNonStdModalTarget,
} from "@/components/cl-non-std-tier-style-colour";
import { ClTotalPriceCell } from "@/components/cl-total-price-cell";
import { ClSkuPickerSlot } from "@/components/cl-sku-picker-slot";
import { ClLabourProductDisplay } from "@/components/cl-labour-product-display";
import { BlindsScopeEditModal } from "@/components/blinds-scope-edit-modal";
import { BlindsScopeFields } from "@/components/blinds-scope-fields";
import { BlindsWorkbenchSkuLink } from "@/components/blinds-workbench-sku-link";
import { WbBuildingElementConsumptionModal } from "@/components/wb-building-element-consumption-modal";
import { WbPaintingElementConsumptionModal } from "@/components/wb-painting-element-consumption-modal";
import { WbBuildingElementSkuCell } from "@/components/wb-building-element-sku-cell";
import { ClAreaHeaderMenu } from "@/components/cl-area-header-menu";
import { ClLineRowMenu } from "@/components/cl-line-row-menu";
import { ClProjectHeaderMenu } from "@/components/cl-project-header-menu";
import {
  ClScrollContextRail,
  clAreaAnchorId,
  type ClScrollContextArea,
} from "@/components/cl-scroll-context-rail";
import { ClScopeActionsMenu } from "@/components/cl-scope-actions-menu";
import {
  ClScopeCollapseButton,
  clScopeBodyExpandKey,
  clScopeLineHasPositiveQuantity,
  clScopeSkuBodyDomId,
  useClScopeBodyExpanded,
} from "@/components/cl-scope-collapse-button";
import { clProjectHdrNameClass } from "@/components/cl-checklist-layout";
import { WbAreaHdrMenu } from "@/components/wb-area-hdr-menu";
import { WbProjectSummary } from "@/components/wb-project-summary";
import { WbAreaSummary } from "@/components/wb-area-summary";
import { WbProjectHdrMenu } from "@/components/wb-project-hdr-menu";
import {
  WbCompressToggle,
  useWbCompressZeroMeasure,
} from "@/components/wb-compress-toggle";
import { WbLineRowMenu } from "@/components/wb-line-row-menu";
import { AddObjectPickerModal } from "@/components/add-object-picker-modal";
import { AddScopePickerModal } from "@/components/add-scope-picker-modal";
import {
  clAnswerInlineFieldClass,
  clAnswerWidthCh,
  clScopeQuestionSkuDividerClass,
  clScopeQuestionHeaderBarClass,
  clScopeQuestionAnswerRowClass,
  CL_FIELD_CONTROL_HEIGHT_CLASS,
  clInlineFieldLabelClass,
  clFieldsGridClass,
  clFieldsGridStyle,
  clMeasureFieldClass,
  clNonStdCellClass,
  clObjectNameRowClass,
  clObjectNameTextClass,
  clScopeLineStackClass,
  clScopeMeasureColClass,
  clScopeNonStdColClass,
  clScopeTotalPriceColClass,
  clTotalPriceFieldClass,
  clScopeNotesColClass,
  clScopeCalculatorColClass,
  clScopeActionsColClass,
  clNotesCellClass,
  clCalculatorCellClass,
  clActionsCellClass,
  clScopeQuestionAnswerGroupClass,
  clScopeQuestionAnswerGroupBlindsClass,
  clScopeQuestionTextClass,
  clScopeSkuColClass,
  clScopeUomColClass,
  clSkuFieldClass,
  clSkuSelectExtraClass,
  clUomFieldClass,
  clAreaNameNicknameGroupClass,
  clAreaNicknameFieldClass,
  clAreaNicknameInputClass,
} from "@/components/cl-checklist-layout";
import { ScopeLineMeasureTool, ScopeToolAfterAnswer } from "@/components/scope-tool-modal";
import { ScopeLineSkuPicker } from "@/components/scope-line-sku-picker";
import {
  ScopeLineBundledChildren,
  type WorkbenchBundledContext,
} from "@/components/scope-line-bundled-children";
import { applyScopeLineSkuWithBundledChildren } from "@/lib/client/apply-scope-line-sku-selection";
import {
  buildBuildingElementIndex,
  findBuildingElementForLine,
} from "@/lib/client/building-element-index";
import {
  buildPaintingElementIndex,
  findPaintingElementForLine,
} from "@/lib/client/painting-element-index";
import { partitionAreaLines } from "@/lib/client/partition-area-lines";
import {
  compareProjectAreaLineOrder,
  sortProjectAreaLines,
  workbenchFlatDisplayLines,
} from "@/lib/project-area-line-order";
import { isManual2Line } from "@/lib/client/manual2-line";
import {
  lineExtendedTotalBreakdownTitle,
  lineExtendedTotalExcGst,
  lineFinalPrice,
  lineFinalPriceBreakdown,
  lineFinalPriceBreakdownTitle,
} from "@/lib/client/line-final-price";
import {
  resolveScopeLineSkuUnitPriceExcGst,
  scopeLineMatchesSkuPick,
  scopeLineSkuPickWithResolvedPrice,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import { IconTrash } from "@/components/icons/lightning-icons";
import { ProjectAreaStatusSelect } from "@/components/project-area-status-select";
import {
  ProjectNotesButton,
  WB_ICON_BTN_CLASS,
  WB_ICON_GLYPH_CLASS,
  type ProjectNoteAreaOption,
  type ProjectNoteObjectOption,
} from "@/components/project-notes-button";
import { ModalFrame } from "@/components/modal-frame";
import { CascadeElevateSelect } from "@/components/cascade-elevate-select";
import { PriceLevelIdSelect } from "@/components/price-level-id-select";
import { ProjectsTabs } from "@/components/projects-tabs";
import { useLookups } from "@/lib/client/use-lookups";
import { useLookupsColours } from "@/lib/client/use-lookups-colours";
import { ChecklistMeasureInput } from "@/components/checklist-measure-input";
import { ScopeChecklistMetricsRow } from "@/components/scope-checklist-metrics-row";
import { ScopeWorkbenchMetricsRow } from "@/components/scope-workbench-metrics-row";
import { checklistMeasureLockedByScopeMetric } from "@/lib/checklist-effective-measure";
import {
  resolveScopeLineInheritMeasureLocked,
  resolveScopeLineInheritMeasureSource,
} from "@/lib/inherit-m2-source";
import { checklistInheritedMeasureForRow } from "@/lib/checklist-effective-measure";
import { scopeMetricsForAnswer, scopeMetricValuesMapForInstance, collectScopeMetricEntriesForProjectArea } from "@/lib/scope-metrics";
import { ChecklistProjectDimensionsRow } from "@/components/checklist-project-dimensions-row";
import { ProjectAreaCeilingHeightField } from "@/components/project-area-ceiling-height-field";
import { ProjectAreaM2Calculator } from "@/components/project-area-m2-calculator";
import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import {
  projectAreaHeading,
  projectAreaTemplateName,
} from "@/lib/project-area-display-name";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import { defaultTrueAnswerId, singleYesAnswerId } from "@/lib/scope-single-yes-answer";
import {
  redundantScopeEntriesForProject,
  redundantScopeEntriesForProjectArea,
  type RedundantScopeEntry,
} from "@/lib/redundant-scopes-for-project-area";
import { scopesForProjectArea } from "@/lib/scopes-for-project-area";
import {
  collectScopeInstanceIds,
  matchesScopeInstance,
  scopeAnswerSavingKey,
} from "@/lib/scope-instance";
import {
  marginPercentFromSettings,
  parseMarginPercent,
  projectMarginPercent,
} from "@/lib/settings-margin";
import { contractLabourRateBySiloProduct, labourSiloCostExcGst } from "@/lib/labour-rate-lookup";
import {
  LOOKUP_LABOUR_SILO_KEYS,
  WB_WORKBENCH_LABOUR_SILO_HEADERS,
  type LabourSiloKey,
} from "@/lib/labour-silo";
import { applyLookupLabourToProjectLine } from "@/lib/client/apply-lookup-labour-to-line";
import {
  lookupLabourUpdatesForLines,
  persistWorkbenchLookupLabour,
} from "@/lib/client/sync-workbench-lookup-labour";
import { WbLabourSiloRowCells, sumLabourHours } from "@/components/wb-labour-silo-row-cells";
import { WbLineSupplierCell } from "@/components/wb-line-supplier-cell";
import { WbBlankLineModal, type WbBlankLineSaveBody, type WbBlankLineSeed } from "@/components/wb-blank-line-modal";
import { WbObjectName } from "@/components/wb-object-name";
import { projectLineObjectLabel, quoteObjectForScopeLine } from "@/lib/client/project-line-quote-object";
import {
  isLabourChecklistLine,
  labourChecklistProductLabel,
} from "@/lib/client/labour-checklist-line";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import { distinctLookupValues } from "@/lib/lookup-list-values";
import {
  filterNotesForTarget,
  uniqueNoteAreaOptionsByAreaId,
  uniqueProjectNotes,
  type ProjectNoteTarget,
  type ProjectNoteViewFilter,
} from "@/lib/project-note-filters";
import { LOOKUP_TYPE_NOTE_TYPES, LOOKUP_TYPE_STYLE } from "@/lib/lookup-types";
import { ESCALATION_NOTE_TYPE } from "@/lib/project-note-types";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import {
  cascadeLevelFromPriceLevel,
} from "@/lib/cascades/cascade-level-from-price-level";
import { scopeSelectionUsesSystemBlinds } from "@/lib/blinds/blinds-scope-answer";
import { isBlindsSystemLine, blindsSkuDisplayLabel } from "@/lib/blinds/blinds-data-utils";
import type { DataBlindPublic } from "@/types/data-blind-public";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { AreaPublic } from "@/types/area";
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from "@/lib/client/format-money";
import { loadCatalogSkuData } from "@/lib/client/load-catalog-sku-data";
import { downloadProjectWorkbenchXls } from "@/lib/project-workbench-export-xls";
import {
  buildWorkbenchTradeReport,
  WB_TRADE_REPORTS,
  wbTradeReportHasContent,
  type WbTradeReportData,
  type WbTradeReportId,
} from "@/lib/workbench-trade-report";
import {
  buildWorkbenchPaintLitresReport,
  wbPaintLitresReportHasContent,
  WB_PAINT_LITRES_REPORT_LABEL,
  type WbPaintLitresReportData,
} from "@/lib/workbench-paint-litres-report";
import {
  buildWorkbenchPurchasingListReport,
  wbPurchasingListReportHasContent,
  WB_PURCHASING_LIST_REPORT_WINDOW_LABEL,
  type WbPurchasingListReportData,
} from "@/lib/workbench-purchasing-list-report";
import {
  paintingSiteFeeExcGst,
  paintingSiteFeeWithMarginExcGst,
  projectHasPaintConsumption,
} from "@/lib/painting-site-fee";
import { WorkbenchTradeReportWindow } from "@/components/workbench-trade-report-window";
import { WorkbenchPaintLitresPrintReport } from "@/components/workbench-paint-litres-print-report";
import { WorkbenchPurchasingListReportWindow } from "@/components/workbench-purchasing-list-report-window";
import { supplierDiscountByKeyFromRows } from "@/lib/client/supplier-discount-price";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";
import { patchBodyForScopeLineSku } from "@/lib/client/scope-line-sku-patch";
import { scopeAnswerNeedsShowAllLineSync } from "@/lib/client/scope-show-all-sync";
import { scopeAnswerNeedsZeroSkuRowSync } from "@/lib/client/scope-suppress-zero-sku-rows";
import {
  isScopeAnswerForceAvailable,
  scopeAnswerForceAvailabilityById,
  scopeAnswerNeedsForceClear,
  scopeSkuFiltersForProjectArea,
} from "@/lib/client/scope-answer-force-availability";
import { useViewMode } from "@/lib/view-mode";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic, ProjectAreaStatus } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { ProjectAreaAnswerPublic } from "@/types/project-area-answer";
import type { ProjectNotePublic } from "@/types/project-note";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import type { SettingPublic } from "@/types/setting";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function effectiveCascadeStyleForArea(
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string {
  return pa.style?.trim() || project?.defaultstyle?.trim() || "";
}

function effectiveCascadeStyleForLine(
  line: ProjectAreaObjectPublic,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string {
  return (
    line.style?.trim() || pa.style?.trim() || project?.defaultstyle?.trim() || ""
  );
}

function wbAreaColourEmptyLabel(project: ProjectPublic | null): string {
  const inherited = project?.defaultcolour?.trim();
  return inherited ? `Default (project · ${inherited})` : "Default (project)";
}

function wbLineColourEmptyLabel(
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string {
  const areaColour = pa.colour?.trim();
  const projectColour = project?.defaultcolour?.trim();
  if (areaColour) return `Default (area · ${areaColour})`;
  if (projectColour) return `Default (project · ${projectColour})`;
  return "Default";
}

function formatLoad(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


/** Object name row once per `objectid` within a scope’s lines (Show All = many SKU rows, one header). */
function scopeLineShowsObjectNameHeader(
  scopeLines: ProjectAreaObjectPublic[],
  lineIdx: number,
): boolean {
  const line = scopeLines[lineIdx];
  if (!line) return false;
  const prev = lineIdx > 0 ? scopeLines[lineIdx - 1] : null;
  const isFirstLineForObject = !prev || prev.objectid !== line.objectid;
  if (!isFirstLineForObject) return false;
  const scopeHasMultipleLines = scopeLines.length > 1;
  return scopeHasMultipleLines || lineIdx > 0;
}

function lineSourceLabel(row: ProjectAreaObjectPublic): string {
  const s = row.linesource;
  if (s === "scope") return "Scope";
  if (s === "manual2") return "Manual2";
  if (s === "manual") return "Manual";
  if (s === "bundled") return "Bundled";
  return "Default";
}

/**
 * Amount counted toward area / project subtotals when line is included.
 * Material + lookup labour (pre-margin). Checklist retail totals use lineFinalPrice
 * (this base × margin). Labour silo headers stay informational on workbench.
 */
function includedLineTotal(
  row: ProjectAreaObjectPublic,
  contractLabourRates?: DataLabourRatePublic[],
): number {
  if (row.included === false) return 0;
  if (contractLabourRates && contractLabourRates.length > 0) {
    return lineExtendedTotalExcGst(row, undefined, undefined, undefined, contractLabourRates) ?? 0;
  }
  const t = row.totalprice;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const thBase =
  "border border-sf-border-strong bg-sf-brand px-1 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-white dark:border-zinc-600 dark:bg-sf-brand dark:text-zinc-100";
/** Workbench object header row inside an area band (background comes from `<tr>`). */
const thBaseWb =
  "border border-sf-border-strong bg-sf-brand/90 py-1.5 pl-2.5 pr-1 text-left text-xs font-semibold uppercase tracking-wide text-white dark:border-zinc-600 dark:text-zinc-100";
/** Workbench area: darker header row, lighter object table (lines + column headers + notes). */
const wbAreaHdrBand = "bg-[#f0f4f8] dark:bg-slate-900/55";
/** Checklist area header: slate bar matching v0. */
const clAreaHdrBand = "bg-[#3D5166] dark:bg-[#2d3d4f]";
const clAreaNameText =
  "text-xl font-bold tracking-tight text-white";
const clAreaHdrLabel =
  "text-[9px] font-semibold uppercase tracking-wider text-white/50";
const clAreaHdrInput =
  "h-8 rounded-md border border-white/20 bg-white/10 px-2.5 text-xs font-medium text-white outline-none transition-all placeholder:text-white/30 focus:bg-white/15 focus:ring-2 focus:ring-sf-accent/60";
const clAreaHdrSelect =
  "h-8 appearance-none rounded-md border border-white/20 bg-white/10 px-2 pr-6 text-xs font-medium text-white outline-none transition-all focus:ring-2 focus:ring-sf-accent/60";
const wbAreaObjectBand = "bg-sf-surface dark:bg-zinc-950/30";
const wbAreaGapCell =
  "h-4 border-0 bg-sf-page p-0 dark:border-0 dark:bg-zinc-800";
const cell =
  "border border-sf-border px-1 py-0.5 align-middle text-sm text-sf-text dark:border-zinc-700 dark:text-zinc-200";
const cellMuted = `${cell} text-sf-text-weak dark:text-zinc-400`;
/** Workbench object rows: text-xs (checklist keeps `cell` text-sm). */
const wbCell =
  "border border-sf-border px-1 py-0.5 align-middle text-xs text-sf-text dark:border-zinc-700 dark:text-zinc-200";
const wbCellMuted = `${wbCell} text-sf-text-weak dark:text-zinc-400`;
/**
 * Workbench table layout — see docs/layout-rules.md and .cursor/rules/layout-rules.mdc.
 * Col widths: colgroup only; reclaimed width → wbSpacerCol (last column).
 * Detail = all columns (19). Summary hides Source + Elevate + Style + Colour (15).
 */
const WB_TABLE_COLS = 19;
const WB_TABLE_COLS_SUMMARY = 15;
const wbSupplierCol = "w-[6rem]";
const wbSpacerCol = "w-[2.81rem]";
/** Line total / project & area subtotal column (widened for paint site fee breakdown). */
const wbSubtotalCol = "w-[4.2rem]";
const wbSpacerCell = `${wbCellMuted} border border-sf-border dark:border-zinc-700`;
/** Area / project header rows: same columns as object table, no internal column borders. */
const wbAreaHdrCell = "border-0 align-top px-1 py-1.5";
const wbAreaHdrCellRight = `${wbAreaHdrCell} text-right`;
/** Workbench area header row: outer border only (no vertical rules between cells). */
const wbAreaHdrOutline = "border-sf-border dark:border-zinc-700";
const wbAreaHdrCellOutlineFirst = `border-0 border-b border-l border-t ${wbAreaHdrOutline} align-top py-1.5 pl-3 pr-1`;
const wbAreaHdrCellOutlineMid = `border-0 border-b border-t ${wbAreaHdrOutline} align-top px-1 py-1.5`;
const wbAreaHdrCellOutlineMidRight = `${wbAreaHdrCellOutlineMid} text-right`;
const wbAreaHdrCellOutlineLast = `border-0 border-b border-r border-t ${wbAreaHdrOutline} align-top px-1 py-1.5`;
const wbProjectHdrRow =
  "border-b border-sf-border bg-sf-surface dark:border-zinc-700 dark:bg-zinc-900/60";
const linkArea =
  "font-semibold text-sf-brand underline decoration-sf-border underline-offset-2 hover:decoration-sf-brand dark:text-emerald-300 dark:decoration-zinc-500 dark:hover:decoration-emerald-300";

function ClAreaJumpNavRow({
  projectAreas,
  areas,
  colSpan,
          cellClassName="border-b border-sf-border bg-sf-page px-5 py-2 dark:border-zinc-700 dark:bg-zinc-900/60",
}: {
  projectAreas: ProjectAreaPublic[];
  areas: AreaPublic[];
  colSpan: number;
  cellClassName?: string;
}) {
  if (projectAreas.length === 0) return null;
  return (
    <tr>
      <td colSpan={colSpan} className={cellClassName}>
        <nav
          aria-label="Jump to area"
          className="flex flex-wrap items-center gap-x-1 gap-y-1 overflow-x-auto text-sm"
        >
          <span className="mr-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-sf-text-weak dark:text-zinc-400">
            Jump to Area
          </span>
          {projectAreas.map((areaPa, i) => {
            const areaLabel = projectAreaHeading(areaPa, areas);
            return (
              <Fragment key={areaPa.id}>
                {i > 0 ? (
                  <span aria-hidden className="select-none text-sf-border dark:text-zinc-600">
                    ·
                  </span>
                ) : null}
                <a
                  href={`#${clAreaAnchorId(areaPa.id)}`}
                  className="whitespace-nowrap rounded px-1 py-0.5 text-sm font-medium text-sf-brand transition-colors hover:text-sf-accent hover:underline dark:text-emerald-300"
                  title={`Jump to ${areaLabel}`}
                >
                  {areaLabel}
                </a>
              </Fragment>
            );
          })}
        </nav>
      </td>
    </tr>
  );
}

const inputNum =
  "w-full min-w-0 rounded border border-sf-border-strong bg-sf-surface px-1.5 py-1 text-sm tabular-nums text-right outline-none focus:border-sf-accent focus:ring-1 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-sf-accent";
const inputText =
  "w-full min-w-0 rounded border border-sf-border-strong bg-sf-surface px-1.5 py-1 text-sm outline-none focus:border-sf-accent focus:ring-1 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-sf-accent";
const inputLong =
  "w-full min-w-0 rounded border border-sf-border-strong bg-sf-surface px-2 py-2 text-sm outline-none focus:border-sf-accent focus:ring-1 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-sf-accent";
const selectBase =
  "rounded-lg border border-sf-border bg-sf-surface px-2 py-1 text-sm outline-none focus:border-sf-accent focus:ring-2 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950";
const selectCell = `${selectBase} w-full min-w-0`;
/** Workbench row controls (no text-sm — avoids conflicting with text-xs). */
const wbFieldBase =
  "rounded border border-sf-border-strong bg-sf-surface px-1 py-0.5 outline-none focus:border-sf-accent focus:ring-1 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-sf-accent";
/** Workbench column-aligned field labels (project/area header rows). */
const wbHdrLabel =
  "mb-0.5 block text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400";
const wbSelectColour = `${selectBase} w-[10ch] max-w-full`;
/** Area colour override (longer placeholder text). */
const wbSelectColourWide = `${selectBase} w-[22ch] max-w-full`;
const wbCellMid = wbCell;
const wbCellDesc = wbCell;
const wbCellUom = wbCell;
const wbCellSku = wbCell;
const wbCellLoad = wbCell;
const wbCellNum = `${wbCell} text-right tabular-nums`;
const wbSelectRow = `${wbFieldBase} block w-full max-w-full text-xs`;
const wbInputLoad = `${wbFieldBase} block w-full min-w-0 tabular-nums text-right text-xs`;
const wbInputMeasure = `${wbFieldBase} block w-full min-w-0 tabular-nums text-right text-xs`;
const wbInputM2 = `${wbFieldBase} w-[6ch] max-w-full tabular-nums text-right text-xs`;
/** Workbench area header row — fixed character widths (do not stretch to column). */
const wbAreaHdrInputCeiling = `${wbFieldBase} w-[5ch] max-w-full tabular-nums text-right text-xs`;
const wbAreaHdrSelectElevate = `${wbFieldBase} w-[18ch] max-w-full text-xs`;
const wbAreaHdrSelectStyle = `${wbFieldBase} w-[18ch] max-w-full text-xs`;
const wbAreaHdrSelectColour = `${wbFieldBase} w-[24ch] max-w-full text-xs`;
const wbAreaHdrSelectStatus = `${wbFieldBase} w-[11ch] max-w-full text-xs`;
/** Single-row area header: label + control stacks, even horizontal gap, bottom-aligned. */
const wbAreaHdrFieldsRow = "flex flex-wrap items-end gap-x-3 gap-y-2";
/** Workbench: Elevate select ~30 characters; colour ~10. */
const wbSelectTier = `${selectBase} w-[30ch] max-w-full`;
/** Shared workbench area footer: notes + questions (same title, label, 2-row fields). */
const wbAreaSectionTitle =
  "text-sm font-semibold text-sf-text dark:text-zinc-100";
const wbAreaSectionStack = "w-full space-y-3";
const wbAreaFieldStack = "w-full space-y-1";
const wbAreaFieldLabel =
  "block text-xs font-medium text-sf-text-secondary dark:text-zinc-300";
const wbAreaFieldTextarea = `${inputLong} block w-full resize-y`;
const wbInputCurrency = `${wbFieldBase} block w-full min-w-0 tabular-nums text-right text-xs`;
const clAnswerInput = `${selectBase} block w-[20ch] min-w-[20ch] max-w-[20ch] text-xs py-0.5`;
const clAnswerSelectBase = `${selectBase} block text-xs py-0.5`;
const clBlindsDropWidthInput = `${selectBase} block w-[10ch] min-w-[10ch] max-w-[10ch] text-xs py-0.5`;
const clSkuInput = `${selectBase} ${clSkuSelectExtraClass}`;
const clUomInput = `${selectBase} box-border block w-full max-w-full min-w-0 text-xs leading-tight py-0 ${CL_FIELD_CONTROL_HEIGHT_CLASS}`;
const clMeasureInput = `${selectBase} box-border block w-full max-w-full min-w-0 tabular-nums text-right text-xs leading-tight py-0 ${CL_FIELD_CONTROL_HEIGHT_CLASS}`;
export type ProjectChecklistPanelMode = "checklist" | "workbench";

function ClScopeQuestionHeader({
  scopeLabel,
  busy = false,
  canCloneScope = false,
  onAddObject,
  onClone,
  children,
}: {
  scopeLabel: string;
  busy?: boolean;
  canCloneScope?: boolean;
  onAddObject: () => void;
  onClone: () => void;
  children: ReactNode;
}) {
  return (
    <div className={clScopeQuestionHeaderBarClass}>
      <div className={clScopeQuestionAnswerRowClass}>{children}</div>
      <ClScopeActionsMenu
        scopeLabel={scopeLabel}
        disabled={busy}
        onAddObject={onAddObject}
        onClone={canCloneScope ? onClone : undefined}
      />
    </div>
  );
}

/** Question title plus optional admin explanation under it. */
function ClScopeQuestionLabel({
  question,
  explanation,
}: {
  question: string;
  explanation?: string | null;
}) {
  const tip = explanation?.trim() || "";
  return (
    <div className="min-w-0 shrink-0">
      <span className={clScopeQuestionTextClass} title={question}>
        {question}
      </span>
      {tip ? (
        <p className="mt-0.5 max-w-prose text-left text-sm font-normal leading-snug text-sf-text-secondary dark:text-zinc-400">
          {tip}
        </p>
      ) : null}
    </div>
  );
}

function redundantScopeDetailParts(entry: RedundantScopeEntry): string[] {
  const parts: string[] = [];
  if (entry.answerLabel) parts.push(`Answer: ${entry.answerLabel}`);
  if (entry.lineCount > 0) {
    parts.push(`${entry.lineCount} line${entry.lineCount === 1 ? "" : "s"}`);
  }
  if (entry.instanceCount > 1) {
    parts.push(`${entry.instanceCount} copies`);
  }
  if (entry.scopeMissing) parts.push("Setup scope deleted");
  return parts;
}

type WbBlankLineContext = {
  paId: string;
  afterLineId: string | null;
  category: string | null;
  linesource: "manual" | "manual2";
  seed?: WbBlankLineSeed | null;
  /** Restore source row inclusion when the modal closes without saving (manual2 only). */
  sourceRowWasIncluded?: boolean;
};

export function ProjectChecklistPanel({
  mode = "checklist",
}: {
  mode?: ProjectChecklistPanelMode;
}) {
  const searchParams = useSearchParams();
  const projectDocId = searchParams.get("id");
  const { isExpanded: isClScopeBodyExpanded, toggle: toggleClScopeBodyExpanded } =
    useClScopeBodyExpanded(projectDocId);
  const { lookups } = useLookups();
  const { colourLookupIndex } = useLookupsColours();
  const skuMatchOptions = useMemo(
    () => ({ colourLookupIndex }),
    [colourLookupIndex],
  );
  const { canAdjustWorkbenchMargin } = useViewMode();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectPublic | null>(null);
  const [numericProjectId, setNumericProjectId] = useState<number | null>(null);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [projectAreas, setProjectAreas] = useState<ProjectAreaPublic[]>([]);
  const [allObjects, setAllObjects] = useState<ProjectAreaObjectPublic[]>([]);
  const [projectAreaAnswers, setProjectAreaAnswers] = useState<ProjectAreaAnswerPublic[]>([]);
  const [projectNotes, setProjectNotes] = useState<ProjectNotePublic[]>([]);
  const [quoteObjects, setQuoteObjects] = useState<QuoteObjectPublic[]>([]);
  const [settings, setSettings] = useState<SettingPublic[]>([]);
  const [contractLabourRates, setContractLabourRates] = useState<DataLabourRatePublic[]>([]);
  const [objectLabourRates, setObjectLabourRates] = useState<DataObjectLabourRatePublic[]>([]);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [areaSavingId, setAreaSavingId] = useState<string | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const [scopes, setScopes] = useState<ScopePublic[]>([]);
  const [cascades, setCascades] = useState<CascadeRow[]>([]);
  const [priceLevels, setPriceLevels] = useState<PriceLevelPublic[]>([]);
  const [catalogSkus, setCatalogSkus] = useState<DataSkuPublic[]>([]);
  const [suppliersBySkuId, setSuppliersBySkuId] = useState<
    Record<string, DataSkuSupplierPublic[]>
  >({});
  const [supplierDiscounts, setSupplierDiscounts] = useState<DataSupplierDiscountPublic[]>([]);
  const supplierDiscountByKey = useMemo(
    () => supplierDiscountByKeyFromRows(supplierDiscounts),
    [supplierDiscounts],
  );
  const [scopeAnswerSaving, setScopeAnswerSaving] = useState<string | null>(null);
  const [redundantPurgeSaving, setRedundantPurgeSaving] = useState(false);
  /** Scope questions auto-cleared because Force objects had no SKUs at current filters. */
  const [forceNaAlertKeys, setForceNaAlertKeys] = useState<Set<string>>(() => new Set());
  const baseStyleOptions = useMemo(() => {
    const out = distinctLookupValues(lookups, LOOKUP_TYPE_STYLE);
    return { out, seen: new Set(out) };
  }, [lookups]);
  const noteTypeOptions = useMemo(
    () => distinctLookupValues(lookups, LOOKUP_TYPE_NOTE_TYPES),
    [lookups],
  );

  const [pickAreaOpen, setPickAreaOpen] = useState(false);
  /** Opens area notes modal after user confirms an escalation note. */
  const [areaNotesOpenPaId, setAreaNotesOpenPaId] = useState<string | null>(null);
  /** Pre-fill add-note form with Escalation type when opening from escalate flow. */
  const [areaNotesEscalationDraftPaId, setAreaNotesEscalationDraftPaId] = useState<string | null>(
    null,
  );
  const [escalationNotePrompt, setEscalationNotePrompt] = useState<{
    paId: string;
    areaLabel: string;
  } | null>(null);
  const [addAreaPriceLevelId, setAddAreaPriceLevelId] = useState<number | null>(null);
  const [addAreaDisplayName, setAddAreaDisplayName] = useState("");
  const [addAreaSaving, setAddAreaSaving] = useState(false);
  const [paDeleteId, setPaDeleteId] = useState<string | null>(null);
  const [paDeleting, setPaDeleting] = useState(false);
  const [paoDeleteId, setPaoDeleteId] = useState<string | null>(null);
  const [paoDeleting, setPaoDeleting] = useState(false);
  const [pickObjectOpen, setPickObjectOpen] = useState(false);
  const [pickObjectContext, setPickObjectContext] = useState<{
    projectAreaDocId: string;
    scopeDocId?: string;
    scopeInstanceId?: string | null;
    answerid?: string | null;
    scopeLabel?: string;
  } | null>(null);
  const [pickObjectSaving, setPickObjectSaving] = useState(false);
  const [wbBlankLineContext, setWbBlankLineContext] = useState<WbBlankLineContext | null>(null);
  const wbBlankLineContextRef = useRef<WbBlankLineContext | null>(null);
  const [wbBlankLineSaving, setWbBlankLineSaving] = useState(false);
  const [pickScopeOpen, setPickScopeOpen] = useState(false);
  const [pickScopeAreaId, setPickScopeAreaId] = useState<string | null>(null);
  const [pickScopeSaving, setPickScopeSaving] = useState(false);
  const [answerSavingId, setAnswerSavingId] = useState<string | null>(null);
  /** Workbench (admin): per line, include non–priority-1 supplier SKUs in SKU picker. */
  const [skuShowAllByLineId, setSkuShowAllByLineId] = useState<Record<string, boolean>>(
    {},
  );
  /** Checklist: Non Std tier/style/colour popup target (area or line). */
  const [clNonStdModal, setClNonStdModal] = useState<ClNonStdModalTarget | null>(null);
  const [blindsData, setBlindsData] = useState<DataBlindPublic[]>([]);
  const [buildingElements, setBuildingElements] = useState<DataBuildingElementPublic[]>([]);
  const [paintingElements, setPaintingElements] = useState<DataPaintingElementPublic[]>([]);
  const [wbBlindsEditLineId, setWbBlindsEditLineId] = useState<string | null>(null);
  const [wbBuildingElementLineId, setWbBuildingElementLineId] = useState<string | null>(null);
  const [wbPaintingElementLineId, setWbPaintingElementLineId] = useState<string | null>(null);
  const [wbExporting, setWbExporting] = useState(false);
  const [wbTradeReportData, setWbTradeReportData] = useState<WbTradeReportData | null>(null);
  const [wbPaintLitresReportData, setWbPaintLitresReportData] =
    useState<WbPaintLitresReportData | null>(null);
  const [wbPurchasingListReportWindowData, setWbPurchasingListReportWindowData] =
    useState<WbPurchasingListReportData | null>(null);
  const [wbColumnView, setWbColumnView] = useState<"detail" | "summary">("detail");
  const { compressed: wbCompressed, toggle: toggleWbCompressed } =
    useWbCompressZeroMeasure(projectDocId);
  const [wbCloningLineId, setWbCloningLineId] = useState<string | null>(null);
  const includeAllSuppliersForLine = useCallback(
    (lineId: string) => skuShowAllByLineId[lineId] === true,
    [skuShowAllByLineId],
  );
  const setIncludeAllSuppliersForLine = useCallback((lineId: string, checked: boolean) => {
    setSkuShowAllByLineId((prev) => {
      if (!checked) {
        const { [lineId]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [lineId]: true };
    });
  }, []);

  const loadAreas = useCallback(async () => {
    const res = await fetch("/api/areas");
    const data = (await res.json()) as { areas?: AreaPublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load areas");
    setAreas(data.areas ?? []);
  }, []);

  const loadQuoteObjects = useCallback(async () => {
    const res = await fetch("/api/quote-objects");
    const data = (await res.json()) as { quoteObjects?: QuoteObjectPublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load quote objects");
    setQuoteObjects(data.quoteObjects ?? []);
  }, []);

  const loadScopes = useCallback(async () => {
    const res = await fetch("/api/scopes");
    const data = (await res.json()) as { scopes?: ScopePublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load scopes");
    setScopes(data.scopes ?? []);
  }, []);

  const loadCascades = useCallback(async () => {
    const res = await fetch("/api/cascades");
    const data = (await res.json()) as {
      items?: { level: string; style: string; colour: string }[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to load cascades");
    setCascades(
      (data.items ?? []).map((r) => ({
        level: r.level,
        style: r.style,
        colour: r.colour,
      })),
    );
  }, []);

  const loadPriceLevels = useCallback(async () => {
    const res = await fetch("/api/price-levels");
    const data = (await res.json()) as { priceLevels?: PriceLevelPublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load price levels");
    setPriceLevels(data.priceLevels ?? []);
  }, []);

  const loadCatalogSkus = useCallback(async () => {
    const { skus, suppliersBySkuId: suppliers } = await loadCatalogSkuData();
    setCatalogSkus(skus);
    setSuppliersBySkuId(suppliers);
  }, []);

  const loadBlindsData = useCallback(async () => {
    try {
      const res = await fetch("/api/data-blinds");
      const data = (await res.json()) as { items?: DataBlindPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load blinds prices");
      setBlindsData(data.items ?? []);
    } catch {
      setBlindsData([]);
    }
  }, []);

  const loadBuildingElements = useCallback(async () => {
    try {
      const res = await fetch("/api/building-elements");
      const data = (await res.json()) as { items?: DataBuildingElementPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load building elements");
      setBuildingElements(data.items ?? []);
    } catch {
      setBuildingElements([]);
    }
  }, []);

  const loadPaintingElements = useCallback(async () => {
    try {
      const res = await fetch("/api/painting-elements");
      const data = (await res.json()) as { items?: DataPaintingElementPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load painting elements");
      setPaintingElements(data.items ?? []);
    } catch {
      setPaintingElements([]);
    }
  }, []);

  const reloadLineItems = useCallback(async () => {
    if (!projectDocId) return;
    const objRes = await fetch(
      `/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId)}`,
    );
    const objData = (await objRes.json()) as {
      projectAreaObjects?: ProjectAreaObjectPublic[];
      error?: string;
    };
    if (!objRes.ok) throw new Error(objData.error ?? "Failed to reload line items");
    let lines = objData.projectAreaObjects ?? [];
    if (mode === "workbench" && lines.length > 0) {
      try {
        lines = await persistWorkbenchLookupLabour(
          lines,
          quoteObjects,
          objectLabourRates,
          catalogSkus,
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to sync labour hours from rates table",
        );
      }
    }
    setAllObjects(lines);
  }, [projectDocId, mode, quoteObjects, objectLabourRates, catalogSkus]);

  const reloadProjectAreas = useCallback(async () => {
    if (!projectDocId) return;
    const paRes = await fetch(
      `/api/projectareas?projectDocId=${encodeURIComponent(projectDocId)}`,
    );
    const paData = (await paRes.json()) as { projectAreas?: ProjectAreaPublic[]; error?: string };
    if (!paRes.ok) throw new Error(paData.error ?? "Failed to reload project areas");
    setProjectAreas(paData.projectAreas ?? []);
  }, [projectDocId]);

  const reloadProjectAreaAnswers = useCallback(async () => {
    if (!projectDocId) return;
    const res = await fetch(
      `/api/projectareaanswers?projectDocId=${encodeURIComponent(projectDocId)}`,
    );
    const data = (await res.json()) as {
      projectAreaAnswers?: ProjectAreaAnswerPublic[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to reload area questions");
    setProjectAreaAnswers(data.projectAreaAnswers ?? []);
  }, [projectDocId]);

  const reloadProjectNotes = useCallback(async () => {
    if (!projectDocId) return;
    await fetch("/api/project-notes/init", { method: "POST" });
    const res = await fetch(
      `/api/project-notes?projectDocId=${encodeURIComponent(projectDocId)}`,
    );
    const data = (await res.json()) as {
      projectNotes?: ProjectNotePublic[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to reload project notes");
    setProjectNotes(uniqueProjectNotes(data.projectNotes ?? []));
  }, [projectDocId]);

  const createProjectNote = useCallback(
    async (
      target: ProjectNoteTarget,
      body: { notetype: string; trades: string[]; author: string; note: string },
    ) => {
      if (numericProjectId == null) throw new Error("Project not loaded");
      const res = await fetch("/api/project-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectid: numericProjectId,
          areaid: target.areaid ?? null,
          objectid: target.objectid ?? null,
          ...body,
        }),
      });
      const data = await readApiResponse<{
        projectNote?: ProjectNotePublic;
        error?: string;
      }>(res);
      if (!res.ok || !data.projectNote) {
        throw new Error(data.error ?? "Failed to save note");
      }
      setProjectNotes((prev) => uniqueProjectNotes([data.projectNote!, ...prev]));
    },
    [numericProjectId],
  );

  const updateProjectNote = useCallback(
    async (
      noteId: string,
      body: { notetype: string; trades: string[]; note: string },
    ) => {
      const res = await fetch(`/api/project-notes/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiResponse<{
        projectNote?: ProjectNotePublic;
        error?: string;
      }>(res);
      if (!res.ok || !data.projectNote) {
        throw new Error(data.error ?? "Failed to update note");
      }
      setProjectNotes((prev) =>
        prev.map((n) => (n.id === noteId ? data.projectNote! : n)),
      );
    },
    [],
  );

  const deleteProjectNote = useCallback(async (noteId: string) => {
    const res = await fetch(`/api/project-notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    });
    const data = await readApiResponse<{ error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to delete note");
    setProjectNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const patchProjectAreaAnswer = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setAnswerSavingId(id);
      setError(null);
      try {
        const res = await fetch(`/api/projectareaanswers/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await readApiResponse<{
          projectAreaAnswer?: ProjectAreaAnswerPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.projectAreaAnswer) {
          setProjectAreaAnswers((prev) =>
            prev.map((a) => (a.id === id ? data.projectAreaAnswer! : a)),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        await reloadProjectAreaAnswers();
      } finally {
        setAnswerSavingId(null);
      }
    },
    [reloadProjectAreaAnswers],
  );

  const patchProject = useCallback(
    async (body: Record<string, unknown>) => {
      if (!projectDocId) return;
      setProjectSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectDocId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await readApiResponse<{ project?: ProjectPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.project) setProject(data.project);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Project save failed");
        try {
          const res = await fetch(`/api/projects/${projectDocId}`);
          const data = await readApiResponse<{ project?: ProjectPublic }>(res);
          if (res.ok && data.project) setProject(data.project);
        } catch {
          /* ignore */
        }
      } finally {
        setProjectSaving(false);
      }
    },
    [projectDocId],
  );

  const patchProjectArea = useCallback(
    async (paId: string, body: Record<string, unknown>) => {
      setAreaSavingId(paId);
      setError(null);
      try {
        const res = await fetch(`/api/projectareas/${paId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await readApiResponse<{ projectArea?: ProjectAreaPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.projectArea) {
          setProjectAreas((prev) => prev.map((p) => (p.id === paId ? data.projectArea! : p)));
        }
        if ("pricelevelid" in body) {
          await reloadLineItems();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Area save failed");
        await reloadProjectAreas();
      } finally {
        setAreaSavingId(null);
      }
    },
    [reloadProjectAreas, reloadLineItems],
  );

  const handleAreaStatusChange = useCallback(
    (pa: ProjectAreaPublic, next: ProjectAreaStatus | null, areaLabel: string) => {
      const prev = pa.areaStatus ?? null;
      if (next === prev) return;
      void patchProjectArea(pa.id, { areaStatus: next ?? "" });
      if (next === "escalated") {
        setEscalationNotePrompt({ paId: pa.id, areaLabel });
      }
    },
    [patchProjectArea],
  );

  const applyScopeAnswer = useCallback(
    async (
      pa: ProjectAreaPublic,
      scopeDocId: string,
      answerid: string | null,
      scopeInstanceId?: string | null,
    ) => {
      setScopeAnswerSaving(scopeAnswerSavingKey(scopeDocId, scopeInstanceId));
      setError(null);
      try {
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(pa.id)}/scope-answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scopeDocId,
              answerid,
              scopeInstanceId: scopeInstanceId?.trim() ? scopeInstanceId.trim() : null,
            }),
          },
        );
        const data = await readApiResponse<{
          projectArea?: ProjectAreaPublic;
          linesAdded?: number;
          linesRemoved?: number;
          diagnostics?: {
            effectivePriceLevelId: number | null;
            noLinesReason?: string;
            attachedCategories?: string[];
            answerTierIds?: number[];
          };
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to update scope answer");
        if (typeof data.linesAdded === "number") {
          console.debug("[scope-answer]", {
            linesAdded: data.linesAdded,
            linesRemoved: data.linesRemoved,
            diagnostics: data.diagnostics,
          });
          if (
            data.linesAdded === 0 &&
            answerid != null &&
            data.diagnostics?.noLinesReason &&
            data.diagnostics.noLinesReason !== "answer_cleared" &&
            data.diagnostics.noLinesReason !== "zero_sku_rows_suppressed"
          ) {
            console.warn(
              "[scope-answer] No lines were added. Check diagnostics (often: no categories on the answer, no matching quote objects, or re-save scopes under Setup → Scopes).",
              data.diagnostics,
            );
          }
        }
        if (data.projectArea) {
          setProjectAreas((prev) =>
            prev.map((p) => (p.id === data.projectArea!.id ? data.projectArea! : p)),
          );
        }
        await reloadLineItems();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scope answer update failed");
        await reloadProjectAreas();
      } finally {
        setScopeAnswerSaving(null);
      }
    },
    [reloadLineItems, reloadProjectAreas],
  );

  const showAllSyncInFlightRef = useRef(new Set<string>());
  const showAllSyncDoneRef = useRef(new Set<string>());
  const forceClearInFlightRef = useRef(new Set<string>());
  const defaultTrueApplyInFlightRef = useRef(new Set<string>());
  const zeroSkuSyncDoneRef = useRef(new Set<string>());

  const clearForceNaAlert = useCallback((paId: string, scopeDocId: string) => {
    const key = `${paId}:${scopeDocId}`;
    setForceNaAlertKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  /** Re-apply scope answers when Show All was configured in Setup but lines are still a single SKU dropdown row. */
  useEffect(() => {
    if (!projectDocId || scopes.length === 0 || quoteObjects.length === 0) return;

    for (const pa of projectAreas) {
      for (const entry of pa.scopeAnswers ?? []) {
        if (!entry.answerid) continue;
        const scope = scopes.find((s) => s.id === entry.scopeDocId);
        if (!scope) continue;
        const scopeLines = allObjects.filter(
          (o) =>
            o.projectAreaDocId === pa.id &&
            o.linesource === "scope" &&
            o.scopeDocId === entry.scopeDocId &&
            matchesScopeInstance(o.scopeInstanceId, entry.scopeInstanceId),
        );
        if (
          !scopeAnswerNeedsShowAllLineSync(scope, entry.answerid, scopeLines, quoteObjects)
        ) {
          continue;
        }
        const key = `${pa.id}:${scopeAnswerSavingKey(entry.scopeDocId, entry.scopeInstanceId)}`;
        if (showAllSyncDoneRef.current.has(key)) continue;
        if (showAllSyncInFlightRef.current.has(key)) continue;
        if (
          scopeAnswerSaving ===
          scopeAnswerSavingKey(entry.scopeDocId, entry.scopeInstanceId)
        ) {
          continue;
        }
        showAllSyncDoneRef.current.add(key);
        showAllSyncInFlightRef.current.add(key);
        void applyScopeAnswer(
          pa,
          entry.scopeDocId,
          entry.answerid,
          entry.scopeInstanceId,
        ).finally(() => {
          showAllSyncInFlightRef.current.delete(key);
        });
      }
    }
  }, [
    projectDocId,
    projectAreas,
    scopes,
    quoteObjects,
    allObjects,
    applyScopeAnswer,
    scopeAnswerSaving,
  ]);

  /** Clear scope answers when Force objects no longer have matching SKUs at tier/style/colour. */
  useEffect(() => {
    if (
      !projectDocId ||
      scopes.length === 0 ||
      quoteObjects.length === 0 ||
      catalogSkus.length === 0
    ) {
      return;
    }

    for (const pa of projectAreas) {
      const filters = scopeSkuFiltersForProjectArea(pa, project, priceLevels, cascades);
      for (const entry of pa.scopeAnswers ?? []) {
        if (!entry.answerid) continue;
        const scope = scopes.find((s) => s.id === entry.scopeDocId);
        if (!scope) continue;
        if (
          !scopeAnswerNeedsForceClear(
            scope,
            entry.answerid,
            quoteObjects,
            catalogSkus,
            filters,
            skuMatchOptions,
          )
        ) {
          continue;
        }
        const key = `${pa.id}:${entry.scopeDocId}`;
        if (forceClearInFlightRef.current.has(key)) continue;
        if (
          scopeAnswerSaving ===
          scopeAnswerSavingKey(entry.scopeDocId, entry.scopeInstanceId)
        ) {
          continue;
        }
        forceClearInFlightRef.current.add(key);
        setForceNaAlertKeys((prev) => {
          if (prev.has(key)) return prev;
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        void applyScopeAnswer(
          pa,
          entry.scopeDocId,
          null,
          entry.scopeInstanceId,
        ).finally(() => {
          forceClearInFlightRef.current.delete(key);
        });
      }
    }
  }, [
    projectDocId,
    projectAreas,
    scopes,
    quoteObjects,
    catalogSkus,
    project,
    priceLevels,
    cascades,
    applyScopeAnswer,
    scopeAnswerSaving,
    skuMatchOptions,
  ]);

  /** Auto-select the answer marked Default to true when the scope is still unanswered. */
  useEffect(() => {
    if (!projectDocId || scopes.length === 0 || areas.length === 0) return;

    for (const pa of projectAreas) {
      const filters = scopeSkuFiltersForProjectArea(pa, project, priceLevels, cascades);
      const areaScopes = scopesForProjectArea(pa, areas, scopes);
      const rows = allObjects.filter((o) => o.projectAreaDocId === pa.id);
      for (const scope of areaScopes) {
        if (scope.kind === "header" || scope.kind === "footer") continue;
        const answerid = defaultTrueAnswerId(scope);
        if (!answerid) continue;
        const answer = scope.answers.find((a) => a.answerid === answerid);
        if (!answer) continue;
        const hasForce = Object.values(answer.attachedObjectForce ?? {}).some(Boolean);
        if (hasForce && (catalogSkus.length === 0 || quoteObjects.length === 0)) continue;
        if (
          hasForce &&
          !isScopeAnswerForceAvailable(
            answer,
            quoteObjects,
            catalogSkus,
            filters,
            skuMatchOptions,
          )
        ) {
          continue;
        }

        for (const scopeInstanceId of collectScopeInstanceIds(scope.id, pa.scopeAnswers, rows)) {
          const saved = pa.scopeAnswers?.find(
            (e) =>
              e.scopeDocId === scope.id &&
              matchesScopeInstance(e.scopeInstanceId, scopeInstanceId),
          );
          if (saved?.answerid) continue;
          const key = scopeAnswerSavingKey(`${pa.id}:${scope.id}`, scopeInstanceId);
          if (defaultTrueApplyInFlightRef.current.has(key)) continue;
          if (
            scopeAnswerSaving ===
            scopeAnswerSavingKey(scope.id, scopeInstanceId)
          ) {
            continue;
          }
          defaultTrueApplyInFlightRef.current.add(key);
          void applyScopeAnswer(pa, scope.id, answerid, scopeInstanceId).finally(() => {
            defaultTrueApplyInFlightRef.current.delete(key);
          });
        }
      }
    }
  }, [
    projectDocId,
    projectAreas,
    scopes,
    areas,
    allObjects,
    quoteObjects,
    catalogSkus,
    project,
    priceLevels,
    cascades,
    applyScopeAnswer,
    scopeAnswerSaving,
    skuMatchOptions,
  ]);

  /** Re-apply answers so Suppress 0 SKU Rows tracks tier/style/colour SKU availability. */
  useEffect(() => {
    if (
      !projectDocId ||
      scopes.length === 0 ||
      quoteObjects.length === 0 ||
      catalogSkus.length === 0
    ) {
      return;
    }

    for (const pa of projectAreas) {
      const filters = scopeSkuFiltersForProjectArea(pa, project, priceLevels, cascades);
      for (const entry of pa.scopeAnswers ?? []) {
        if (!entry.answerid) continue;
        const scope = scopes.find((s) => s.id === entry.scopeDocId);
        if (!scope) continue;
        const scopeLines = allObjects.filter(
          (o) =>
            o.projectAreaDocId === pa.id &&
            o.linesource === "scope" &&
            o.scopeDocId === entry.scopeDocId &&
            matchesScopeInstance(o.scopeInstanceId, entry.scopeInstanceId),
        );
        if (
          !scopeAnswerNeedsZeroSkuRowSync(
            scope,
            entry.answerid,
            scopeLines,
            quoteObjects,
            catalogSkus,
            filters,
            skuMatchOptions,
          )
        ) {
          continue;
        }
        const syncKey = [
          pa.id,
          entry.scopeDocId,
          entry.scopeInstanceId ?? "",
          entry.answerid,
          filters.elevateLevel,
          filters.style,
          filters.colour,
        ].join(":");
        if (zeroSkuSyncDoneRef.current.has(syncKey)) continue;
        if (
          scopeAnswerSaving ===
          scopeAnswerSavingKey(entry.scopeDocId, entry.scopeInstanceId)
        ) {
          continue;
        }
        zeroSkuSyncDoneRef.current.add(syncKey);
        void applyScopeAnswer(
          pa,
          entry.scopeDocId,
          entry.answerid,
          entry.scopeInstanceId,
        );
      }
    }
  }, [
    projectDocId,
    projectAreas,
    scopes,
    quoteObjects,
    catalogSkus,
    allObjects,
    project,
    priceLevels,
    cascades,
    applyScopeAnswer,
    scopeAnswerSaving,
    skuMatchOptions,
  ]);

  const addExtraScopeToArea = useCallback(
    async (pa: ProjectAreaPublic, scopeDocId: string): Promise<boolean> => {
      const prev = pa.extraScopeDocIds ?? [];
      if (prev.includes(scopeDocId)) return true;
      setError(null);
      try {
        const res = await fetch(`/api/projectareas/${encodeURIComponent(pa.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraScopeDocIds: [...prev, scopeDocId] }),
        });
        const data = await readApiResponse<{ projectArea?: ProjectAreaPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to add scope");
        if (data.projectArea) {
          setProjectAreas((p) => p.map((x) => (x.id === pa.id ? data.projectArea! : x)));
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add scope");
        await reloadProjectAreas();
        return false;
      }
    },
    [reloadProjectAreas],
  );

  const removeExtraScopeFromArea = useCallback(
    async (pa: ProjectAreaPublic, scopeDocId: string) => {
      const prev = pa.extraScopeDocIds ?? [];
      if (!prev.includes(scopeDocId)) return;
      const next = prev.filter((id) => id !== scopeDocId);
      setError(null);
      try {
        const res = await fetch(`/api/projectareas/${encodeURIComponent(pa.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraScopeDocIds: next }),
        });
        const data = await readApiResponse<{ projectArea?: ProjectAreaPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to remove scope");
        if (data.projectArea) {
          setProjectAreas((p) => p.map((x) => (x.id === pa.id ? data.projectArea! : x)));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove scope");
        await reloadProjectAreas();
      }
    },
    [reloadProjectAreas],
  );

  const purgeRedundantScopeFromArea = useCallback(
    async (pa: ProjectAreaPublic, scopeDocId: string) => {
      setScopeAnswerSaving(scopeDocId);
      setError(null);
      try {
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(pa.id)}/purge-scope`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scopeDocId }),
          },
        );
        const data = await readApiResponse<{
          projectArea?: ProjectAreaPublic;
          linesRemoved?: number;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to remove scope question");
        if (data.projectArea) {
          setProjectAreas((prev) =>
            prev.map((p) => (p.id === data.projectArea!.id ? data.projectArea! : p)),
          );
        }
        await reloadLineItems();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove scope question");
        await reloadProjectAreas();
      } finally {
        setScopeAnswerSaving(null);
      }
    },
    [reloadLineItems, reloadProjectAreas],
  );

  const patchLineItem = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const shouldRecalcLookupLabour =
        body.custommeasure !== undefined || body.customuom !== undefined;

      setRowSavingId(id);
      setError(null);

      if (body.included !== undefined) {
        setAllObjects((prev) =>
          prev.map((o) =>
            o.id === id ? { ...o, included: body.included as boolean } : o,
          ),
        );
      }

      if (shouldRecalcLookupLabour && mode === "workbench") {
        setAllObjects((prev) =>
          prev.map((o) => {
            if (o.id !== id) return o;
            const q = quoteObjects.find((qo) => qo.objectid === o.objectid);
            const objectName =
              q?.objectname?.trim() || o.objectname?.trim() || "";
            const measure =
              body.custommeasure !== undefined
                ? (body.custommeasure as number | null)
                : (o.custommeasure ?? null);
            const uom =
              body.customuom !== undefined
                ? String(body.customuom)
                : o.customuom;
            return applyLookupLabourToProjectLine(
              o,
              measure,
              objectName,
              objectLabourRates,
              uom,
            );
          }),
        );
      }

      try {
        const res = await fetch(`/api/projectareaobjects/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await readApiResponse<{
          projectAreaObject?: ProjectAreaObjectPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.projectAreaObject) {
          setAllObjects((prev) =>
            prev.map((o) => (o.id === id ? data.projectAreaObject! : o)),
          );
        } else if (shouldRecalcLookupLabour) {
          await reloadLineItems();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        await reloadLineItems();
      } finally {
        setRowSavingId(null);
      }
    },
    [reloadLineItems, mode, quoteObjects, objectLabourRates],
  );

  const applyLineSkuSelection = useCallback(
    async (
      parentLine: ProjectAreaObjectPublic,
      pa: ProjectAreaPublic,
      pick: ScopeLineSkuPick,
    ) => {
      const resolvedPick = scopeLineSkuPickWithResolvedPrice(
        parentLine,
        pick,
        suppliersBySkuId,
        supplierDiscountByKey,
      );
      if (scopeLineMatchesSkuPick(parentLine, resolvedPick)) return;

      setRowSavingId(parentLine.id);
      setError(null);
      try {
        const scopeForLine = parentLine.scopeDocId?.trim()
          ? scopes.find((s) => s.id === parentLine.scopeDocId?.trim())
          : undefined;
        const qObj = quoteObjectForScopeLine(parentLine, scopeForLine, quoteObjects);
        const scopeInheritMeasureSource = resolveScopeLineInheritMeasureSource(
          parentLine,
          scopeForLine,
          quoteObjects,
        );
        const scopeInheritMeasureLocked = resolveScopeLineInheritMeasureLocked(
          parentLine,
          scopeForLine,
          quoteObjects,
        );
        const metricMap = scopeMetricValuesMapForInstance(
          pa.scopeMetricValues,
          parentLine.scopeDocId?.trim() ?? "",
          parentLine.scopeInstanceId,
        );
        const pickedSku = catalogSkus.find((s) => s.skuId === resolvedPick.skuId);
        const measureForPricing = checklistInheritedMeasureForRow(
          parentLine,
          qObj,
          pa,
          project,
          scopeInheritMeasureSource,
          {
            scopeMetrics: scopeForLine?.scopeMetrics,
            scopeMetricValues: metricMap,
            catalogSkus,
            inheritMeasureLocked: scopeInheritMeasureLocked,
            skuCalcM2Override: pickedSku
              ? { calcM2: pickedSku.calcM2, calculatedM2: pickedSku.calculatedM2 }
              : null,
          },
        );

        await applyScopeLineSkuWithBundledChildren({
          parentLine,
          pick: resolvedPick,
          projectAreaDocId: pa.id,
          catalogSkus,
          suppliersBySkuId,
          quoteObjects,
          priceLevels,
          cascades,
          supplierDiscountByKey,
          pa,
          project,
          allObjects,
          onObjectsChange: setAllObjects,
          reloadLineItems,
          setError,
          measureForPricing,
          colourLookupIndex,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        await reloadLineItems();
      } finally {
        setRowSavingId(null);
      }
    },
    [
      allObjects,
      catalogSkus,
      mode,
      patchLineItem,
      suppliersBySkuId,
      quoteObjects,
      priceLevels,
      cascades,
      supplierDiscountByKey,
      project,
      reloadLineItems,
      scopes,
      colourLookupIndex,
    ],
  );

  useEffect(() => {
    async function boot() {
      if (!projectDocId) {
        setLoading(false);
        setProject(null);
        setNumericProjectId(null);
        setProjectAreas([]);
        setAllObjects([]);
        setScopes([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadAreas(),
          loadQuoteObjects(),
          loadScopes(),
          loadCascades(),
          loadPriceLevels(),
          loadCatalogSkus(),
          loadBlindsData(),
          loadBuildingElements(),
          loadPaintingElements(),
          (async () => {
            const res = await fetch(`/api/projects/${projectDocId}`);
            const data = await readApiResponse<{ project?: ProjectPublic; error?: string }>(res);
            if (!res.ok || !data.project) throw new Error(data.error ?? "Failed to load project");
            setProject(data.project);
            setNumericProjectId(
              typeof data.project.projectid === "number" && Number.isInteger(data.project.projectid)
                ? data.project.projectid
                : null,
            );
          })(),
        ]);

        const [paRes, objRes, settingsRes, labourRatesRes, objectLabourRes, supplierDiscRes] =
          await Promise.all([
          fetch(`/api/projectareas?projectDocId=${encodeURIComponent(projectDocId)}`),
          fetch(`/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId)}`),
          fetch("/api/settings"),
          fetch("/api/labour-rates"),
          fetch("/api/object-labour-rates"),
          fetch("/api/supplier-discounts"),
        ]);
        const paData = (await paRes.json()) as { projectAreas?: ProjectAreaPublic[]; error?: string };
        if (!paRes.ok) throw new Error(paData.error ?? "Failed to load project areas");
        setProjectAreas(paData.projectAreas ?? []);

        const objData = (await objRes.json()) as {
          projectAreaObjects?: ProjectAreaObjectPublic[];
          error?: string;
        };
        if (!objRes.ok) throw new Error(objData.error ?? "Failed to load line items");
        setAllObjects(objData.projectAreaObjects ?? []);

        const settingsData = (await settingsRes.json()) as {
          settings?: SettingPublic[];
          error?: string;
        };
        if (settingsRes.ok) setSettings(settingsData.settings ?? []);
        else setSettings([]);

        const labourRatesData = (await labourRatesRes.json()) as {
          items?: DataLabourRatePublic[];
        };
        if (labourRatesRes.ok) setContractLabourRates(labourRatesData.items ?? []);
        else setContractLabourRates([]);

        const objectLabourData = (await objectLabourRes.json()) as {
          items?: DataObjectLabourRatePublic[];
        };
        if (objectLabourRes.ok) setObjectLabourRates(objectLabourData.items ?? []);
        else setObjectLabourRates([]);

        const supplierDiscData = (await supplierDiscRes.json()) as {
          items?: DataSupplierDiscountPublic[];
        };
        if (supplierDiscRes.ok) setSupplierDiscounts(supplierDiscData.items ?? []);
        else setSupplierDiscounts([]);

        await Promise.all([reloadProjectAreaAnswers(), reloadProjectNotes()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [
    projectDocId,
    loadAreas,
    loadQuoteObjects,
    loadScopes,
    loadCascades,
    loadPriceLevels,
    loadCatalogSkus,
    loadBlindsData,
    loadBuildingElements,
    loadPaintingElements,
    reloadProjectAreaAnswers,
    reloadProjectNotes,
    mode,
  ]);

  const workbenchLookupLabourSyncingRef = useRef(false);

  /** Workbench: apply object labour rates table to lookup silos on load and when rates/lines change. */
  useEffect(() => {
    if (mode !== "workbench" || loading || !projectDocId) return;
    if (objectLabourRates.length === 0) return;

    const updates = lookupLabourUpdatesForLines(
      allObjects,
      quoteObjects,
      objectLabourRates,
      catalogSkus,
    );
    if (updates.length === 0) return;
    if (workbenchLookupLabourSyncingRef.current) return;

    workbenchLookupLabourSyncingRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const merged = await persistWorkbenchLookupLabour(
          allObjects,
          quoteObjects,
          objectLabourRates,
          catalogSkus,
        );
        if (!cancelled) setAllObjects(merged);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to sync labour hours from rates table",
          );
        }
      } finally {
        if (!cancelled) workbenchLookupLabourSyncingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      workbenchLookupLabourSyncingRef.current = false;
    };
  }, [mode, loading, projectDocId, allObjects, quoteObjects, objectLabourRates, catalogSkus]);

  const objectsByProjectAreaDocId = useMemo(() => {
    const m = new Map<string, ProjectAreaObjectPublic[]>();
    for (const row of allObjects) {
      let key = row.projectAreaDocId?.trim() ?? "";
      if (!key) {
        const sole = projectAreas.filter((pa) => pa.areaid === row.areaid);
        key = sole.length === 1 ? sole[0].id : `__orphan__${row.id}`;
      }
      const list = m.get(key) ?? [];
      list.push(row);
      m.set(key, list);
    }
    for (const [, list] of m) {
      list.sort(compareProjectAreaLineOrder);
    }
    return m;
  }, [allObjects, projectAreas]);

  const projectRedundantScopeEntries = useMemo(() => {
    if (mode !== "checklist") return [];
    return redundantScopeEntriesForProject(
      projectAreas,
      areas,
      scopes,
      objectsByProjectAreaDocId,
      (pa) => projectAreaHeading(pa, areas),
    );
  }, [mode, projectAreas, areas, scopes, objectsByProjectAreaDocId]);

  const purgeAllRedundantScopesFromProject = useCallback(async () => {
    if (projectRedundantScopeEntries.length === 0) return;
    setRedundantPurgeSaving(true);
    setError(null);
    try {
      for (const entry of projectRedundantScopeEntries) {
        const pa = projectAreas.find((p) => p.id === entry.projectAreaDocId);
        if (!pa) continue;
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(pa.id)}/purge-scope`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scopeDocId: entry.scopeDocId }),
          },
        );
        const data = await readApiResponse<{
          projectArea?: ProjectAreaPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to remove scope question");
        if (data.projectArea) {
          setProjectAreas((prev) =>
            prev.map((p) => (p.id === data.projectArea!.id ? data.projectArea! : p)),
          );
        }
      }
      await reloadLineItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove redundant scope questions");
      await reloadProjectAreas();
    } finally {
      setRedundantPurgeSaving(false);
    }
  }, [projectRedundantScopeEntries, projectAreas, reloadLineItems, reloadProjectAreas]);

  const answersByProjectAreaDocId = useMemo(() => {
    const m = new Map<string, ProjectAreaAnswerPublic[]>();
    for (const row of projectAreaAnswers) {
      const key = row.projectAreaDocId?.trim() ?? "";
      if (!key) continue;
      const list = m.get(key) ?? [];
      list.push(row);
      m.set(key, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => {
        const aso = a.sortOrder ?? Number.POSITIVE_INFINITY;
        const bso = b.sortOrder ?? Number.POSITIVE_INFINITY;
        if (aso !== bso) return aso - bso;
        return (a.questionTextSnapshot || "").localeCompare(b.questionTextSnapshot || "", undefined, {
          sensitivity: "base",
        });
      });
    }
    return m;
  }, [projectAreaAnswers]);

  const sortedProjectAreas = useMemo(
    () => [...projectAreas].sort(compareProjectAreasDisplayOrder),
    [projectAreas],
  );

  const areasSortedForPicker = useMemo(
    () =>
      [...areas]
        .filter((a) => a.areaid != null)
        .sort((a, b) =>
          (a.areaname || "").localeCompare(b.areaname || "", undefined, {
            sensitivity: "base",
          }),
        ),
    [areas],
  );

  const generalAreaTemplateDocId = useMemo(() => {
    const general = areas.find((a) => (a.areaname ?? "").trim().toLowerCase() === "general");
    return general?.id ?? null;
  }, [areas]);

  const addAreaModalInputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  function openPickAreaModal() {
    setAddAreaPriceLevelId(project?.defaultpricelevelid ?? null);
    setAddAreaDisplayName("");
    setPickAreaOpen(true);
  }

  function openPickObjectModal(
    pa: ProjectAreaPublic,
    scopeCtx?: {
      scopeDocId: string;
      scopeInstanceId?: string | null;
      answerid?: string | null;
      scopeLabel?: string;
    },
  ) {
    setPickObjectContext({
      projectAreaDocId: pa.id,
      ...scopeCtx,
    });
    setPickObjectOpen(true);
  }

  function closePickObjectModal() {
    if (pickObjectSaving) return;
    setPickObjectOpen(false);
    setPickObjectContext(null);
  }

  function openPickScopeModal(pa: ProjectAreaPublic) {
    setPickScopeAreaId(pa.id);
    setPickScopeOpen(true);
  }

  function closePickScopeModal() {
    if (pickScopeSaving) return;
    setPickScopeOpen(false);
    setPickScopeAreaId(null);
  }

  async function addScopeToAreaFromPicker(scopeDocId: string) {
    const pa = pickScopeAreaId
      ? projectAreas.find((p) => p.id === pickScopeAreaId)
      : undefined;
    if (!pa) return;
    setPickScopeSaving(true);
    try {
      const alreadyOnArea = scopesForProjectArea(pa, areas, scopes).some(
        (s) => s.id === scopeDocId,
      );
      if (alreadyOnArea) {
        await cloneScopeInstance(pa, scopeDocId, null);
        closePickScopeModal();
      } else {
        const ok = await addExtraScopeToArea(pa, scopeDocId);
        if (ok) closePickScopeModal();
      }
    } finally {
      setPickScopeSaving(false);
    }
  }

  function checklistAreaActionsMenu(pa: ProjectAreaPublic, disabled: boolean) {
    const areaLabel = projectAreaHeading(pa, areas);
    return (
      <ClAreaHeaderMenu
        areaLabel={areaLabel}
        disabled={disabled}
        removeDisabled={paDeleting}
        onAddScope={() => openPickScopeModal(pa)}
        onAddObject={() => openPickObjectModal(pa)}
        onRemoveArea={() => setPaDeleteId(pa.id)}
      />
    );
  }

  async function saveWorkbenchBlankLine(
    pa: ProjectAreaPublic,
    body: WbBlankLineSaveBody,
    insertAfterLineDocId?: string | null,
  ) {
    setWbBlankLineSaving(true);
    setError(null);
    const ctx = wbBlankLineContextRef.current;
    const isManual2 = ctx?.linesource === "manual2";
    const restoreSourceIncluded =
      !isManual2 && ctx?.afterLineId && ctx.sourceRowWasIncluded ? ctx.afterLineId : null;
    try {
      const postBody: Record<string, unknown> = {
        projectAreaDocId: pa.id,
        quoteObjectDocId: body.quoteObjectDocId,
        linesource: ctx?.linesource ?? (insertAfterLineDocId?.trim() ? "manual2" : "manual"),
        custommeasure: body.custommeasure,
        customuom: body.customuom,
        customumprice: body.customumprice,
        skuProduct: body.skuProduct,
        manualSupplier: body.manualSupplier?.trim() ?? "",
      };
      if (body.pricelevelid != null) postBody.pricelevelid = body.pricelevelid;
      if (body.style != null) postBody.style = body.style;
      if (body.colour != null) postBody.colour = body.colour;
      const supplierSku = body.manualSupplierSku?.trim();
      if (supplierSku) postBody.manualSupplierSku = supplierSku;
      if (!isManual2) {
        if (body.skuId) postBody.skuId = body.skuId;
        if (body.supplierOption != null) postBody.supplierOption = body.supplierOption;
      }
      if (body.custommeasure != null && body.customumprice != null) {
        postBody.totalprice = body.custommeasure * body.customumprice;
      }
      const afterId = insertAfterLineDocId?.trim();
      if (afterId) postBody.insertAfterLineDocId = afterId;
      const res = await fetch("/api/projectareaobjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      });
      const data = await readApiResponse<{
        id?: string;
        error?: string;
        details?: unknown;
      }>(res);
      if (!res.ok) {
        const detail =
          data.details != null ? `: ${JSON.stringify(data.details)}` : "";
        throw new Error(`${data.error ?? "Failed to add line"}${detail}`);
      }
      setWbBlankLineContext(null);
      wbBlankLineContextRef.current = null;
      if (restoreSourceIncluded) {
        await patchLineItem(restoreSourceIncluded, { included: true });
      }
      const newLineId = data.id?.trim();
      if (isManual2 && newLineId) {
        const lineRes = await fetch(`/api/projectareaobjects/${encodeURIComponent(newLineId)}`);
        const lineData = await readApiResponse<{
          projectAreaObject?: ProjectAreaObjectPublic;
          error?: string;
        }>(lineRes);
        if (!lineRes.ok || !lineData.projectAreaObject) {
          throw new Error(lineData.error ?? "Failed to load new line");
        }
        const created = lineData.projectAreaObject;
        startTransition(() => {
          setAllObjects((prev) => {
            const existing = prev.find((o) => o.id === created.id);
            if (existing) {
              return prev.map((o) => (o.id === created.id ? created : o));
            }
            return sortProjectAreaLines([...prev, created]);
          });
        });
      } else {
        await reloadLineItems();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add line");
      await reloadLineItems();
    } finally {
      setWbBlankLineSaving(false);
    }
  }

  function closeWbBlankLineModal() {
    const ctx = wbBlankLineContextRef.current;
    setWbBlankLineContext(null);
    wbBlankLineContextRef.current = null;
    if (ctx?.linesource === "manual2" && ctx.afterLineId && ctx.sourceRowWasIncluded) {
      setAllObjects((prev) =>
        prev.map((o) => (o.id === ctx.afterLineId ? { ...o, included: true } : o)),
      );
      void patchLineItem(ctx.afterLineId, { included: true });
    }
  }

  function openWbBlankLineFromArea(pa: ProjectAreaPublic) {
    const ctx: WbBlankLineContext = {
      paId: pa.id,
      afterLineId: null,
      category: null,
      linesource: "manual",
      seed: null,
    };
    wbBlankLineContextRef.current = ctx;
    setWbBlankLineContext(ctx);
    setError(null);
  }

  function openWbBlankLineFromRow(
    pa: ProjectAreaPublic,
    row: ProjectAreaObjectPublic,
    qObj: QuoteObjectPublic,
  ) {
    const seed: WbBlankLineSeed = {
      quoteObjectDocId: qObj.id,
      custommeasure: row.custommeasure ?? null,
      customuom: row.customuom?.trim() || qObj.uom?.trim() || "ea",
      pricelevelid: row.pricelevelid ?? null,
      style: row.style ?? null,
      colour: row.colour ?? null,
    };
    const ctx: WbBlankLineContext = {
      paId: pa.id,
      afterLineId: row.id,
      category: qObj.category?.trim() || null,
      linesource: "manual2",
      seed,
      sourceRowWasIncluded: row.included !== false,
    };
    wbBlankLineContextRef.current = ctx;
    setWbBlankLineContext(ctx);
    setError(null);
    setAllObjects((prev) =>
      prev.map((o) => (o.id === row.id ? { ...o, included: false } : o)),
    );
    void patchLineItem(row.id, { included: false });
  }

  async function addLineItemFromQuoteObject(quoteObjectDocId: string) {
    if (!pickObjectContext) return;
    setPickObjectSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        projectAreaDocId: pickObjectContext.projectAreaDocId,
        quoteObjectDocId,
      };
      if (pickObjectContext.scopeDocId) {
        body.scopeDocId = pickObjectContext.scopeDocId;
        body.scopeInstanceId = pickObjectContext.scopeInstanceId ?? null;
        body.answerid = pickObjectContext.answerid ?? null;
      }
      const res = await fetch("/api/projectareaobjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to add line");
      closePickObjectModal();
      await reloadLineItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add quote object");
      await reloadLineItems();
    } finally {
      setPickObjectSaving(false);
    }
  }

  async function confirmProjectAreaDelete() {
    if (!paDeleteId || !projectDocId) return;
    setPaDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projectareas/${paDeleteId}`, { method: "DELETE" });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPaDeleteId(null);
      await Promise.all([
        reloadProjectAreas(),
        reloadLineItems(),
        reloadProjectAreaAnswers(),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove project area");
    } finally {
      setPaDeleting(false);
    }
  }

  async function confirmProjectAreaObjectDelete() {
    if (!paoDeleteId) return;
    setPaoDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projectareaobjects/${paoDeleteId}`, { method: "DELETE" });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPaoDeleteId(null);
      await reloadLineItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove line item");
    } finally {
      setPaoDeleting(false);
    }
  }

  const cloneLineItem = useCallback(async (lineId: string) => {
    setWbCloningLineId(lineId);
    setError(null);
    try {
      const res = await fetch(`/api/projectareaobjects/${lineId}/clone`, { method: "POST" });
      const data = await readApiResponse<{ id?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Clone failed");
      await reloadLineItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clone line");
    } finally {
      setWbCloningLineId(null);
    }
  }, [reloadLineItems]);

  const cloneScopeInstance = useCallback(
    async (pa: ProjectAreaPublic, scopeDocId: string, scopeInstanceId?: string | null) => {
      const savingKey = `scope-clone:${scopeAnswerSavingKey(scopeDocId, scopeInstanceId)}`;
      setScopeAnswerSaving(savingKey);
      setError(null);
      try {
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(pa.id)}/clone-scope`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scopeDocId,
              scopeInstanceId: scopeInstanceId?.trim() ? scopeInstanceId.trim() : null,
            }),
          },
        );
        const data = await readApiResponse<{
          projectArea?: ProjectAreaPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Clone failed");
        if (data.projectArea) {
          setProjectAreas((prev) =>
            prev.map((p) => (p.id === data.projectArea!.id ? data.projectArea! : p)),
          );
        }
        await reloadLineItems();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to clone scope");
        await reloadProjectAreas();
      } finally {
        setScopeAnswerSaving(null);
      }
    },
    [reloadLineItems, reloadProjectAreas],
  );

  async function addProjectAreaFromTemplate(areaDocId: string) {
    if (!projectDocId) return;
    const inheritedPl = project?.defaultpricelevelid ?? null;
    const pricelevelid = inheritedPl ?? addAreaPriceLevelId;
    if (pricelevelid == null) {
      setError(
        "Select an Elevate for this area. The project has no default Elevate—set one on the project or pick Elevate in the dialog.",
      );
      return;
    }
    setAddAreaSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projectareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectDocId,
          areaDocId,
          displayName: addAreaDisplayName.trim() ? addAreaDisplayName.trim() : null,
          areanotes1: "",
          areanotes2: "",
          aream2: null,
          areafinish: "",
          pricelevelid,
        }),
      });
      const data = await readApiResponse<{ id?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Add area failed");
      setPickAreaOpen(false);
      await reloadProjectAreas();
      await reloadLineItems();
      await reloadProjectAreaAnswers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project area save failed");
    } finally {
      setAddAreaSaving(false);
    }
  }

  const grandLineTotal = useMemo(
    () =>
      allObjects.reduce(
        (sum, row) => sum + includedLineTotal(row, contractLabourRates),
        0,
      ),
    [allObjects, contractLabourRates],
  );

  const settingsMarginPct = useMemo(() => marginPercentFromSettings(settings), [settings]);
  const storedProjectMarginPct = projectMarginPercent(project?.marginpct, settingsMarginPct);
  const [wbMarginPct, setWbMarginPct] = useState(storedProjectMarginPct);
  const marginSaveGen = useRef(0);
  const projectRef = useRef(project);
  projectRef.current = project;
  const projectIdForMargin = project?.id ?? null;
  useEffect(() => {
    setWbMarginPct(projectMarginPercent(projectRef.current?.marginpct, settingsMarginPct));
  }, [projectIdForMargin, settingsMarginPct]);
  const persistProjectMarginPct = useCallback(
    async (value: number) => {
      if (!projectDocId) return;
      const gen = ++marginSaveGen.current;
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectDocId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marginpct: value }),
        });
        const data = await readApiResponse<{ project?: ProjectPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to save margin");
        if (gen === marginSaveGen.current && data.project) {
          setProject(data.project);
        }
      } catch (e) {
        if (gen !== marginSaveGen.current) return;
        setError(e instanceof Error ? e.message : "Failed to save margin");
        try {
          const res = await fetch(`/api/projects/${projectDocId}`);
          const data = await readApiResponse<{ project?: ProjectPublic }>(res);
          if (res.ok && data.project) {
            setProject(data.project);
            setWbMarginPct(projectMarginPercent(data.project.marginpct, settingsMarginPct));
          }
        } catch {
          /* ignore */
        }
      }
    },
    [projectDocId, settingsMarginPct],
  );
  const onWbMarginChange = useCallback(
    (value: number) => {
      const next = parseMarginPercent(String(value));
      setWbMarginPct(next);
      void persistProjectMarginPct(next);
    },
    [persistProjectMarginPct],
  );
  const marginPct = mode === "workbench" ? wbMarginPct : storedProjectMarginPct;

  const projectAreaPendingDelete = paDeleteId
    ? projectAreas.find((pa) => pa.id === paDeleteId)
    : undefined;
  const linePendingDelete = paoDeleteId
    ? allObjects.find((o) => o.id === paoDeleteId)
    : undefined;

  const pickScopeArea = pickScopeAreaId
    ? projectAreas.find((pa) => pa.id === pickScopeAreaId)
    : undefined;

  const pickScopeTemplateAreaDocId = useMemo(() => {
    if (!pickScopeArea) return null;
    const aid = Number(pickScopeArea.areaid);
    if (!Number.isInteger(aid)) return null;
    return areas.find((a) => a.areaid != null && Number(a.areaid) === aid)?.id ?? null;
  }, [pickScopeArea, areas]);

  const pickScopeOnAreaIds = useMemo(() => {
    if (!pickScopeArea) return new Set<string>();
    return new Set(scopesForProjectArea(pickScopeArea, areas, scopes).map((s) => s.id));
  }, [pickScopeArea, areas, scopes]);

  const pickObjectArea = pickObjectContext
    ? projectAreas.find((pa) => pa.id === pickObjectContext.projectAreaDocId)
    : undefined;

  const wbBlankLineArea = wbBlankLineContext
    ? projectAreas.find((pa) => pa.id === wbBlankLineContext.paId)
    : undefined;

  const projectLoadTotals = useMemo(() => {
    const t = {} as Record<LabourSiloKey, number>;
    for (const k of LOOKUP_LABOUR_SILO_KEYS) t[k] = sumLabourHours(allObjects, k);
    return t;
  }, [allObjects]);

  const inputKey = (row: ProjectAreaObjectPublic, field: string) =>
    `${row.id}-${row.updatedAt ?? ""}-${field}`;

  const areaFieldKey = (pa: ProjectAreaPublic, field: string) =>
    `${pa.id}-${pa.updatedAt ?? ""}-${field}`;

  const objectLabel = useCallback(
    (row: ProjectAreaObjectPublic, qo: QuoteObjectPublic[]) =>
      projectLineObjectLabel(row, qo, catalogSkus),
    [catalogSkus],
  );

  const buildingElementBySkuName = useMemo(
    () => buildBuildingElementIndex(buildingElements),
    [buildingElements],
  );

  const paintingElementBySkuName = useMemo(
    () => buildPaintingElementIndex(paintingElements),
    [paintingElements],
  );

  const workbenchPaintingSiteFeeExcGst = useMemo(() => {
    if (mode !== "workbench") return 0;
    const hasConsumption = projectHasPaintConsumption({
      objects: allObjects,
      catalogSkus,
      paintingElementBySkuName,
      suppliersBySkuId,
      supplierDiscountByKey,
    });
    if (!hasConsumption) return 0;
    return paintingSiteFeeExcGst(contractLabourRates) ?? 0;
  }, [
    mode,
    allObjects,
    catalogSkus,
    paintingElementBySkuName,
    suppliersBySkuId,
    supplierDiscountByKey,
    contractLabourRates,
  ]);

  const grandTotal = grandLineTotal + workbenchPaintingSiteFeeExcGst;

  /** Material-only (ex labour) — Excel-style Line Sub Total in the page header summary. */
  const projectMaterialTotal = useMemo(
    () =>
      allObjects.reduce((sum, row) => {
        const b = lineFinalPriceBreakdown(
          row,
          0,
          undefined,
          undefined,
          undefined,
          contractLabourRates,
        );
        return sum + (b?.materialExcGst ?? 0);
      }, 0),
    [allObjects, contractLabourRates],
  );

  const projectLabourCostBySilo = useMemo(() => {
    const out = {} as Record<(typeof LOOKUP_LABOUR_SILO_KEYS)[number], number | null>;
    for (const key of LOOKUP_LABOUR_SILO_KEYS) {
      const hoursSum = projectLoadTotals[key];
      const rate = contractLabourRateBySiloProduct(contractLabourRates, key);
      out[key] = labourSiloCostExcGst(hoursSum > 0 ? hoursSum : null, rate);
    }
    return out;
  }, [projectLoadTotals, contractLabourRates]);

  const grandFinalTotal = useMemo(() => {
    const linesFinal = allObjects.reduce((sum, row) => {
      const f = lineFinalPrice(row, marginPct, undefined, undefined, undefined, contractLabourRates);
      return sum + (f != null ? f : 0);
    }, 0);
    const feeFinal =
      workbenchPaintingSiteFeeExcGst > 0
        ? paintingSiteFeeWithMarginExcGst(workbenchPaintingSiteFeeExcGst, marginPct)
        : 0;
    return linesFinal + feeFinal;
  }, [allObjects, marginPct, workbenchPaintingSiteFeeExcGst, contractLabourRates]);

  const clScrollContextAreas = useMemo((): ClScrollContextArea[] => {
    if (mode === "workbench") return [];
    return sortedProjectAreas.map((pa) => {
      const rows = objectsByProjectAreaDocId.get(pa.id) ?? [];
      const areaFinal = rows.reduce((sum, row) => {
        const f = lineFinalPrice(
          row,
          marginPct,
          undefined,
          undefined,
          undefined,
          contractLabourRates,
        );
        return sum + (f ?? 0);
      }, 0);
      const hasMoney = rows.some((r) => includedLineTotal(r, contractLabourRates) > 0);
      return {
        id: pa.id,
        name: projectAreaHeading(pa, areas),
        totalLabel: hasMoney ? formatMoney(areaFinal) : "—",
      };
    });
  }, [
    mode,
    sortedProjectAreas,
    objectsByProjectAreaDocId,
    marginPct,
    contractLabourRates,
    areas,
  ]);

  const projectRealisedMarginExcGst = useMemo(() => {
    if (grandTotal <= 0 && grandFinalTotal <= 0) return null;
    return Math.round((grandFinalTotal - grandTotal) * 100) / 100;
  }, [grandTotal, grandFinalTotal]);

  const authorFallback = project?.quotedby?.trim() ?? "";

  const projectNoteAreaOptions = useMemo((): ProjectNoteAreaOption[] => {
    return uniqueNoteAreaOptionsByAreaId(
      sortedProjectAreas.map((pa) => ({
        areaid: pa.areaid,
        label: projectAreaHeading(pa, areas),
      })),
    );
  }, [sortedProjectAreas, areas]);

  const projectNoteObjectLabelByArea = useMemo(() => {
    const byArea = new Map<number, Map<number, string>>();
    for (const row of allObjects) {
      if (!byArea.has(row.areaid)) byArea.set(row.areaid, new Map());
      const areaMap = byArea.get(row.areaid)!;
      if (!areaMap.has(row.objectid)) {
        areaMap.set(row.objectid, objectLabel(row, quoteObjects));
      }
    }
    return byArea;
  }, [allObjects, quoteObjects, objectLabel]);

  const projectNoteAreaLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const opt of projectNoteAreaOptions) {
      map.set(opt.areaid, opt.label);
    }
    return map;
  }, [projectNoteAreaOptions]);

  const projectNoteObjectOptionsForArea = useCallback(
    (areaid: number | null): ProjectNoteObjectOption[] => {
      if (areaid == null) {
        const seen = new Map<number, string>();
        for (const row of allObjects) {
          if (!seen.has(row.objectid)) {
            seen.set(row.objectid, objectLabel(row, quoteObjects));
          }
        }
        return [...seen.entries()]
          .map(([objectid, label]) => ({ objectid, label }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
      }
      const areaMap = projectNoteObjectLabelByArea.get(areaid);
      if (!areaMap) return [];
      return [...areaMap.entries()]
        .map(([objectid, label]) => ({ objectid, label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    },
    [allObjects, quoteObjects, objectLabel, projectNoteObjectLabelByArea],
  );

  const projectNoteAreaLabelForNote = useCallback(
    (areaid: number | null) => {
      if (areaid == null) return "Project";
      return projectNoteAreaLabelById.get(areaid) ?? `Area ${areaid}`;
    },
    [projectNoteAreaLabelById],
  );

  const projectNoteObjectLabelForNote = useCallback(
    (areaid: number | null, objectid: number | null) => {
      if (objectid == null) return "—";
      if (areaid != null) {
        return projectNoteObjectLabelByArea.get(areaid)?.get(objectid) ?? `Object ${objectid}`;
      }
      for (const areaMap of projectNoteObjectLabelByArea.values()) {
        const label = areaMap.get(objectid);
        if (label) return label;
      }
      return `Object ${objectid}`;
    },
    [projectNoteObjectLabelByArea],
  );

  const defaultViewFilterForTarget = useCallback(
    (target: ProjectNoteTarget): ProjectNoteViewFilter => {
      if (target.objectid != null && target.areaid != null) {
        return { areaid: target.areaid, objectid: target.objectid };
      }
      if (target.areaid != null) {
        return { areaid: target.areaid, objectid: null };
      }
      return { areaid: null, objectid: null };
    },
    [],
  );

  const printWorkbenchTradeReport = useCallback(
    (tradeId: WbTradeReportId) => {
      if (numericProjectId == null || !project) return;
      const config = WB_TRADE_REPORTS.find((r) => r.id === tradeId);
      if (!config) return;
      const data = buildWorkbenchTradeReport({
        config,
        project,
        projectid: numericProjectId,
        projectAreas: sortedProjectAreas,
        areas,
        projectNotes,
        quoteObjects,
        catalogSkus,
        suppliersBySkuId,
        scopes,
        objectsByProjectAreaDocId,
      });
      if (!wbTradeReportHasContent(data)) {
        setError(`No ${config.label} lines, products, or notes found on this project.`);
        return;
      }
      setError(null);
      setWbPaintLitresReportData(null);
      setWbPurchasingListReportWindowData(null);
      setWbTradeReportData(data);
    },
    [
      numericProjectId,
      project,
      sortedProjectAreas,
      areas,
      projectNotes,
      quoteObjects,
      catalogSkus,
      suppliersBySkuId,
      scopes,
      objectsByProjectAreaDocId,
    ],
  );

  const printWorkbenchPaintLitresReport = useCallback(() => {
    if (numericProjectId == null || !project) return;
    const data = buildWorkbenchPaintLitresReport({
      project,
      projectAreas: sortedProjectAreas,
      areas,
      quoteObjects,
      catalogSkus,
      suppliersBySkuId,
      supplierDiscountByKey,
      paintingElementBySkuName,
      objectsByProjectAreaDocId,
      contractLabourRates,
      marginPct,
    });
    if (!wbPaintLitresReportHasContent(data)) {
      setError(
        `No included paint lines with a SKU product found on this project for ${WB_PAINT_LITRES_REPORT_LABEL}.`,
      );
      return;
    }
    setError(null);
    setWbTradeReportData(null);
    setWbPurchasingListReportWindowData(null);
    setWbPaintLitresReportData(data);
    window.setTimeout(() => window.print(), 50);
  }, [
    numericProjectId,
    project,
    sortedProjectAreas,
    areas,
    quoteObjects,
    catalogSkus,
    suppliersBySkuId,
    supplierDiscountByKey,
    paintingElementBySkuName,
    objectsByProjectAreaDocId,
    contractLabourRates,
    marginPct,
  ]);

  const openWorkbenchPurchasingListReport = useCallback(() => {
    if (!project) return;
    const data = buildWorkbenchPurchasingListReport({
      project,
      projectAreas: sortedProjectAreas,
      catalogSkus,
      quoteObjects,
      suppliersBySkuId,
      supplierDiscountByKey,
      buildingElementBySkuName,
      paintingElementBySkuName,
      objectsByProjectAreaDocId,
    });
    if (!wbPurchasingListReportHasContent(data)) {
      setError(
        `No included products found on this project for ${WB_PURCHASING_LIST_REPORT_WINDOW_LABEL}.`,
      );
      return;
    }
    setError(null);
    setWbTradeReportData(null);
    setWbPaintLitresReportData(null);
    setWbPurchasingListReportWindowData(data);
  }, [
    project,
    sortedProjectAreas,
    catalogSkus,
    quoteObjects,
    suppliersBySkuId,
    supplierDiscountByKey,
    buildingElementBySkuName,
    paintingElementBySkuName,
    objectsByProjectAreaDocId,
  ]);

  const renderProjectNotesButton = useCallback(
    (
      target: ProjectNoteTarget,
      label: string,
      opts?: {
        compact?: boolean;
        size?: "default" | "compact" | "areaHeader" | "projectHeader" | "workbench";
        disabled?: boolean;
        projectAreaDocId?: string;
      },
    ) => {
      if (numericProjectId == null) return null;
      const badgeNotes = filterNotesForTarget(projectNotes, {
        projectid: numericProjectId,
        areaid: target.areaid,
        objectid: target.objectid,
      });
      const notesModalOpen =
        opts?.projectAreaDocId != null && areaNotesOpenPaId === opts.projectAreaDocId;
      const escalationDraft =
        opts?.projectAreaDocId != null &&
        areaNotesEscalationDraftPaId === opts.projectAreaDocId;
      return (
        <ProjectNotesButton
          label={label}
          badgeNotes={badgeNotes}
          allProjectNotes={projectNotes}
          projectid={numericProjectId}
          createTarget={target}
          defaultViewFilter={defaultViewFilterForTarget(target)}
          areaOptions={projectNoteAreaOptions}
          objectOptionsForArea={projectNoteObjectOptionsForArea}
          areaLabelForNote={projectNoteAreaLabelForNote}
          objectLabelForNote={projectNoteObjectLabelForNote}
          noteTypeOptions={noteTypeOptions}
          authorFallback={authorFallback}
          disabled={opts?.disabled}
          compact={opts?.compact}
          size={opts?.size}
          modalOpen={opts?.projectAreaDocId != null ? notesModalOpen : undefined}
          initialDraftNotetype={escalationDraft ? ESCALATION_NOTE_TYPE : undefined}
          focusDraftOnMount={escalationDraft}
          onModalOpenChange={
            opts?.projectAreaDocId != null
              ? (open) => {
                  if (open) {
                    setAreaNotesOpenPaId(opts.projectAreaDocId!);
                  } else {
                    setAreaNotesOpenPaId((id) =>
                      id === opts.projectAreaDocId ? null : id,
                    );
                    setAreaNotesEscalationDraftPaId((id) =>
                      id === opts.projectAreaDocId ? null : id,
                    );
                  }
                }
              : undefined
          }
          onCreateNote={(target, body) => createProjectNote(target, body)}
          onUpdateNote={updateProjectNote}
          onDeleteNote={deleteProjectNote}
        />
      );
    },
    [
      numericProjectId,
      projectNotes,
      areaNotesOpenPaId,
      areaNotesEscalationDraftPaId,
      noteTypeOptions,
      authorFallback,
      createProjectNote,
      updateProjectNote,
      deleteProjectNote,
      defaultViewFilterForTarget,
      projectNoteAreaOptions,
      projectNoteObjectOptionsForArea,
      projectNoteAreaLabelForNote,
      projectNoteObjectLabelForNote,
    ],
  );

  const workbenchBundledCtx = useMemo((): WorkbenchBundledContext => {
    return {
      wbSelectRow,
      wbInputMeasure,
      wbInputCurrency,
      wbInputLoad,
      wbCellMid,
      wbCellDesc,
      wbCellSku,
      wbCellUom,
      wbCellNum,
      wbCellLoad,
      wbSpacerCell,
      areaObjectBand: wbAreaObjectBand,
      showCascadeDetailColumns: wbColumnView === "detail",
      cascades,
      baseStyleOptions,
      marginPct,
      showIncludeAllSupplierOptions: true,
      paoDeleting,
      includeAllSuppliersForLine,
      setIncludeAllSuppliersForLine,
      inputKey,
      objectLabel,
      lineSourceLabel,
      lineFinalPrice: (row, pct) =>
        lineFinalPrice(row, pct, undefined, undefined, undefined, contractLabourRates),
      effectiveCascadeStyleForLine,
      wbLineColourEmptyLabel,
      formatMoney,
      renderObjectNotesButton: (row, label) =>
        renderProjectNotesButton(
          { projectid: row.projectid, areaid: row.areaid, objectid: row.objectid },
          label,
          { size: "workbench", disabled: rowSavingId === row.id || paoDeleting },
        ),
      onDeleteLine: (lineId) => setPaoDeleteId(lineId),
      onCloneLine: (lineId) => {
        void cloneLineItem(lineId);
      },
      wbCloningLineId,
      onValidationError: setError,
      contractLabourRates,
      objectLabourRates,
      buildingElementBySkuName,
      onOpenBuildingElementConsumption: setWbBuildingElementLineId,
      paintingElementBySkuName,
      onOpenPaintingElementConsumption: setWbPaintingElementLineId,
      colourLookupIndex,
      blankLineSourceRowId: wbBlankLineContext?.afterLineId ?? null,
      wbBlankLineSaving,
      onOpenBlankLineFromRow: (pa, row, qObj) => {
        openWbBlankLineFromRow(pa, row, qObj);
      },
    };
  }, [
    objectLabel,
    cascades,
    baseStyleOptions,
    marginPct,
    paoDeleting,
    includeAllSuppliersForLine,
    setIncludeAllSuppliersForLine,
    contractLabourRates,
    objectLabourRates,
    buildingElementBySkuName,
    paintingElementBySkuName,
    wbCloningLineId,
    cloneLineItem,
    renderProjectNotesButton,
    rowSavingId,
    colourLookupIndex,
    wbBlankLineContext,
    wbBlankLineSaving,
    wbColumnView,
  ]);

  const wbDetailView = wbColumnView === "detail";
  const wbTableCols =
    mode === "workbench" && !wbDetailView ? WB_TABLE_COLS_SUMMARY : WB_TABLE_COLS;

  return (
    <div className={mode === "workbench" ? "space-y-0" : "space-y-0"}>
      <ProjectsTabs />

      {mode === "workbench" ? (
        <div className="border-b border-sf-border bg-sf-surface px-5 py-2 dark:border-zinc-700">
          <p className="max-w-3xl text-xs text-sf-text-weak dark:text-zinc-400">
            Edits save when you leave a cell (Tab or click away). Unchecked lines are excluded from
            subtotals. Line total is measure × unit price plus labour; labour columns are informational
            (already in line totals). Margin applies to Final / Grand Total.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {projectDocId && project && !loading && mode !== "workbench" ? (
        <div className="border-b border-sf-border bg-sf-surface dark:border-zinc-700">
          {/* Project identity + total — v0 ChecklistProjectPanel */}
          <div className="flex flex-wrap items-center gap-3 border-b border-sf-border px-5 py-3 dark:border-zinc-700">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div>
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-sf-text-secondary">
                  Project
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={clProjectHdrNameClass} title={project.projectname}>
                    {project.projectname}
                  </span>
                  {numericProjectId != null ? (
                    <span className="inline-flex items-center rounded-full border border-sf-accent/20 bg-sf-accent-muted px-2 py-0.5 text-[11px] font-semibold text-sf-accent">
                      ID {numericProjectId}
                    </span>
                  ) : null}
                  {renderProjectNotesButton(
                    { projectid: numericProjectId ?? 0 },
                    project.projectname,
                    { size: "projectHeader" },
                  )}
                  {numericProjectId != null ? (
                    <ClProjectHeaderMenu
                      projectLabel={project.projectname}
                      disabled={projectSaving}
                      onAddArea={openPickAreaModal}
                    />
                  ) : null}
                  <div className="ml-1 flex flex-col items-start">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sf-text-secondary">
                      Total Price
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-sf-accent">
                      {grandFinalTotal > 0 ? formatMoney(grandFinalTotal) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-3 border-b border-sf-border px-5 py-4 dark:border-zinc-700">
            <ChecklistProjectDimensionsRow
              project={project}
              disabled={projectSaving}
              onPatch={(body) => void patchProject(body)}
              onValidationError={setError}
            />
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex min-w-[10rem] flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-sf-text-secondary">
                  Default Elevate
                </span>
                <CascadeElevateSelect
                  cascades={cascades}
                  priceLevels={priceLevels}
                  priceLevelId={project.defaultpricelevelid ?? null}
                  projectFinish={project.projectfinish}
                  onChange={({ priceLevelId, projectFinish }) =>
                    void patchProject({
                      defaultpricelevelid: priceLevelId,
                      projectfinish: projectFinish,
                      defaultstyle: "",
                      defaultcolour: "",
                    })
                  }
                  className="h-8 rounded-lg border border-sf-border bg-sf-page px-2.5 text-sm font-medium text-sf-text outline-none focus:ring-2 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950"
                  disabled={projectSaving}
                  emptyLabel="Not set"
                />
              </label>
              <CascadeStyleColourFields
                cascades={cascades}
                level={cascadeLevelFromPriceLevel(
                  priceLevels,
                  project.defaultpricelevelid,
                  project.projectfinish,
                  cascades,
                )}
                style={project.defaultstyle ?? ""}
                colour={project.defaultcolour ?? ""}
                disabled={projectSaving}
                selectClassName="h-8 rounded-lg border border-sf-border bg-sf-page px-2.5 text-sm font-medium text-sf-text outline-none focus:ring-2 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950"
                styleSelectClassName="h-8 rounded-lg border border-sf-border bg-sf-page px-2.5 text-sm font-medium text-sf-text outline-none focus:ring-2 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950"
                colourSelectClassName="h-8 rounded-lg border border-sf-border bg-sf-page px-2.5 text-sm font-medium text-sf-text outline-none focus:ring-2 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950"
                layout="compact"
                styleLabel="Style"
                colourLabel="Colour"
                styleEmptyLabel="Not set"
                colourEmptyLabel="Not set"
                onStyleChange={(v) =>
                  void patchProject({ defaultstyle: v, defaultcolour: "" })
                }
                onColourChange={(v) => void patchProject({ defaultcolour: v })}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-sf-text-weak">
              Style and colour options come from Cascades (Import). Used for SKU matching on scope
              lines unless an area overrides them.
            </p>
          </div>
        </div>
      ) : null}

      {!projectDocId ? (
        <div className="m-5 rounded-lg border border-sf-border bg-sf-surface p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sf-text-secondary dark:text-zinc-300">
            Open this screen from a project: use <span className="font-medium">Check List</span> on a
            project tile, or the Check List tab with{" "}
            <code className="rounded bg-sf-page px-1.5 py-0.5 text-sm dark:bg-zinc-800">
              ?id=&lt;project id&gt;
            </code>
            .
          </p>
        </div>
      ) : loading ? (
        <p className="m-5 text-sf-text-secondary dark:text-zinc-400">Loading…</p>
      ) : numericProjectId == null ? (
        <div className="m-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          This project needs a numeric ID before line items can load. Save it once from the Project
          tab, or run Assign missing numeric IDs from the Projects list.
        </div>
      ) : sortedProjectAreas.length === 0 && mode !== "workbench" ? (
        <div className="m-5 rounded-lg border border-sf-border bg-sf-surface p-6 text-sm text-sf-text-secondary shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
          No areas on this project yet.{" "}
          <button
            type="button"
            onClick={openPickAreaModal}
            className="font-medium text-sf-brand underline underline-offset-2 hover:text-sf-brand-hover dark:text-emerald-400"
          >
            Add area…
          </button>{" "}
          to pick a template from Setup (scopes and default lines copy in).
        </div>
      ) : mode === "workbench" || sortedProjectAreas.length > 0 ? (
        <div className={mode === "workbench" ? "w-full min-w-0 px-4 py-3 md:px-5" : "w-full min-w-0"}>
          <table
            className={
              mode === "workbench"
                ? "w-full border-collapse text-sm table-fixed"
                : "w-full min-w-[112.2rem] border-collapse text-sm table-fixed"
            }
          >
            {mode === "workbench" ? (
              <colgroup>
                <col className="w-[2.25rem]" />
                <col className="w-[4rem]" />
                {wbDetailView ? (
                  <>
                    <col className="w-[2.63rem]" />
                    <col className="w-[5.25rem]" />
                    <col className="w-[5.25rem]" />
                    <col className="w-[5.95rem]" />
                  </>
                ) : null}
                <col className="w-[11.5rem]" />
                <col className="w-[2.3rem]" />
                <col className="w-[2.75rem]" />
                <col className="w-[2.8rem]" />
                <col className={wbSubtotalCol} />
                <col className="w-[1.85rem]" />
                <col className="w-[1.85rem]" />
                <col className="w-[1.85rem]" />
                <col className="w-[1.85rem]" />
                <col className="w-[3.15rem]" />
                <col className={wbSupplierCol} />
                <col className="w-[3.44rem]" />
                <col className={wbSpacerCol} />
              </colgroup>
            ) : (
              <colgroup>
                <col className="w-[3.25rem]" />
                <col className="w-[16%]" />
                <col className="w-[5.5rem]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[15.6%]" />
                <col className="w-[2.25%]" />
                <col className="w-[4%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[5.5%]" />
                <col className="w-[min(16%,14rem)]" />
              </colgroup>
            )}
            <tbody>
              {mode === "checklist" && projectRedundantScopeEntries.length > 0 ? (
                <tr className="border-b border-amber-200/80 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <td colSpan={WB_TABLE_COLS} className="px-4 py-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                            Redundant scope questions on this project
                          </h3>
                          <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                            Leftover answers, lines, and metrics from scopes no longer on each
                            template area. Remove clears all project data for that scope on the
                            area (answers, lines, bundled children, and metrics).
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
                          disabled={redundantPurgeSaving}
                          onClick={() => void purgeAllRedundantScopesFromProject()}
                        >
                          {redundantPurgeSaving
                            ? "Removing…"
                            : `Remove all (${projectRedundantScopeEntries.length})`}
                        </button>
                      </div>
                      <ul className="space-y-1.5">
                        {projectRedundantScopeEntries.map((entry) => {
                          const busy =
                            redundantPurgeSaving ||
                            scopeAnswerSaving === entry.scopeDocId;
                          const pa = projectAreas.find((p) => p.id === entry.projectAreaDocId);
                          const detailParts = redundantScopeDetailParts(entry);
                          return (
                            <li
                              key={`project-redundant:${entry.projectAreaDocId}:${entry.scopeDocId}`}
                              className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200/90 bg-white/80 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/30"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-sf-text dark:text-zinc-100">
                                  <span className="text-sf-text-secondary dark:text-zinc-400">
                                    {entry.areaLabel}
                                  </span>
                                  {" · "}
                                  {entry.questionLabel}
                                </span>
                                {detailParts.length > 0 ? (
                                  <span className="mt-0.5 block text-xs text-sf-text-secondary dark:text-zinc-400">
                                    {detailParts.join(" · ")}
                                  </span>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
                                disabled={busy || !pa}
                                onClick={() =>
                                  pa
                                    ? void purgeRedundantScopeFromArea(pa, entry.scopeDocId)
                                    : undefined
                                }
                              >
                                {scopeAnswerSaving === entry.scopeDocId
                                  ? "Removing…"
                                  : "Remove"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </td>
                </tr>
              ) : null}
              {mode === "workbench" && project ? (
                <tr className={wbProjectHdrRow}>
                  <td
                    colSpan={wbTableCols}
                    className="border-0 border-b border-sf-border px-5 pb-3 pt-4 align-top dark:border-zinc-700"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                      {/* Left: project identity + cascade selectors */}
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-sf-text-secondary dark:text-zinc-400">
                            Project
                          </span>
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                              className="truncate text-xl font-bold leading-tight text-sf-brand dark:text-zinc-50"
                              title={project.projectname}
                            >
                              {project.projectname}
                            </span>
                            {numericProjectId != null ? (
                              <span className="inline-flex items-center rounded-full border border-sf-accent/20 bg-sf-accent-muted px-2 py-0.5 text-[11px] font-semibold text-sf-accent dark:border-sf-accent/30 dark:bg-sf-accent/15 dark:text-emerald-300">
                                ID {numericProjectId}
                              </span>
                            ) : null}
                            {renderProjectNotesButton(
                              { projectid: numericProjectId ?? 0 },
                              project.projectname,
                              { size: "workbench" },
                            )}
                            <WbProjectHdrMenu
                              projectLabel={project.projectname}
                              exportDisabled={wbExporting}
                              onPrintTradeReport={printWorkbenchTradeReport}
                              onPrintPaintLitresReport={printWorkbenchPaintLitresReport}
                              onOpenPurchasingListReport={openWorkbenchPurchasingListReport}
                              onExport={(sortMode) => {
                                void (async () => {
                                  setWbExporting(true);
                                  setError(null);
                                  try {
                                    await downloadProjectWorkbenchXls(
                                      projectDocId,
                                      project.projectname || "project",
                                      sortMode,
                                    );
                                  } catch (e) {
                                    setError(
                                      e instanceof Error
                                        ? e.message
                                        : "Workbench export failed",
                                    );
                                  } finally {
                                    setWbExporting(false);
                                  }
                                })();
                              }}
                              onAddArea={openPickAreaModal}
                            />
                          </div>
                        </div>
                        <div className={`${wbAreaHdrFieldsRow} mt-1`}>
                          <label className="flex w-fit shrink-0 flex-col gap-0.5">
                            <span className={wbHdrLabel}>Default Elevate</span>
                            <CascadeElevateSelect
                              cascades={cascades}
                              priceLevels={priceLevels}
                              priceLevelId={project.defaultpricelevelid ?? null}
                              projectFinish={project.projectfinish}
                              onChange={({ priceLevelId, projectFinish }) =>
                                void patchProject({
                                  defaultpricelevelid: priceLevelId,
                                  projectfinish: projectFinish,
                                  defaultstyle: "",
                                  defaultcolour: "",
                                })
                              }
                              className={wbAreaHdrSelectElevate}
                              disabled={projectSaving}
                              emptyLabel="Not set"
                            />
                          </label>
                          <CascadeStyleColourFields
                            cascades={cascades}
                            level={cascadeLevelFromPriceLevel(
                              priceLevels,
                              project.defaultpricelevelid,
                              project.projectfinish,
                              cascades,
                            )}
                            style={project.defaultstyle ?? ""}
                            colourFilterStyle={project.defaultstyle ?? ""}
                            colour={project.defaultcolour ?? ""}
                            disabled={projectSaving}
                            styleSelectClassName={wbAreaHdrSelectStyle}
                            colourSelectClassName={wbAreaHdrSelectColour}
                            layout="compact"
                            compactField="style"
                            styleLabel="Style"
                            colourLabel="Colour"
                            styleEmptyLabel="Not set"
                            colourEmptyLabel="Not set"
                            onStyleChange={(v) =>
                              void patchProject({ defaultstyle: v, defaultcolour: "" })
                            }
                            onColourChange={(v) => void patchProject({ defaultcolour: v })}
                          />
                          <CascadeStyleColourFields
                            cascades={cascades}
                            level={cascadeLevelFromPriceLevel(
                              priceLevels,
                              project.defaultpricelevelid,
                              project.projectfinish,
                              cascades,
                            )}
                            style={project.defaultstyle ?? ""}
                            colourFilterStyle={project.defaultstyle ?? ""}
                            colour={project.defaultcolour ?? ""}
                            disabled={projectSaving}
                            styleSelectClassName={wbAreaHdrSelectStyle}
                            colourSelectClassName={wbAreaHdrSelectColour}
                            layout="compact"
                            compactField="colour"
                            styleLabel="Style"
                            colourLabel="Colour"
                            styleEmptyLabel="Not set"
                            colourEmptyLabel="Not set"
                            onStyleChange={(v) =>
                              void patchProject({ defaultstyle: v, defaultcolour: "" })
                            }
                            onColourChange={(v) => void patchProject({ defaultcolour: v })}
                          />
                        </div>
                      </div>

                      {/* Right: Detail/Summary + trade tags + financial cards */}
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <WbCompressToggle
                            compressed={wbCompressed}
                            onToggle={toggleWbCompressed}
                          />
                        <div
                          className="flex w-fit items-center gap-0.5 rounded-lg border border-sf-border bg-sf-page p-0.5 dark:border-zinc-700 dark:bg-zinc-900/70"
                          role="group"
                          aria-label="Workbench column view"
                        >
                          <button
                            type="button"
                            aria-pressed={wbDetailView}
                            onClick={() => setWbColumnView("detail")}
                            className={`min-h-8 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                              wbDetailView
                                ? "border border-sf-border bg-sf-surface text-sf-brand shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                                : "text-sf-text-secondary hover:text-sf-text dark:text-zinc-400 dark:hover:text-zinc-200"
                            }`}
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            aria-pressed={!wbDetailView}
                            onClick={() => setWbColumnView("summary")}
                            className={`min-h-8 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                              !wbDetailView
                                ? "border border-sf-border bg-sf-surface text-sf-brand shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                                : "text-sf-text-secondary hover:text-sf-text dark:text-zinc-400 dark:hover:text-zinc-200"
                            }`}
                            title="Hide Source, Elevate, Style, and Colour columns"
                          >
                            Summary
                          </button>
                        </div>
                        </div>
                        <WbProjectSummary
                          lineSubTotal={projectMaterialTotal}
                          paintingExcGst={workbenchPaintingSiteFeeExcGst}
                          labourCostBySilo={projectLabourCostBySilo}
                          netTotal={grandTotal}
                          marginPct={marginPct}
                          marginExcGst={projectRealisedMarginExcGst}
                          grandTotal={grandFinalTotal}
                          canAdjustMargin={canAdjustWorkbenchMargin}
                          onMarginChange={onWbMarginChange}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
              {sortedProjectAreas.length === 0 ? (
                <tr>
                  <td
                    colSpan={wbTableCols}
                    className="border border-sf-border bg-sf-surface px-4 py-6 text-sm text-sf-text-secondary dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
                  >
                    No areas on this project yet. Use{" "}
                    <span className="font-medium text-sf-text dark:text-zinc-200">Add area…</span>{" "}
                    from the project row menu.
                  </td>
                </tr>
              ) : (
              sortedProjectAreas.map((pa, areaIndex) => {
                const rows = objectsByProjectAreaDocId.get(pa.id) ?? [];
                const { topLevel: areaTopLines, bundledByParentId } = partitionAreaLines(rows);
                const areaSubtotal = rows.reduce(
                  (sum, row) => sum + includedLineTotal(row, contractLabourRates),
                  0,
                );
                const areaMaterialTotal = rows.reduce((sum, row) => {
                  const b = lineFinalPriceBreakdown(
                    row,
                    0,
                    undefined,
                    undefined,
                    undefined,
                    contractLabourRates,
                  );
                  return sum + (b?.materialExcGst ?? 0);
                }, 0);
                const areaFinalSubtotal = rows.reduce((sum, row) => {
                  const f = lineFinalPrice(
                    row,
                    marginPct,
                    undefined,
                    undefined,
                    undefined,
                    contractLabourRates,
                  );
                  return sum + (f ?? 0);
                }, 0);
                const areaRealisedMarginExcGst =
                  areaSubtotal > 0 || areaFinalSubtotal > 0
                    ? Math.round((areaFinalSubtotal - areaSubtotal) * 100) / 100
                    : null;
                const hasIncludedMoney = rows.some(
                  (r) => includedLineTotal(r, contractLabourRates) > 0,
                );
                const areaLoadTotals = Object.fromEntries(
                  LOOKUP_LABOUR_SILO_KEYS.map((k) => [k, sumLabourHours(rows, k)]),
                ) as Record<LabourSiloKey, number>;
                const areaLabourCostBySilo = Object.fromEntries(
                  LOOKUP_LABOUR_SILO_KEYS.map((key) => {
                    const hoursSum = areaLoadTotals[key];
                    const rate = contractLabourRateBySiloProduct(contractLabourRates, key);
                    return [
                      key,
                      labourSiloCostExcGst(hoursSum > 0 ? hoursSum : null, rate),
                    ];
                  }),
                ) as Record<(typeof LOOKUP_LABOUR_SILO_KEYS)[number], number | null>;
                const areaBusy = areaSavingId === pa.id;
                const areaScopes = scopesForProjectArea(pa, areas, scopes);
                const redundantScopeEntries =
                  mode === "checklist"
                    ? redundantScopeEntriesForProjectArea(pa, areas, scopes, rows)
                    : [];
                const areaNameForHeading = projectAreaHeading(pa, areas);
                const areaTemplateName = projectAreaTemplateName(pa, areas);
                const templateAreaDocId =
                  areas.find((a) => a.areaid != null && Number(a.areaid) === Number(pa.areaid))
                    ?.id ?? null;
                const areaAnswers = projectAreaAnswers.filter(
                  (a) => a.projectAreaDocId === pa.id,
                );
                const wbScopeMetricEntries =
                  mode === "workbench"
                    ? collectScopeMetricEntriesForProjectArea(pa, areaScopes, rows)
                    : [];
                const areaObjectBand = wbAreaObjectBand;
                return (
                  <Fragment key={pa.id}>
                    {mode !== "workbench" ? (
                      <>
                      {areaIndex > 0 ? (
                        <tr aria-hidden>
                          <td colSpan={19} className={wbAreaGapCell} />
                        </tr>
                      ) : null}
                      {areaIndex === 0 ? (
                        <ClAreaJumpNavRow
                          projectAreas={sortedProjectAreas}
                          areas={areas}
                          colSpan={19}
                          cellClassName="border-b border-sf-border bg-sf-surface px-5 py-2 dark:border-zinc-700"
                        />
                      ) : null}
                      <tr>
                        <td
                          colSpan={19}
                          className="border-0 p-0 align-top"
                        >
                          <div
                            data-cl-area-id={pa.id}
                            className="min-w-0"
                          >
                          <div
                            id={clAreaAnchorId(pa.id)}
                            className={`${clAreaHdrBand} sticky top-0 z-20 scroll-mt-4 border-b border-[#2d3d4f]`}
                          >
                            <div className="flex flex-wrap items-end gap-3 px-5 py-3">
                              <span
                                className={`shrink-0 pb-0.5 ${clAreaNameText}`}
                                title={areaTemplateName}
                              >
                                {areaTemplateName}
                              </span>
                              <div className="mx-1 w-px self-stretch bg-white/20" aria-hidden />
                              <label className="flex flex-col gap-1">
                                <span className={clAreaHdrLabel}>Nickname</span>
                                <input
                                  key={areaFieldKey(pa, "displayName")}
                                  type="text"
                                  className={`${clAreaHdrInput} w-36`}
                                  defaultValue={pa.displayName ?? ""}
                                  disabled={areaBusy}
                                  placeholder="e.g. Master, En-suite…"
                                  aria-label={`Nickname for ${areaTemplateName}`}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  }}
                                  onBlur={(e) => {
                                    const next = e.target.value.trim();
                                    const prev = (pa.displayName ?? "").trim();
                                    if (next === prev) return;
                                    void patchProjectArea(pa.id, {
                                      displayName: next || null,
                                    });
                                  }}
                                />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className={clAreaHdrLabel}>Area m²</span>
                                <input
                                  key={areaFieldKey(pa, "m2")}
                                  type="text"
                                  inputMode="decimal"
                                  className={`${clAreaHdrInput} w-14 px-2 text-center`}
                                  defaultValue={pa.aream2 ?? ""}
                                  disabled={areaBusy}
                                  placeholder="—"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  }}
                                  onBlur={(e) => {
                                    const raw = e.target.value.trim();
                                    if (raw !== "" && parseOptionalNumber(raw) === null) {
                                      setError("Area m² must be a valid number (or empty).");
                                      e.target.value = pa.aream2 != null ? String(pa.aream2) : "";
                                      return;
                                    }
                                    const next = parseOptionalNumber(raw);
                                    const prev = pa.aream2 ?? null;
                                    if (next === prev) return;
                                    void patchProjectArea(pa.id, { aream2: next });
                                  }}
                                />
                              </label>
                              <ProjectAreaCeilingHeightField
                                pa={pa}
                                project={project}
                                disabled={areaBusy}
                                labelClassName={clAreaHdrLabel}
                                inputClassName={`${clAreaHdrInput} w-14 px-2 text-center`}
                                fieldKey={areaFieldKey(pa, "ceiling")}
                                onPatch={(body) => void patchProjectArea(pa.id, body)}
                                onValidationError={setError}
                              />
                              <div className="pb-0">
                                <ProjectAreaM2Calculator
                                  pa={pa}
                                  areaLabel={areaNameForHeading}
                                  disabled={areaBusy}
                                  labelClassName="sr-only"
                                  areaHeaderChrome
                                  onApply={(body) => void patchProjectArea(pa.id, body)}
                                />
                              </div>
                              <div className="shrink-0">
                                <ClNonStdTierOpenButton
                                  active={hasClNonStandardTierStyleColour(pa)}
                                  disabled={areaBusy}
                                  label={areaNameForHeading}
                                  onOpen={() =>
                                    setClNonStdModal({
                                      kind: "area",
                                      paId: pa.id,
                                      label: areaNameForHeading,
                                    })
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                {renderProjectNotesButton(
                                  { projectid: pa.projectid, areaid: pa.areaid },
                                  areaNameForHeading,
                                  {
                                    size: "areaHeader",
                                    disabled: areaBusy,
                                    projectAreaDocId: pa.id,
                                  },
                                )}
                                {checklistAreaActionsMenu(pa, areaBusy)}
                              </div>
                              <ProjectAreaStatusSelect
                                value={pa.areaStatus}
                                disabled={areaBusy}
                                labelClassName={clAreaHdrLabel}
                                selectClassName={clAreaHdrSelect}
                                onChange={(next) =>
                                  handleAreaStatusChange(pa, next, areaNameForHeading)
                                }
                              />
                              <div className="flex flex-col items-start">
                                <span className={clAreaHdrLabel}>Total Price</span>
                                <span className="text-lg font-bold tabular-nums text-[#4ECFA0]">
                                  {hasIncludedMoney ? formatMoney(areaFinalSubtotal) : "—"}
                                </span>
                              </div>
                            </div>
                            <div className="border-t border-sf-border bg-sf-page px-5 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                              <span className="text-xs font-bold uppercase tracking-wide text-sf-text dark:text-zinc-100">
                                Scope Questions
                              </span>
                            </div>
                          </div>
                          <div className={`${wbAreaObjectBand} space-y-0 px-0 py-0`}>
                          {areaScopes.length > 0 ? (
                            <ul className="flex w-full flex-col items-stretch space-y-0">
                              {areaScopes.flatMap((scope) => {
                                if (scope.kind === "header") {
                                  return [
                                    <li
                                      key={scope.id}
                                      className="border-b border-sf-border bg-sf-page px-5 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                                    >
                                      <span className="text-xs font-bold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-300">
                                        {scope.question}
                                      </span>
                                    </li>,
                                  ];
                                }
                                if (scope.kind === "footer") {
                                  return [
                                    <li
                                      key={scope.id}
                                      aria-hidden
                                      className="hidden"
                                    />,
                                  ];
                                }
                                const scopeInstanceIds = collectScopeInstanceIds(
                                  scope.id,
                                  pa.scopeAnswers,
                                  rows,
                                );
                                return scopeInstanceIds.map((scopeInstanceId) => {
                                const saved = pa.scopeAnswers?.find(
                                  (e) =>
                                    e.scopeDocId === scope.id &&
                                    matchesScopeInstance(e.scopeInstanceId, scopeInstanceId),
                                );
                                const value = saved?.answerid ?? "";
                                const answerSavingKey = scopeAnswerSavingKey(
                                  scope.id,
                                  scopeInstanceId,
                                );
                                const busy =
                                  scopeAnswerSaving === answerSavingKey ||
                                  scopeAnswerSaving ===
                                    `scope-clone:${answerSavingKey}`;
                                const yesOnlyId = singleYesAnswerId(scope);
                                const isExtraScope = (pa.extraScopeDocIds ?? []).includes(scope.id);
                                const scopeLines = rows.filter(
                                  (r) =>
                                    r.linesource === "scope" &&
                                    r.scopeDocId === scope.id &&
                                    matchesScopeInstance(r.scopeInstanceId, scopeInstanceId),
                                );
                                const scopeAnswered = Boolean(value) || scopeLines.length > 0;
                                const canCloneScope = scopeAnswered;
                                const usesBlindsAnswer = scopeSelectionUsesSystemBlinds(scope, value);
                                const blindsLine =
                                  scopeLines.find((l) => l.systemObjectKind === "blinds") ?? null;
                                const answerWidthCh = clAnswerWidthCh(scope.answers);
                                const answerWidthStyle = {
                                  width: answerWidthCh,
                                  minWidth: answerWidthCh,
                                  maxWidth: answerWidthCh,
                                } as const;
                                const scopeSkuFilters = scopeSkuFiltersForProjectArea(
                                  pa,
                                  project,
                                  priceLevels,
                                  cascades,
                                );
                                const answerAvailability = scopeAnswerForceAvailabilityById(
                                  scope,
                                  quoteObjects,
                                  catalogSkus,
                                  scopeSkuFilters,
                                  skuMatchOptions,
                                );
                                const yesAvailable = yesOnlyId
                                  ? (answerAvailability.get(yesOnlyId) ?? true)
                                  : true;
                                const showForceNaTag = forceNaAlertKeys.has(`${pa.id}:${scope.id}`);
                                const activeScopeMetrics = value
                                  ? scopeMetricsForAnswer(scope, value)
                                  : [];
                                const scopeMetricValuesMap = scopeMetricValuesMapForInstance(
                                  pa.scopeMetricValues,
                                  scope.id,
                                  scopeInstanceId,
                                );
                                const scopeMeasureExtras = {
                                  scopeMetrics: scope.scopeMetrics,
                                  scopeMetricValues: scopeMetricValuesMap,
                                  catalogSkus,
                                };
                                const scopeMetricMeasureKey = activeScopeMetrics
                                  .map((m) => `${m.metricid}:${scopeMetricValuesMap.get(m.metricid) ?? ""}`)
                                  .join("|");
                                const scopeBodyKey = clScopeBodyExpandKey(
                                  pa.id,
                                  scope.id,
                                  scopeInstanceId,
                                );
                                const scopeBodyExpanded = isClScopeBodyExpanded(scopeBodyKey);
                                const scopeSkuBodyId = clScopeSkuBodyDomId(scopeBodyKey);
                                return (
                                  <li
                                    key={`${scope.id}:${scopeInstanceId ?? "primary"}`}
                                    className={
                                      showForceNaTag
                                        ? "rounded-md border border-red-300 bg-red-50/80 py-2 shadow-sm ring-1 ring-red-300 dark:border-red-800 dark:bg-red-950/30 dark:ring-red-800"
                                        : scopeAnswered
                                          ? "rounded-md border border-sf-border bg-sf-surface py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/55"
                                          : `rounded-md border border-transparent py-2 ${wbAreaObjectBand}`
                                    }
                                  >
                                    {scopeLines.length === 0 ? (
                                      <div className={clScopeLineStackClass}>
                                        <ClScopeQuestionHeader
                                          scopeLabel={scope.question}
                                          busy={busy}
                                          canCloneScope={canCloneScope}
                                          onAddObject={() =>
                                            openPickObjectModal(pa, {
                                              scopeDocId: scope.id,
                                              scopeInstanceId,
                                              answerid: value || null,
                                              scopeLabel: scope.question,
                                            })
                                          }
                                          onClone={() =>
                                            void cloneScopeInstance(pa, scope.id, scopeInstanceId)
                                          }
                                        >
                                          <div className={clScopeQuestionAnswerGroupClass}>
                                            <ClScopeQuestionLabel
                                              question={scope.question}
                                              explanation={scope.explanation}
                                            />
                                            <label
                                              className={clAnswerInlineFieldClass}
                                              style={yesOnlyId ? undefined : answerWidthStyle}
                                            >
                                              {yesOnlyId ? (
                                                <span className="flex h-[2.125rem] items-center gap-1.5">
                                                  <input
                                                    type="checkbox"
                                                    className="size-4 shrink-0 rounded border-sf-border-strong accent-green-600 focus:ring-2 focus:ring-green-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-500"
                                                    disabled={busy || !yesAvailable}
                                                    checked={value === yesOnlyId}
                                                    onChange={(e) => {
                                                      clearForceNaAlert(pa.id, scope.id);
                                                      void applyScopeAnswer(
                                                        pa,
                                                        scope.id,
                                                        e.target.checked ? yesOnlyId : null,
                                                        scopeInstanceId,
                                                      );
                                                    }}
                                                    aria-label={`Yes — ${scope.question}`}
                                                  />
                                                  {showForceNaTag ? (
                                                    <span
                                                      className="rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-900 dark:bg-red-900/60 dark:text-red-100"
                                                      title="Previous answer cleared — no matching SKUs at current tier/style/colour"
                                                    >
                                                      N/A
                                                    </span>
                                                  ) : null}
                                                </span>
                                              ) : (
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                  <select
                                                    aria-label={`Answer for: ${scope.question}`}
                                                    className={clAnswerSelectBase}
                                                    style={answerWidthStyle}
                                                    disabled={busy}
                                                    value={value}
                                                    onChange={(e) => {
                                                      clearForceNaAlert(pa.id, scope.id);
                                                      const v = e.target.value;
                                                      void applyScopeAnswer(
                                                        pa,
                                                        scope.id,
                                                        v === "" ? null : v,
                                                        scopeInstanceId,
                                                      );
                                                    }}
                                                  >
                                                    <option value="">{"\u00A0"}</option>
                                                    {scope.answers.map((a) => {
                                                      const available =
                                                        answerAvailability.get(a.answerid) ?? true;
                                                      return (
                                                        <option
                                                          key={a.answerid}
                                                          value={a.answerid}
                                                          disabled={!available}
                                                        >
                                                          {a.label}
                                                        </option>
                                                      );
                                                    })}
                                                  </select>
                                                  {showForceNaTag ? (
                                                    <span
                                                      className="shrink-0 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-900 dark:bg-red-900/60 dark:text-red-100"
                                                      title="Previous answer cleared — no matching SKUs at current tier/style/colour"
                                                    >
                                                      N/A
                                                    </span>
                                                  ) : null}
                                                </span>
                                              )}
                                              {busy ? (
                                                <span className="text-[10px] text-sf-text-weak">
                                                  Updating…
                                                </span>
                                              ) : null}
                                            </label>
                                            <ClScopeCollapseButton
                                              expanded={scopeBodyExpanded}
                                              onToggle={() =>
                                                toggleClScopeBodyExpanded(scopeBodyKey)
                                              }
                                              controlsId={scopeSkuBodyId}
                                              label={scope.question}
                                            />
                                            <ScopeToolAfterAnswer
                                              scope={scope}
                                              answered={Boolean(value)}
                                              disabled={busy}
                                            />
                                          </div>
                                          {isExtraScope ? (
                                            <button
                                              type="button"
                                              className="shrink-0 rounded-full px-1.5 py-0.5 text-xs text-sf-text-weak hover:bg-sf-page hover:text-sf-text dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                                              title="Remove this added scope from this area only"
                                              aria-label={`Remove added scope: ${scope.question}`}
                                              onClick={() =>
                                                void removeExtraScopeFromArea(pa, scope.id)
                                              }
                                            >
                                              ×
                                            </button>
                                          ) : null}
                                        </ClScopeQuestionHeader>
                                        {activeScopeMetrics.length > 0 ? (
                                          <ScopeChecklistMetricsRow
                                            pa={pa}
                                            scopeDocId={scope.id}
                                            scopeInstanceId={scopeInstanceId}
                                            metrics={activeScopeMetrics}
                                            disabled={busy}
                                            onProjectAreaUpdated={(updatedPa) => {
                                              setProjectAreas((prev) =>
                                                prev.map((p) =>
                                                  p.id === updatedPa.id ? updatedPa : p,
                                                ),
                                              );
                                              void reloadLineItems();
                                            }}
                                            onError={setError}
                                          />
                                        ) : null}
                                        {scopeBodyExpanded ? (
                                          <div id={scopeSkuBodyId}>
                                        <div
                                          className={clScopeQuestionSkuDividerClass}
                                          role="separator"
                                          aria-hidden
                                        />
                                        <div className={clFieldsGridClass} style={clFieldsGridStyle}>
                                          <div
                                            className={`${clSkuFieldClass} ${clScopeSkuColClass}`}
                                            aria-hidden
                                          />
                                          <div
                                            className={`${clMeasureFieldClass} ${clScopeMeasureColClass}`}
                                            aria-hidden
                                          />
                                          <div
                                            className={`${clUomFieldClass} ${clScopeUomColClass}`}
                                            aria-hidden
                                          />
                                          <div
                                            className={`${clNonStdCellClass} ${clScopeNonStdColClass}`}
                                            aria-hidden
                                          />
                                          <div
                                            className={`${clTotalPriceFieldClass} ${clScopeTotalPriceColClass}`}
                                            aria-hidden
                                          />
                                          <div
                                            className={`${clNotesCellClass} ${clScopeNotesColClass}`}
                                            aria-hidden
                                          />
                                          <div
                                            className={`${clCalculatorCellClass} ${clScopeCalculatorColClass}`}
                                            aria-hidden
                                          />
                                          <div
                                            className={`${clActionsCellClass} ${clScopeActionsColClass}`}
                                            aria-hidden
                                          />
                                        </div>
                                          </div>
                                        ) : (
                                          <div id={scopeSkuBodyId} hidden />
                                        )}
                                      </div>
                                    ) : (
                                    scopeLines.map((lineRow, lineIdx) => {
                                        const isFirstRow = lineIdx === 0;
                                        const showObjectNameHeader = scopeLineShowsObjectNameHeader(
                                          scopeLines,
                                          lineIdx,
                                        );
                                        const lineSaving = rowSavingId === lineRow.id;
                                        const qObj = quoteObjectForScopeLine(
                                          lineRow,
                                          scope,
                                          quoteObjects,
                                        );
                                        const scopeInheritMeasureSource =
                                          resolveScopeLineInheritMeasureSource(
                                            lineRow,
                                            scope,
                                            quoteObjects,
                                          );
                                        const scopeInheritMeasureLocked =
                                          resolveScopeLineInheritMeasureLocked(
                                            lineRow,
                                            scope,
                                            quoteObjects,
                                          );
                                        const lineScopeMeasureExtras = {
                                          ...scopeMeasureExtras,
                                          inheritMeasureLocked: scopeInheritMeasureLocked,
                                        };
                                        const measureKey =
                                          lineRow.custommeasure != null &&
                                          !checklistMeasureLockedByScopeMetric(
                                            scopeInheritMeasureSource,
                                            scopeInheritMeasureLocked,
                                          )
                                            ? inputKey(lineRow, "scope-m")
                                            : `${inputKey(lineRow, "scope-m")}-ctx-${pa.aream2 ?? ""}-${project?.projectm2 ?? ""}-${project?.projectm2soft ?? ""}-${project?.projectm2hard ?? ""}-${scopeMetricMeasureKey}-${scopeInheritMeasureSource ?? ""}-${lineRow.skuId ?? ""}`;
                                        const effectiveMeasureForPrice =
                                          checklistInheritedMeasureForRow(
                                            lineRow,
                                            qObj,
                                            pa,
                                            project,
                                            scopeInheritMeasureSource,
                                            lineScopeMeasureExtras,
                                          );
                                        const unitPriceForDisplay = resolveScopeLineSkuUnitPriceExcGst(
                                          lineRow,
                                          suppliersBySkuId,
                                          supplierDiscountByKey,
                                        );
                                        const scopeBundledRows =
                                          bundledByParentId.get(lineRow.id) ?? [];
                                        const skuBodyVisible =
                                          scopeBodyExpanded ||
                                          clScopeLineHasPositiveQuantity(
                                            lineRow,
                                            effectiveMeasureForPrice,
                                          );
                                        if (!isFirstRow && !skuBodyVisible) return null;
                                        return (
                                          <Fragment key={lineRow.id}>
                                          <div
                                            className={
                                              lineIdx > 0
                                                ? `${clScopeLineStackClass} mt-2`
                                                : clScopeLineStackClass
                                            }
                                          >
                                            {isFirstRow ? (
                                              <ClScopeQuestionHeader
                                                scopeLabel={scope.question}
                                                busy={busy}
                                                canCloneScope={canCloneScope}
                                                onAddObject={() =>
                                                  openPickObjectModal(pa, {
                                                    scopeDocId: scope.id,
                                                    scopeInstanceId,
                                                    answerid: value || null,
                                                    scopeLabel: scope.question,
                                                  })
                                                }
                                                onClone={() =>
                                                  void cloneScopeInstance(
                                                    pa,
                                                    scope.id,
                                                    scopeInstanceId,
                                                  )
                                                }
                                              >
                                                {isFirstRow && usesBlindsAnswer && blindsLine ? (
                                                  <ClScopeQuestionLabel
                                                    question={scope.question}
                                                    explanation={scope.explanation}
                                                  />
                                                ) : null}
                                                <div
                                                  className={
                                                    isFirstRow && usesBlindsAnswer && blindsLine
                                                      ? clScopeQuestionAnswerGroupBlindsClass
                                                      : clScopeQuestionAnswerGroupClass
                                                  }
                                                >
                                                  {!(isFirstRow && usesBlindsAnswer && blindsLine) ? (
                                                    <ClScopeQuestionLabel
                                                      question={scope.question}
                                                      explanation={scope.explanation}
                                                    />
                                                  ) : null}
                                                  <label
                                                    className={clAnswerInlineFieldClass}
                                                    style={yesOnlyId ? undefined : answerWidthStyle}
                                                  >
                                                    {isFirstRow && usesBlindsAnswer && blindsLine ? (
                                                      <span className={clInlineFieldLabelClass}>
                                                        Answer
                                                      </span>
                                                    ) : null}
                                                    {yesOnlyId ? (
                                                      <span className="flex h-[2.125rem] items-center gap-1.5">
                                                        <input
                                                          type="checkbox"
                                                          className="size-4 shrink-0 rounded border-sf-border-strong accent-green-600 focus:ring-2 focus:ring-green-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-500"
                                                          disabled={busy || !yesAvailable}
                                                          checked={value === yesOnlyId}
                                                          onChange={(e) => {
                                                            clearForceNaAlert(pa.id, scope.id);
                                                            void applyScopeAnswer(
                                                              pa,
                                                              scope.id,
                                                              e.target.checked ? yesOnlyId : null,
                                                              scopeInstanceId,
                                                            );
                                                          }}
                                                          aria-label={`Yes — ${scope.question}`}
                                                        />
                                                        {showForceNaTag ? (
                                                          <span
                                                            className="rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-900 dark:bg-red-900/60 dark:text-red-100"
                                                            title="Previous answer cleared — no matching SKUs at current tier/style/colour"
                                                          >
                                                            N/A
                                                          </span>
                                                        ) : null}
                                                      </span>
                                                    ) : (
                                                      <span className="flex min-w-0 items-center gap-1.5">
                                                        <select
                                                          aria-label={`Answer for: ${scope.question}`}
                                                          className={clAnswerSelectBase}
                                                          style={answerWidthStyle}
                                                          disabled={busy}
                                                          value={value}
                                                          onChange={(e) => {
                                                            clearForceNaAlert(pa.id, scope.id);
                                                            const v = e.target.value;
                                                            void applyScopeAnswer(
                                                              pa,
                                                              scope.id,
                                                              v === "" ? null : v,
                                                              scopeInstanceId,
                                                            );
                                                          }}
                                                        >
                                                          <option value="">{"\u00A0"}</option>
                                                          {scope.answers.map((a) => {
                                                            const available =
                                                              answerAvailability.get(a.answerid) ??
                                                              true;
                                                            return (
                                                              <option
                                                                key={a.answerid}
                                                                value={a.answerid}
                                                                disabled={!available}
                                                              >
                                                                {a.label}
                                                              </option>
                                                            );
                                                          })}
                                                        </select>
                                                        {showForceNaTag ? (
                                                          <span
                                                            className="shrink-0 rounded bg-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-900 dark:bg-red-900/60 dark:text-red-100"
                                                            title="Previous answer cleared — no matching SKUs at current tier/style/colour"
                                                          >
                                                            N/A
                                                          </span>
                                                        ) : null}
                                                      </span>
                                                    )}
                                                    {busy ? (
                                                      <span className="text-[10px] text-sf-text-weak">
                                                        Updating…
                                                      </span>
                                                    ) : null}
                                                  </label>
                                                  <ClScopeCollapseButton
                                                    expanded={scopeBodyExpanded}
                                                    onToggle={() =>
                                                      toggleClScopeBodyExpanded(scopeBodyKey)
                                                    }
                                                    controlsId={scopeSkuBodyId}
                                                    label={scope.question}
                                                  />
                                                  <ScopeToolAfterAnswer
                                                    scope={scope}
                                                    answered={Boolean(value)}
                                                    disabled={busy}
                                                  />
                                                  {isFirstRow && usesBlindsAnswer && blindsLine ? (
                                                    <BlindsScopeFields
                                                      line={blindsLine}
                                                      blindsRows={blindsData}
                                                      disabled={
                                                        busy ||
                                                        lineSaving ||
                                                        rowSavingId === blindsLine.id
                                                      }
                                                      selectClassName={`${clAnswerInput} text-xs`}
                                                      dropWidthSelectClassName={`${clBlindsDropWidthInput} text-xs`}
                                                      showSkuSummary={false}
                                                      onPatch={(patch) =>
                                                        void patchLineItem(blindsLine.id, patch)
                                                      }
                                                    />
                                                  ) : null}
                                                </div>
                                                {isExtraScope ? (
                                                  <button
                                                    type="button"
                                                    className="shrink-0 rounded-full px-1.5 py-0.5 text-xs text-sf-text-weak hover:bg-sf-page hover:text-sf-text dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                                                    title="Remove this added scope from this area only"
                                                    aria-label={`Remove added scope: ${scope.question}`}
                                                    onClick={() =>
                                                      void removeExtraScopeFromArea(pa, scope.id)
                                                    }
                                                  >
                                                    ×
                                                  </button>
                                                ) : null}
                                              </ClScopeQuestionHeader>
                                            ) : null}
                                            {isFirstRow && activeScopeMetrics.length > 0 ? (
                                              <ScopeChecklistMetricsRow
                                                pa={pa}
                                                scopeDocId={scope.id}
                                                scopeInstanceId={scopeInstanceId}
                                                metrics={activeScopeMetrics}
                                                disabled={busy}
                                                onProjectAreaUpdated={(updatedPa) => {
                                                  setProjectAreas((prev) =>
                                                    prev.map((p) =>
                                                      p.id === updatedPa.id ? updatedPa : p,
                                                    ),
                                                  );
                                                  void reloadLineItems();
                                                }}
                                                onError={setError}
                                              />
                                            ) : null}
                                            {isFirstRow && skuBodyVisible ? (
                                              <div
                                                className={clScopeQuestionSkuDividerClass}
                                                role="separator"
                                                aria-hidden
                                              />
                                            ) : null}
                                            {isFirstRow && !skuBodyVisible ? (
                                              <div id={scopeSkuBodyId} hidden />
                                            ) : null}
                                            {skuBodyVisible ? (
                                              <>
                                            {showObjectNameHeader ? (
                                              <div className={clObjectNameRowClass}>
                                                <span
                                                  className={clObjectNameTextClass}
                                                  title={objectLabel(lineRow, quoteObjects)}
                                                >
                                                  {objectLabel(lineRow, quoteObjects)}
                                                </span>
                                              </div>
                                            ) : null}
                                            <div
                                              id={isFirstRow ? scopeSkuBodyId : undefined}
                                              className={clFieldsGridClass}
                                              style={clFieldsGridStyle}
                                            >
                                            <div
                                              className={`${clSkuFieldClass} ${clScopeSkuColClass}`}
                                            >
                                              <ClSkuPickerSlot
                                                showAdditionalPrompt={qObj?.promptForMulti === true}
                                                additionalObjectName={objectLabel(
                                                  lineRow,
                                                  quoteObjects,
                                                )}
                                                additionalDisabled={
                                                  lineSaving || wbCloningLineId === lineRow.id
                                                }
                                                onAdditional={() => void cloneLineItem(lineRow.id)}
                                              >
                                                {isLabourChecklistLine(lineRow, quoteObjects) ? (
                                                  <ClLabourProductDisplay
                                                    label={labourChecklistProductLabel(
                                                      lineRow,
                                                      quoteObjects,
                                                    )}
                                                    inputClassName={clSkuInput}
                                                  />
                                                ) : isBlindsSystemLine(lineRow) ? (
                                                  <div
                                                    className={`${clSkuInput} flex h-full items-center bg-sf-page dark:bg-zinc-900`}
                                                    title={blindsSkuDisplayLabel(lineRow)}
                                                  >
                                                    {blindsSkuDisplayLabel(lineRow)}
                                                  </div>
                                                ) : (
                                                <ScopeLineSkuPicker
                                                line={lineRow}
                                                quoteObject={qObj}
                                                catalogSkus={catalogSkus}
                                                suppliersBySkuId={suppliersBySkuId}
                                                priceLevels={priceLevels}
                                                cascades={cascades}
                                                pa={pa}
                                                project={project}
                                                disabled={lineSaving}
                                                selectClassName={clSkuInput}
                                                variant="compact"
                                                showSupplierPrice={false}
                                                shortMatchLabels
                                                inlineRow
                                                autoApplySingleMatch
                                                syncUnitPriceFromPick
                                                lockToSkuId={
                                                  lineRow.scopeShowAllSku ? lineRow.skuId : null
                                                }
                                                colourLookupIndex={colourLookupIndex}
                                                onSelectSku={(pick) => {
                                                  void applyLineSkuSelection(lineRow, pa, pick);
                                                }}
                                              />
                                                )}
                                              </ClSkuPickerSlot>
                                            </div>
                                            <label className={`${clMeasureFieldClass} ${clScopeMeasureColClass}`}>
                                              <span className={wbHdrLabel}>Measure</span>
                                              <ChecklistMeasureInput
                                                line={lineRow}
                                                quoteObject={qObj}
                                                pa={pa}
                                                project={project}
                                                scopeInheritMeasureSource={scopeInheritMeasureSource}
                                                scopeMeasureExtras={lineScopeMeasureExtras}
                                                measureKey={measureKey}
                                                inputClassName={clMeasureInput}
                                                disabled={lineSaving}
                                                ynMeasureDropdown
                                                onPatch={(custommeasure) => {
                                                  void patchLineItem(lineRow.id, { custommeasure });
                                                }}
                                                onValidationError={setError}
                                              />
                                            </label>
                                            <label className={`${clUomFieldClass} ${clScopeUomColClass}`}>
                                              <span className={wbHdrLabel}>UOM</span>
                                              <input
                                                key={inputKey(lineRow, "scope-u")}
                                                type="text"
                                                className={clUomInput}
                                                defaultValue={lineRow.customuom}
                                                disabled={lineSaving}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter")
                                                    (e.target as HTMLInputElement).blur();
                                                }}
                                                onBlur={(e) => {
                                                  const next = e.target.value;
                                                  if (next === lineRow.customuom) return;
                                                  void patchLineItem(lineRow.id, {
                                                    customuom: next,
                                                  });
                                                }}
                                              />
                                            </label>
                                            <div className={`${clNonStdCellClass} ${clScopeNonStdColClass}`}>
                                              <ClNonStdTierOpenButton
                                                compact
                                                active={hasClNonStandardTierStyleColour(lineRow)}
                                                disabled={lineSaving}
                                                label={objectLabel(lineRow, quoteObjects)}
                                                onOpen={() =>
                                                  setClNonStdModal({
                                                    kind: "line",
                                                    lineId: lineRow.id,
                                                    label: objectLabel(lineRow, quoteObjects),
                                                  })
                                                }
                                              />
                                            </div>
                                            <ClTotalPriceCell
                                              line={lineRow}
                                              marginPct={marginPct}
                                              effectiveMeasure={effectiveMeasureForPrice}
                                              unitPriceFallback={unitPriceForDisplay}
                                              preferEffectiveMeasure={checklistMeasureLockedByScopeMetric(
                                                scopeInheritMeasureSource,
                                                scopeInheritMeasureLocked,
                                              )}
                                              contractLabourRates={contractLabourRates}
                                            />
                                            <div className={`${clNotesCellClass} ${clScopeNotesColClass}`}>
                                              {renderProjectNotesButton(
                                                {
                                                  projectid: lineRow.projectid,
                                                  areaid: lineRow.areaid,
                                                  objectid: lineRow.objectid,
                                                },
                                                objectLabel(lineRow, quoteObjects),
                                                { compact: true, disabled: lineSaving },
                                              )}
                                            </div>
                                            <div className={`${clCalculatorCellClass} ${clScopeCalculatorColClass}`}>
                                              <ScopeLineMeasureTool
                                                scope={scope}
                                                line={lineRow}
                                                quoteObjects={quoteObjects}
                                                objectLabel={objectLabel(lineRow, quoteObjects)}
                                                disabled={lineSaving}
                                                onApplyMeasure={(payload) => {
                                                  void patchLineItem(lineRow.id, {
                                                    custommeasure: payload.m2,
                                                    ...(payload.scopeToolBenchSections !== undefined
                                                      ? {
                                                          scopeToolBenchSections:
                                                            payload.scopeToolBenchSections,
                                                        }
                                                      : {}),
                                                    ...(payload.scopeToolWallMm !== undefined
                                                      ? { scopeToolWallMm: payload.scopeToolWallMm }
                                                      : {}),
                                                  });
                                                }}
                                              />
                                            </div>
                                            <div className={`${clActionsCellClass} ${clScopeActionsColClass}`}>
                                              <ClLineRowMenu
                                                lineLabel={objectLabel(lineRow, quoteObjects)}
                                                disabled={
                                                  lineSaving || wbCloningLineId === lineRow.id
                                                }
                                                onClone={() => void cloneLineItem(lineRow.id)}
                                              />
                                            </div>
                                            </div>
                                              </>
                                            ) : null}
                                          </div>
                                          {skuBodyVisible && scopeBundledRows.length > 0 ? (
                                            <ScopeLineBundledChildren
                                              mode="checklist"
                                              parentLine={lineRow}
                                              bundledLines={scopeBundledRows}
                                              quoteObjects={quoteObjects}
                                              catalogSkus={catalogSkus}
                                              suppliersBySkuId={suppliersBySkuId}
                                              priceLevels={priceLevels}
                                              cascades={cascades}
                                              pa={pa}
                                              project={project}
                                              rowSavingId={rowSavingId}
                                              clSkuInput={clSkuInput}
                                              clMeasureInput={clMeasureInput}
                                              clUomInput={clUomInput}
                                              inputKey={inputKey}
                                              objectLabel={objectLabel}
                                              onPatchLine={(id, body) => {
                                                void patchLineItem(id, body);
                                              }}
                                              onValidationError={setError}
                                              marginPct={marginPct}
                                              colourLookupIndex={colourLookupIndex}
                                              contractLabourRates={contractLabourRates}
                                            />
                                          ) : null}
                                          </Fragment>
                                        );
                                      })
                                    )}
                                    <div className="mt-2 flex justify-end px-3">
                                      <ClScopeActionsMenu
                                        scopeLabel={scope.question}
                                        disabled={busy}
                                        onAddObject={() =>
                                          openPickObjectModal(pa, {
                                            scopeDocId: scope.id,
                                            scopeInstanceId,
                                            answerid: value || null,
                                            scopeLabel: scope.question,
                                          })
                                        }
                                        onClone={
                                          canCloneScope
                                            ? () =>
                                                void cloneScopeInstance(
                                                  pa,
                                                  scope.id,
                                                  scopeInstanceId,
                                                )
                                            : undefined
                                        }
                                      />
                                    </div>
                                  </li>
                                );
                              });
                              })}
                            </ul>
                          ) : (
                            <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                              No scope questions for this template area. Add them under{" "}
                              <span className="font-medium">Setup → Scopes</span>, or use the area{" "}
                              <span className="font-medium">…</span> menu to attach a question
                              from any setup area.
                            </p>
                          )}
                          {redundantScopeEntries.length > 0 ? (
                            <div className="mt-3 space-y-2 border-t border-amber-200/80 pt-3 dark:border-amber-900/50">
                              <h5 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                                Redundant scope questions
                              </h5>
                              <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                                Also listed at project level above. Remove clears answers, scope
                                lines, bundled children, metrics, and stale extra-scope links for
                                this area.
                              </p>
                              <ul className="flex w-full flex-col items-start space-y-2">
                                {redundantScopeEntries.map((entry) => {
                                  const busy = scopeAnswerSaving === entry.scopeDocId;
                                  const detailParts = redundantScopeDetailParts(entry);
                                  return (
                                    <li
                                      key={`redundant:${entry.scopeDocId}`}
                                      className="flex w-full flex-wrap items-center gap-2 rounded-md border border-amber-200/90 bg-amber-50/70 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/25"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <span className="text-sm font-medium text-sf-text dark:text-zinc-100">
                                          {entry.questionLabel}
                                        </span>
                                        {detailParts.length > 0 ? (
                                          <span className="mt-0.5 block text-xs text-sf-text-secondary dark:text-zinc-400">
                                            {detailParts.join(" · ")}
                                          </span>
                                        ) : null}
                                      </div>
                                      <button
                                        type="button"
                                        className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
                                        disabled={busy || areaBusy}
                                        onClick={() =>
                                          void purgeRedundantScopeFromArea(pa, entry.scopeDocId)
                                        }
                                      >
                                        {busy ? "Removing…" : "Remove"}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                          {(() => {
                            const nonScopeLines = rows.filter(
                              (r) => r.linesource !== "scope" && r.linesource !== "bundled",
                            );

                            return nonScopeLines.length > 0 ? (
                              <div className="space-y-3 border-t border-sf-border pt-3 dark:border-zinc-700">
                                <div className="w-full space-y-2">
                                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-300">
                                    Lines (manual / seeded)
                                  </span>
                                  {nonScopeLines.map((lineRow) => {
                                    const lineSaving = rowSavingId === lineRow.id;
                                    const qObj = quoteObjects.find(
                                      (o) => o.objectid === lineRow.objectid,
                                    );
                                    const measureKey =
                                      lineRow.custommeasure != null
                                        ? inputKey(lineRow, "manual-m")
                                        : `${inputKey(lineRow, "manual-m")}-ctx-${pa.aream2 ?? ""}-${project?.projectm2 ?? ""}-${project?.projectm2soft ?? ""}-${project?.projectm2hard ?? ""}`;
                                    const manualBundledRows =
                                      bundledByParentId.get(lineRow.id) ?? [];
                                    return (
                                      <Fragment key={lineRow.id}>
                                      <div
                                        className={`${clScopeLineStackClass} rounded-md border border-sf-border bg-sf-page py-2 dark:border-zinc-700 dark:bg-zinc-900/40`}
                                      >
                                        <div className={clObjectNameRowClass}>
                                          <span
                                            className={clObjectNameTextClass}
                                            title={objectLabel(lineRow, quoteObjects)}
                                          >
                                            {objectLabel(lineRow, quoteObjects)}
                                          </span>
                                          {lineRow.linesource !== "manual" ? (
                                            <span className="ml-2 shrink-0 truncate text-xs leading-tight text-sf-text-weak dark:text-zinc-400">
                                              {lineSourceLabel(lineRow)}
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className={clFieldsGridClass} style={clFieldsGridStyle}>
                                        <div className={`${clSkuFieldClass} ${clScopeSkuColClass}`}>
                                          <ClSkuPickerSlot
                                            showAdditionalPrompt={qObj?.promptForMulti === true}
                                            additionalObjectName={objectLabel(
                                              lineRow,
                                              quoteObjects,
                                            )}
                                            additionalDisabled={
                                              lineSaving ||
                                              paoDeleting ||
                                              wbCloningLineId === lineRow.id
                                            }
                                            onAdditional={() => void cloneLineItem(lineRow.id)}
                                          >
                                            {isLabourChecklistLine(lineRow, quoteObjects) ? (
                                              <ClLabourProductDisplay
                                                label={labourChecklistProductLabel(
                                                  lineRow,
                                                  quoteObjects,
                                                )}
                                                inputClassName={clSkuInput}
                                              />
                                            ) : (
                                            <ScopeLineSkuPicker
                                              line={lineRow}
                                              quoteObject={qObj}
                                              catalogSkus={catalogSkus}
                                              suppliersBySkuId={suppliersBySkuId}
                                              priceLevels={priceLevels}
                                              cascades={cascades}
                                              pa={pa}
                                              project={project}
                                              disabled={lineSaving}
                                              selectClassName={clSkuInput}
                                              variant="compact"
                                              showSupplierPrice={false}
                                              shortMatchLabels
                                              inlineRow
                                              autoApplySingleMatch
                                              syncUnitPriceFromPick
                                              lockToSkuId={
                                                lineRow.scopeShowAllSku ? lineRow.skuId : null
                                              }
                                              colourLookupIndex={colourLookupIndex}
                                              onSelectSku={(pick) => {
                                                void applyLineSkuSelection(lineRow, pa, pick);
                                              }}
                                            />
                                            )}
                                          </ClSkuPickerSlot>
                                        </div>
                                        <label className={`${clMeasureFieldClass} ${clScopeMeasureColClass}`}>
                                          <span className={wbHdrLabel}>Measure</span>
                                          <ChecklistMeasureInput
                                            line={lineRow}
                                            quoteObject={qObj}
                                            pa={pa}
                                            project={project}
                                            scopeMeasureExtras={{ catalogSkus }}
                                            measureKey={measureKey}
                                            inputClassName={clMeasureInput}
                                            disabled={lineSaving}
                                            ynMeasureDropdown
                                            onPatch={(custommeasure) => {
                                              void patchLineItem(lineRow.id, { custommeasure });
                                            }}
                                            onValidationError={setError}
                                          />
                                        </label>
                                        <label className={`${clUomFieldClass} ${clScopeUomColClass}`}>
                                          <span className={wbHdrLabel}>UOM</span>
                                          <input
                                            key={inputKey(lineRow, "manual-u")}
                                            type="text"
                                            className={clUomInput}
                                            defaultValue={lineRow.customuom}
                                            disabled={lineSaving}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                (e.target as HTMLInputElement).blur();
                                            }}
                                            onBlur={(e) => {
                                              const next = e.target.value;
                                              if (next === lineRow.customuom) return;
                                              void patchLineItem(lineRow.id, {
                                                customuom: next,
                                              });
                                            }}
                                          />
                                        </label>
                                        <div className={`${clNonStdCellClass} ${clScopeNonStdColClass}`} aria-hidden />
                                        <ClTotalPriceCell
                                          line={lineRow}
                                          marginPct={marginPct}
                                          contractLabourRates={contractLabourRates}
                                        />
                                        <div className={`${clNotesCellClass} ${clScopeNotesColClass}`}>
                                          {renderProjectNotesButton(
                                            {
                                              projectid: lineRow.projectid,
                                              areaid: lineRow.areaid,
                                              objectid: lineRow.objectid,
                                            },
                                            objectLabel(lineRow, quoteObjects),
                                            { compact: true, disabled: lineSaving || paoDeleting },
                                          )}
                                        </div>
                                        <div className={`${clCalculatorCellClass} ${clScopeCalculatorColClass}`}>
                                          <ScopeLineMeasureTool
                                            line={lineRow}
                                            quoteObjects={quoteObjects}
                                            objectLabel={objectLabel(lineRow, quoteObjects)}
                                            disabled={lineSaving}
                                            onApplyMeasure={(payload) => {
                                              void patchLineItem(lineRow.id, {
                                                custommeasure: payload.m2,
                                                ...(payload.scopeToolBenchSections !== undefined
                                                  ? {
                                                      scopeToolBenchSections:
                                                        payload.scopeToolBenchSections,
                                                    }
                                                  : {}),
                                                ...(payload.scopeToolWallMm !== undefined
                                                  ? { scopeToolWallMm: payload.scopeToolWallMm }
                                                  : {}),
                                              });
                                            }}
                                          />
                                        </div>
                                        <div className={`${clActionsCellClass} ${clScopeActionsColClass}`}>
                                          <button
                                            type="button"
                                            onClick={() => setPaoDeleteId(lineRow.id)}
                                            disabled={lineSaving || paoDeleting}
                                            className={sfRowIconBtnDanger}
                                            aria-label={`Remove ${objectLabel(lineRow, quoteObjects)}`}
                                            title="Remove line"
                                          >
                                            <IconTrash className="h-4 w-4" />
                                          </button>
                                          <ClLineRowMenu
                                            lineLabel={objectLabel(lineRow, quoteObjects)}
                                            disabled={
                                              lineSaving ||
                                              paoDeleting ||
                                              wbCloningLineId === lineRow.id
                                            }
                                            onClone={() => void cloneLineItem(lineRow.id)}
                                          />
                                        </div>
                                        </div>
                                      </div>
                                      {manualBundledRows.length > 0 ? (
                                        <ScopeLineBundledChildren
                                          mode="checklist"
                                          parentLine={lineRow}
                                          bundledLines={manualBundledRows}
                                          quoteObjects={quoteObjects}
                                          catalogSkus={catalogSkus}
                                          suppliersBySkuId={suppliersBySkuId}
                                          priceLevels={priceLevels}
                                          cascades={cascades}
                                          pa={pa}
                                          project={project}
                                          rowSavingId={rowSavingId}
                                          clSkuInput={clSkuInput}
                                          clMeasureInput={clMeasureInput}
                                          clUomInput={clUomInput}
                                          inputKey={inputKey}
                                          objectLabel={objectLabel}
                                          onPatchLine={(id, body) => {
                                            void patchLineItem(id, body);
                                          }}
                                          onValidationError={setError}
                                          marginPct={marginPct}
                                          colourLookupIndex={colourLookupIndex}
                                          contractLabourRates={contractLabourRates}
                                        />
                                      ) : null}
                                      </Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null;
                          })()}

                          <div className="border-t border-sf-border pt-3 dark:border-zinc-700">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-300">
                                Area questions
                              </span>
                              <span className="text-[11px] text-sf-text-weak dark:text-zinc-400">
                                Saved per area instance
                              </span>
                            </div>
                            {areaAnswers.length === 0 ? (
                              <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                                No area questions for this template.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {areaAnswers.map((a) => {
                                  const tradeLabel = (a.applicableTradesSnapshot ?? [])
                                    .map((t) => t.lookupvalue)
                                    .filter(Boolean)
                                    .join(", ");
                                  const busy = answerSavingId === a.id;
                                  return (
                                    <div key={a.id} className="space-y-1">
                                      <div className="text-[11px] font-medium text-sf-text-secondary dark:text-zinc-300">
                                        {tradeLabel ? `${tradeLabel}: ` : ""}
                                        <span className="text-sf-text dark:text-zinc-100">
                                          {a.questionTextSnapshot}
                                        </span>
                                        {busy ? (
                                          <span className="ml-2 text-[10px] text-sf-text-weak">
                                            Saving…
                                          </span>
                                        ) : null}
                                      </div>
                                      <textarea
                                        key={`${a.id}-${a.updatedAt ?? ""}`}
                                        className={wbAreaFieldTextarea}
                                        rows={3}
                                        defaultValue={a.answer ?? ""}
                                        disabled={busy}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && e.ctrlKey)
                                            (e.target as HTMLTextAreaElement).blur();
                                        }}
                                        onBlur={(e) => {
                                          const next = e.target.value;
                                          if (next === (a.answer ?? "")) return;
                                          void patchProjectAreaAnswer(a.id, { answer: next });
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          </div>
                          </div>
                        </td>
                      </tr>
                      </>
                    ) : null}
                    {mode !== "checklist" ? (
                      <>
                        {areaIndex > 0 ? (
                          <tr aria-hidden>
                            <td colSpan={wbTableCols} className={wbAreaGapCell} />
                          </tr>
                        ) : null}
                        <tr className={wbAreaHdrBand}>
                      <td
                        colSpan={wbTableCols}
                        className={`border border-sf-border px-5 py-3 align-top dark:border-zinc-700`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                          {/* Left: area identity + controls */}
                          <div className="flex min-w-0 flex-col gap-3">
                            <div className={wbAreaHdrFieldsRow}>
                              <div className="flex shrink-0 items-end gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className={`${wbHdrLabel} whitespace-nowrap`}>
                                    Area
                                  </span>
                                  <span
                                    className="text-lg font-bold leading-tight text-sf-brand dark:text-zinc-50"
                                    title={projectAreaHeading(pa, areas)}
                                  >
                                    {projectAreaHeading(pa, areas)}
                                  </span>
                                </div>
                                {renderProjectNotesButton(
                                  { projectid: pa.projectid, areaid: pa.areaid },
                                  projectAreaHeading(pa, areas),
                                  {
                                    size: "workbench",
                                    disabled: areaBusy,
                                    projectAreaDocId: pa.id,
                                  },
                                )}
                                <div className="flex items-end pb-0.5">
                                  <WbAreaHdrMenu
                                    areaLabel={projectAreaHeading(pa, areas)}
                                    addObjectDisabled={
                                      areaBusy ||
                                      paDeleting ||
                                      wbBlankLineContext?.paId === pa.id
                                    }
                                    addBlankLineDisabled={
                                      areaBusy ||
                                      paDeleting ||
                                      wbBlankLineContext?.paId === pa.id ||
                                      wbBlankLineSaving
                                    }
                                    removeDisabled={areaBusy || paDeleting}
                                    onAddObject={() => openPickObjectModal(pa)}
                                    onAddBlankLine={() => openWbBlankLineFromArea(pa)}
                                    onRemove={() => setPaDeleteId(pa.id)}
                                  />
                                </div>
                              </div>
                              <label className="flex shrink-0 flex-col gap-0.5">
                                <span className={`${wbHdrLabel} whitespace-nowrap`}>
                                  Area m²
                                </span>
                                <input
                                  key={areaFieldKey(pa, "m2")}
                                  type="text"
                                  inputMode="decimal"
                                  className={wbInputM2}
                                  defaultValue={pa.aream2 ?? ""}
                                  disabled={areaBusy}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      (e.target as HTMLInputElement).blur();
                                  }}
                                  onBlur={(e) => {
                                    const raw = e.target.value.trim();
                                    if (raw !== "" && parseOptionalNumber(raw) === null) {
                                      setError(
                                        "Area m² must be a valid number (or empty).",
                                      );
                                      e.target.value =
                                        pa.aream2 != null ? String(pa.aream2) : "";
                                      return;
                                    }
                                    const next = parseOptionalNumber(raw);
                                    const prev = pa.aream2 ?? null;
                                    if (next === prev) return;
                                    void patchProjectArea(pa.id, { aream2: next });
                                  }}
                                />
                              </label>
                              <ProjectAreaM2Calculator
                                pa={pa}
                                areaLabel={projectAreaHeading(pa, areas)}
                                disabled={areaBusy}
                                labelClassName={wbHdrLabel}
                                onApply={(body) => void patchProjectArea(pa.id, body)}
                              />
                              <ProjectAreaCeilingHeightField
                                pa={pa}
                                project={project}
                                disabled={areaBusy}
                                labelClassName={`${wbHdrLabel} whitespace-nowrap`}
                                inputClassName={wbAreaHdrInputCeiling}
                                fieldKey={areaFieldKey(pa, "ceiling")}
                                onPatch={(body) => void patchProjectArea(pa.id, body)}
                                onValidationError={setError}
                              />
                              <ProjectAreaStatusSelect
                                value={pa.areaStatus}
                                disabled={areaBusy}
                                labelClassName={`${wbHdrLabel} whitespace-nowrap`}
                                selectClassName={wbAreaHdrSelectStatus}
                                onChange={(next) =>
                                  handleAreaStatusChange(
                                    pa,
                                    next,
                                    projectAreaHeading(pa, areas),
                                  )
                                }
                              />
                            </div>
                            <div className={wbAreaHdrFieldsRow}>
                              <label className="flex w-fit shrink-0 flex-col gap-0.5">
                                <span className={`${wbHdrLabel} whitespace-nowrap`}>
                                  Elevate
                                </span>
                                <CascadeElevateSelect
                                  cascades={cascades}
                                  priceLevels={priceLevels}
                                  priceLevelId={pa.pricelevelid ?? null}
                                  projectFinish={project?.projectfinish}
                                  onChange={({ priceLevelId }) => {
                                    void patchProjectArea(pa.id, {
                                      pricelevelid: priceLevelId,
                                    });
                                  }}
                                  className={wbAreaHdrSelectElevate}
                                  disabled={areaBusy}
                                  emptyLabel="Default (project)"
                                />
                              </label>
                              <CascadeStyleColourFields
                                cascades={cascades}
                                level={cascadeLevelFromPriceLevel(
                                  priceLevels,
                                  pa.pricelevelid ?? project?.defaultpricelevelid,
                                  project?.projectfinish,
                                  cascades,
                                )}
                                style={pa.style ?? ""}
                                colourFilterStyle={effectiveCascadeStyleForArea(
                                  pa,
                                  project,
                                )}
                                colour={pa.colour ?? ""}
                                disabled={areaBusy}
                                styleSelectClassName={wbAreaHdrSelectStyle}
                                colourSelectClassName={wbAreaHdrSelectColour}
                                layout="compact"
                                compactField="style"
                                styleLabel="Style override"
                                colourLabel="Colour override"
                                styleEmptyLabel="Default (project)"
                                colourEmptyLabel={wbAreaColourEmptyLabel(project)}
                                onStyleChange={(v) =>
                                  void patchProjectArea(pa.id, {
                                    style: v ? v : null,
                                    colour: null,
                                  })
                                }
                                onColourChange={(v) =>
                                  void patchProjectArea(pa.id, {
                                    colour: v ? v : null,
                                  })
                                }
                              />
                              <CascadeStyleColourFields
                                cascades={cascades}
                                level={cascadeLevelFromPriceLevel(
                                  priceLevels,
                                  pa.pricelevelid ?? project?.defaultpricelevelid,
                                  project?.projectfinish,
                                  cascades,
                                )}
                                style={pa.style ?? ""}
                                colourFilterStyle={effectiveCascadeStyleForArea(
                                  pa,
                                  project,
                                )}
                                colour={pa.colour ?? ""}
                                disabled={areaBusy}
                                styleSelectClassName={wbAreaHdrSelectStyle}
                                colourSelectClassName={wbAreaHdrSelectColour}
                                layout="compact"
                                compactField="colour"
                                styleLabel="Style override"
                                colourLabel="Colour override"
                                styleEmptyLabel="Default (project)"
                                colourEmptyLabel={wbAreaColourEmptyLabel(project)}
                                onStyleChange={(v) =>
                                  void patchProjectArea(pa.id, {
                                    style: v ? v : null,
                                    colour: null,
                                  })
                                }
                                onColourChange={(v) =>
                                  void patchProjectArea(pa.id, {
                                    colour: v ? v : null,
                                  })
                                }
                              />
                            </div>
                            {wbScopeMetricEntries.length > 0 ? (
                              <ScopeWorkbenchMetricsRow
                                pa={pa}
                                entries={wbScopeMetricEntries}
                                disabled={areaBusy}
                                onProjectAreaUpdated={(updatedPa) => {
                                  setProjectAreas((prev) =>
                                    prev.map((p) =>
                                      p.id === updatedPa.id ? updatedPa : p,
                                    ),
                                  );
                                }}
                                onRepriced={() => void reloadLineItems()}
                                onError={setError}
                              />
                            ) : null}
                          </div>

                          {/* Right: trade tags + financial cards */}
                          <div className="mt-1 flex shrink-0 justify-end self-start">
                            <WbAreaSummary
                              lineSubTotal={areaMaterialTotal}
                              labourCostBySilo={areaLabourCostBySilo}
                              netTotal={hasIncludedMoney ? areaSubtotal : 0}
                              marginExcGst={
                                hasIncludedMoney ? areaRealisedMarginExcGst : null
                              }
                              finalTotal={hasIncludedMoney ? areaFinalSubtotal : 0}
                            />
                          </div>
                        </div>
                      </td>
                        </tr>
                        <tr className={areaObjectBand}>
                      <th scope="col" className={thBaseWb} title="Include in totals">
                        Incl.
                      </th>
                      <th scope="col" className={thBaseWb}>
                        Description
                      </th>
                      {wbDetailView ? (
                        <>
                      <th
                        scope="col"
                        className={thBaseWb}
                        title="How the line was added (seed, scope answer, or manual)"
                      >
                        Source
                      </th>
                      <th
                        scope="col"
                        className={thBaseWb}
                        title="Override template Elevate for this line; empty uses the area Elevate"
                      >
                        Elevate
                      </th>
                      <th scope="col" className={thBaseWb}>
                        Style
                      </th>
                      <th scope="col" className={thBaseWb}>
                        Colour
                      </th>
                        </>
                      ) : null}
                      <th
                        scope="col"
                        className={thBaseWb}
                        title="Matched catalog SKU and supplier price (scope lines)"
                      >
                        Product / SKU
                      </th>
                      <th scope="col" className={thBaseWb}>
                        Measure
                      </th>
                      <th scope="col" className={thBaseWb}>
                        UOM
                      </th>
                      <th scope="col" className={thBaseWb}>
                        Unit price
                      </th>
                      <th
                        scope="col"
                        className={thBaseWb}
                        title="Measure × unit price + labour on this line (before margin)"
                      >
                        Line total
                      </th>
                      {WB_WORKBENCH_LABOUR_SILO_HEADERS.map(({ key, label, title }) => (
                        <th key={key} scope="col" className={thBaseWb} title={title}>
                          {label}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className={thBaseWb}
                        title="Line total (material + labour) including project margin"
                      >
                        Final price
                      </th>
                      <th scope="col" className={thBaseWb} title="Supplier for the line SKU">
                        Supplier
                      </th>
                      <th scope="col" className={thBaseWb}>
                        Notes/Actions
                      </th>
                      <th scope="col" className={wbSpacerCell} aria-hidden />
                        </tr>
                        {areaTopLines.length === 0 ? (
                          <tr className={areaObjectBand}>
                            <td colSpan={wbTableCols} className={`${cellMuted} py-3 pl-8 text-xs`}>
                              <span className="italic text-sf-text-weak dark:text-zinc-400">
                                No objects in this area yet.{" "}
                              </span>
                              <button
                                type="button"
                                onClick={() => openPickObjectModal(pa)}
                                disabled={areaBusy}
                                className="font-medium text-sf-brand underline underline-offset-2 hover:text-sf-brand-hover dark:text-emerald-400"
                              >
                                Add object…
                              </button>
                            </td>
                          </tr>
                        ) : (
                          workbenchFlatDisplayLines(areaTopLines).flatMap(({ line: row, renderBundledAfter }) => {
                        const included = row.included !== false;
                        const blankLineSourceRowId = wbBlankLineContext?.afterLineId ?? null;
                        const rowDisabledForBlankLine = blankLineSourceRowId === row.id;
                        const saving =
                          rowSavingId === row.id || rowDisabledForBlankLine;
                        const rowStyle = included
                          ? rowDisabledForBlankLine
                            ? `${areaObjectBand} opacity-50`
                            : `${areaObjectBand} hover:bg-sf-accent-muted/70 dark:hover:bg-sf-accent/10`
                          : `${areaObjectBand} text-sf-text-weak opacity-60 dark:text-sf-text-weak`;
                        const lineScope = row.scopeDocId?.trim()
                          ? scopes.find((s) => s.id === row.scopeDocId?.trim())
                          : undefined;
                        const qObj = quoteObjectForScopeLine(row, lineScope, quoteObjects);
                        const scopeInheritMeasureSource =
                          row.linesource === "scope"
                            ? resolveScopeLineInheritMeasureSource(
                                row,
                                lineScope,
                                quoteObjects,
                              )
                            : undefined;
                        const scopeInheritMeasureLocked =
                          row.linesource === "scope"
                            ? resolveScopeLineInheritMeasureLocked(
                                row,
                                lineScope,
                                quoteObjects,
                              )
                            : false;
                        const scopeMetricValuesMap = scopeMetricValuesMapForInstance(
                          pa.scopeMetricValues,
                          row.scopeDocId?.trim() ?? "",
                          row.scopeInstanceId,
                        );
                        const scopeMeasureExtras =
                          row.linesource === "scope"
                            ? {
                                scopeMetrics: lineScope?.scopeMetrics,
                                scopeMetricValues: scopeMetricValuesMap,
                                catalogSkus,
                                inheritMeasureLocked: scopeInheritMeasureLocked,
                              }
                            : undefined;
                        const effectiveMeasureForRow =
                          row.linesource === "scope"
                            ? checklistInheritedMeasureForRow(
                                row,
                                qObj,
                                pa,
                                project,
                                scopeInheritMeasureSource,
                                scopeMeasureExtras,
                              )
                            : null;
                        const metricMeasureLocked = checklistMeasureLockedByScopeMetric(
                          scopeInheritMeasureSource,
                          scopeInheritMeasureLocked,
                        );
                        const unitPriceForRow = resolveScopeLineSkuUnitPriceExcGst(
                          row,
                          suppliersBySkuId,
                          supplierDiscountByKey,
                        );
                        const lfBreakdown = lineFinalPriceBreakdown(
                          row,
                          marginPct,
                          effectiveMeasureForRow,
                          unitPriceForRow,
                          metricMeasureLocked,
                          contractLabourRates,
                        );
                        const lineTotalExGst =
                          lfBreakdown?.baseExcGst ??
                          (metricMeasureLocked &&
                          effectiveMeasureForRow != null &&
                          unitPriceForRow != null
                            ? effectiveMeasureForRow * unitPriceForRow
                            : row.totalprice);
                        const lf = lfBreakdown?.finalExcGst ?? null;
                        const measureKey =
                          row.custommeasure != null && !metricMeasureLocked
                            ? inputKey(row, "m")
                            : `${inputKey(row, "m")}-ctx-${pa.aream2 ?? ""}-${project?.projectm2 ?? ""}-${project?.projectm2soft ?? ""}-${project?.projectm2hard ?? ""}-${Array.from(scopeMetricValuesMap.entries()).map(([k, v]) => `${k}:${v ?? ""}`).join("|")}-${scopeInheritMeasureSource ?? ""}`;
                        const bundledRows = bundledByParentId.get(row.id) ?? [];
                        if (
                          wbCompressed &&
                          !clScopeLineHasPositiveQuantity(row, effectiveMeasureForRow)
                        ) {
                          return [];
                        }
                        const bundledRowsForDisplay = wbCompressed
                          ? bundledRows.filter((child) =>
                              clScopeLineHasPositiveQuantity(child, null),
                            )
                          : bundledRows;

                        return [
                          <tr key={row.id} className={rowStyle}>
                            <td className={`${wbCellMid} text-center`}>
                              <input
                                type="checkbox"
                                checked={included}
                                disabled={saving}
                                aria-label={`Include “${objectLabel(row, quoteObjects)}” in cost totals`}
                                onChange={(e) => {
                                  void patchLineItem(row.id, { included: e.target.checked });
                                }}
                                className="size-4 cursor-pointer rounded border-sf-border-strong accent-green-600 focus:ring-2 focus:ring-green-500/40 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-500"
                                title={included ? "Included in totals" : "Excluded from totals"}
                              />
                            </td>
                            <td className={`${wbCellDesc} pl-1`}>
                              <div className="flex items-center gap-1">
                                <WbObjectName
                                  row={row}
                                  quoteObjects={quoteObjects}
                                  catalogSkus={catalogSkus}
                                  included={included}
                                />
                                {saving ? (
                                  <span className="shrink-0 text-[10px] text-zinc-400">…</span>
                                ) : null}
                              </div>
                              {row.tooltip?.trim() ? (
                                <p
                                  className="mt-1 text-[11px] leading-snug text-sf-text-weak dark:text-zinc-400"
                                  title={row.tooltip.trim()}
                                >
                                  {row.tooltip.trim()}
                                </p>
                              ) : null}
                            </td>
                            {wbDetailView ? (
                              <>
                            <td
                              className={`${wbCellMid} truncate text-xs font-medium text-sf-text-secondary dark:text-zinc-400`}
                            >
                              {lineSourceLabel(row)}
                            </td>
                            <td className={wbCellMid}>
                              <CascadeElevateSelect
                                cascades={cascades}
                                priceLevels={priceLevels}
                                priceLevelId={row.pricelevelid ?? null}
                                projectFinish={project?.projectfinish}
                                onChange={({ priceLevelId }) => {
                                  void patchLineItem(row.id, { pricelevelid: priceLevelId });
                                }}
                                className={wbSelectRow}
                                disabled={saving}
                                emptyLabel="Area default"
                              />
                            </td>
                            <td className={wbCellMid}>
                              <select
                                className={wbSelectRow}
                                disabled={saving}
                                value={row.style ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  void patchLineItem(row.id, {
                                    style: v ? v : null,
                                    colour: null,
                                  });
                                }}
                              >
                                <option value="">
                                  {`Area default${pa.style?.trim() ? ` · ${pa.style.trim()}` : project?.defaultstyle?.trim() ? ` · ${project.defaultstyle.trim()}` : ""}`}
                                </option>
                                {baseStyleOptions.out.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                                {(() => {
                                  const saved = (row.style ?? "").trim();
                                  if (!saved || baseStyleOptions.seen.has(saved)) return null;
                                  return <option value={saved}>{saved} (saved)</option>;
                                })()}
                              </select>
                            </td>
                            <td className={wbCellMid}>
                              <CascadeColourSelect
                                cascades={cascades}
                                level={cascadeLevelFromPriceLevel(
                                  priceLevels,
                                  row.pricelevelid ??
                                    pa.pricelevelid ??
                                    project?.defaultpricelevelid,
                                  project?.projectfinish,
                                  cascades,
                                )}
                                styleForFilter={effectiveCascadeStyleForLine(row, pa, project)}
                                colour={row.colour ?? ""}
                                disabled={saving}
                                selectClassName={wbSelectRow}
                                emptyLabel={wbLineColourEmptyLabel(pa, project)}
                                onColourChange={(v) =>
                                  void patchLineItem(row.id, { colour: v ? v : null })
                                }
                              />
                            </td>
                              </>
                            ) : null}
                            <td className={wbCellSku}>
                              {isManual2Line(row) ? (
                                <span
                                  className="block min-w-0 truncate text-xs font-normal text-sf-text dark:text-zinc-100"
                                  title={row.skuProduct?.trim() || undefined}
                                >
                                  {row.skuProduct?.trim() || "—"}
                                </span>
                              ) : isBlindsSystemLine(row) ? (
                                <BlindsWorkbenchSkuLink
                                  line={row}
                                  disabled={saving}
                                  onOpen={() => setWbBlindsEditLineId(row.id)}
                                />
                              ) : (() => {
                                if (!qObj) {
                                  return (
                                    <span className="text-xs text-sf-text-weak">—</span>
                                  );
                                }
                                return (
                                  <WbBuildingElementSkuCell
                                    line={row}
                                    catalogSkus={catalogSkus}
                                    buildingElementBySkuName={buildingElementBySkuName}
                                    paintingElementBySkuName={paintingElementBySkuName}
                                    disabled={saving}
                                    onOpenConsumption={setWbBuildingElementLineId}
                                    onOpenPaintingConsumption={setWbPaintingElementLineId}
                                  >
                                    <ScopeLineSkuPicker
                                      line={row}
                                      quoteObject={qObj}
                                      catalogSkus={catalogSkus}
                                      suppliersBySkuId={suppliersBySkuId}
                                      priceLevels={priceLevels}
                                      cascades={cascades}
                                      supplierDiscountByKey={supplierDiscountByKey}
                                      pa={pa}
                                      project={project}
                                      disabled={saving || wbBlankLineSaving}
                                      selectClassName={wbSelectRow}
                                      variant="compact"
                                      showSupplierPrice
                                      shortMatchLabels
                                      inlineRow
                                      skuPickerUi="popup"
                                      autoApplySingleMatch
                                      autoApplyOnlyWhenEmptySku
                                      syncUnitPriceFromPick
                                      lockToSkuId={row.scopeShowAllSku ? row.skuId : null}
                                      colourLookupIndex={colourLookupIndex}
                                      showIncludeAllSupplierOptions
                                      includeAllSupplierOptions={includeAllSuppliersForLine(
                                        row.id,
                                      )}
                                      onIncludeAllSupplierOptionsChange={(checked) =>
                                        setIncludeAllSuppliersForLine(row.id, checked)
                                      }
                                      showAddBlankLineOption
                                      onAddBlankLine={() => openWbBlankLineFromRow(pa, row, qObj)}
                                      onSelectSku={(pick) => {
                                        void applyLineSkuSelection(row, pa, pick);
                                      }}
                                    />
                                  </WbBuildingElementSkuCell>
                                );
                              })()}
                            </td>
                            <td className={wbCellMid}>
                              {row.linesource === "scope" && qObj ? (
                                <ChecklistMeasureInput
                                  line={row}
                                  quoteObject={qObj}
                                  pa={pa}
                                  project={project}
                                  scopeInheritMeasureSource={scopeInheritMeasureSource}
                                  scopeMeasureExtras={scopeMeasureExtras}
                                  measureKey={measureKey}
                                  inputClassName={wbInputMeasure}
                                  disabled={saving}
                                  onPatch={(custommeasure) => {
                                    void patchLineItem(row.id, { custommeasure });
                                  }}
                                  onValidationError={setError}
                                />
                              ) : (
                                <input
                                  key={inputKey(row, "m")}
                                  type="text"
                                  inputMode="decimal"
                                  className={wbInputMeasure}
                                  defaultValue={row.custommeasure ?? ""}
                                  disabled={saving}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  }}
                                  onBlur={(e) => {
                                    const raw = e.target.value.trim();
                                    if (raw !== "" && parseOptionalNumber(raw) === null) {
                                      setError("Measure must be a valid number (or empty).");
                                      e.target.value =
                                        row.custommeasure != null
                                          ? String(row.custommeasure)
                                          : "";
                                      return;
                                    }
                                    const next = parseOptionalNumber(raw);
                                    const prev = row.custommeasure ?? null;
                                    if (next === prev) return;
                                    void patchLineItem(row.id, { custommeasure: next });
                                  }}
                                />
                              )}
                            </td>
                            <td className={wbCellUom}>
                              <input
                                key={inputKey(row, "u")}
                                type="text"
                                className={wbSelectRow}
                                defaultValue={row.customuom}
                                disabled={saving}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                                onBlur={(e) => {
                                  const next = e.target.value;
                                  if (next === row.customuom) return;
                                  void patchLineItem(row.id, { customuom: next });
                                }}
                              />
                            </td>
                            <td className={wbCellNum}>
                              <input
                                key={inputKey(row, "p")}
                                type="text"
                                inputMode="decimal"
                                className={wbInputCurrency}
                                defaultValue={formatCurrencyInput(
                                  resolveScopeLineSkuUnitPriceExcGst(
                                    row,
                                    suppliersBySkuId,
                                    supplierDiscountByKey,
                                  ),
                                )}
                                disabled={saving}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                                onBlur={(e) => {
                                  const raw = e.target.value.trim();
                                  if (raw !== "" && parseCurrencyInput(raw) === null) {
                                    setError("Unit price must be a valid amount (or empty).");
                                    e.target.value = formatCurrencyInput(
                                      resolveScopeLineSkuUnitPriceExcGst(
                                    row,
                                    suppliersBySkuId,
                                    supplierDiscountByKey,
                                  ),
                                    );
                                    return;
                                  }
                                  const next = parseCurrencyInput(raw);
                                  const prev = row.customumprice ?? null;
                                  e.target.value = formatCurrencyInput(next);
                                  if (next === prev) return;
                                  void patchLineItem(row.id, { customumprice: next });
                                }}
                              />
                            </td>
                            <td
                              className={wbCellNum}
                              title={
                                lfBreakdown
                                  ? lineExtendedTotalBreakdownTitle(lfBreakdown)
                                  : undefined
                              }
                            >
                              {formatMoney(lineTotalExGst)}
                            </td>
                            <WbLabourSiloRowCells
                              row={row}
                              quoteObjects={quoteObjects}
                              contractRates={contractLabourRates}
                              objectLabourRates={objectLabourRates}
                              objectLabel={objectLabel(row, quoteObjects)}
                              saving={saving}
                              wbCellLoad={wbCellLoad}
                              wbInputLoad={wbInputLoad}
                              inputKey={inputKey}
                              onPatch={(lineId, body) => void patchLineItem(lineId, body)}
                            />
                            <td
                              className={`${wbCellNum} font-medium text-sf-accent dark:text-emerald-300`}
                              title={
                                lfBreakdown
                                  ? lineFinalPriceBreakdownTitle(lfBreakdown)
                                  : undefined
                              }
                            >
                              {lf != null ? formatMoney(lf) : "—"}
                            </td>
                            <WbLineSupplierCell
                              row={row}
                              suppliersBySkuId={suppliersBySkuId}
                              supplierDiscountByKey={supplierDiscountByKey}
                              cellClassName={wbCellMid}
                            />
                            <td className={`${wbCellMid} text-right`}>
                              <div className="flex items-center justify-end gap-0.5">
                                {lineScope ? (
                                  <ScopeLineMeasureTool
                                    scope={lineScope}
                                    line={row}
                                    quoteObjects={quoteObjects}
                                    objectLabel={objectLabel(row, quoteObjects)}
                                    disabled={saving}
                                    buttonClassName={WB_ICON_BTN_CLASS}
                                    iconClassName={WB_ICON_GLYPH_CLASS}
                                    onApplyMeasure={(payload) => {
                                      void patchLineItem(row.id, {
                                        custommeasure: payload.m2,
                                        ...(payload.scopeToolBenchSections !== undefined
                                          ? {
                                              scopeToolBenchSections:
                                                payload.scopeToolBenchSections,
                                            }
                                          : {}),
                                        ...(payload.scopeToolWallMm !== undefined
                                          ? { scopeToolWallMm: payload.scopeToolWallMm }
                                          : {}),
                                      });
                                    }}
                                  />
                                ) : null}
                                {renderProjectNotesButton(
                                  {
                                    projectid: row.projectid,
                                    areaid: row.areaid,
                                    objectid: row.objectid,
                                  },
                                  objectLabel(row, quoteObjects),
                                  { size: "workbench", disabled: saving || paoDeleting },
                                )}
                                <WbLineRowMenu
                                  lineLabel={objectLabel(row, quoteObjects)}
                                  disabled={
                                    saving || paoDeleting || wbCloningLineId === row.id
                                  }
                                  onClone={() => void cloneLineItem(row.id)}
                                  onDelete={() => setPaoDeleteId(row.id)}
                                />
                              </div>
                            </td>
                            <td className={wbSpacerCell} />
                          </tr>,
                          renderBundledAfter ? (
                          <ScopeLineBundledChildren
                            key={`${row.id}-bundled`}
                            mode="workbench"
                            parentLine={row}
                            bundledLines={bundledRowsForDisplay}
                            quoteObjects={quoteObjects}
                            catalogSkus={catalogSkus}
                            suppliersBySkuId={suppliersBySkuId}
                            priceLevels={priceLevels}
                            supplierDiscountByKey={supplierDiscountByKey}
                            pa={pa}
                            project={project}
                            rowSavingId={rowSavingId}
                            workbench={workbenchBundledCtx}
                            onPatchLine={(id, body) => {
                              void patchLineItem(id, body);
                            }}
                          />
                          ) : null,
                        ];
                          })
                        )}
                        <tr className={areaObjectBand}>
                          <td
                            colSpan={wbTableCols}
                            className="border-x border-b border-sf-border px-3 py-3 align-top dark:border-zinc-700"
                          >
                            <div className="space-y-4">
                              <div className={wbAreaSectionStack}>
                                <h5 className={wbAreaSectionTitle}>Area questions</h5>
                                {(() => {
                                  const answers = answersByProjectAreaDocId.get(pa.id) ?? [];
                                  if (answers.length === 0) {
                                    return (
                                      <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                                        No area questions for this template.
                                      </p>
                                    );
                                  }
                                  return (
                                    <div className={wbAreaSectionStack}>
                                      {answers.map((a) => {
                                        const tradeLabel = (a.applicableTradesSnapshot ?? [])
                                          .map((t) => t.lookupvalue)
                                          .filter(Boolean)
                                          .join(", ");
                                        const busy = answerSavingId === a.id;
                                        const questionLabel = tradeLabel
                                          ? `${tradeLabel}: ${a.questionTextSnapshot}`
                                          : a.questionTextSnapshot;
                                        return (
                                          <div key={a.id} className={wbAreaFieldStack}>
                                            <label className={wbAreaFieldLabel} htmlFor={`area-q-${a.id}`}>
                                              {questionLabel}
                                              {busy ? (
                                                <span className="ml-2 font-normal text-sf-text-weak">
                                                  Saving…
                                                </span>
                                              ) : null}
                                            </label>
                                            <textarea
                                              id={`area-q-${a.id}`}
                                              key={`${a.id}-${a.updatedAt ?? ""}`}
                                              rows={2}
                                              className={wbAreaFieldTextarea}
                                              defaultValue={a.answer ?? ""}
                                              disabled={busy}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" && e.ctrlKey)
                                                  (e.target as HTMLTextAreaElement).blur();
                                              }}
                                              onBlur={(e) => {
                                                const next = e.target.value;
                                                if (next === (a.answer ?? "")) return;
                                                void patchProjectAreaAnswer(a.id, { answer: next });
                                              }}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </>
                    ) : null}
                  </Fragment>
                );
              })
              )}
              {sortedProjectAreas.length > 0 && mode !== "workbench" ? (
              <tr className="border-t-2 border-t-zinc-400 bg-sf-page font-semibold dark:border-t-zinc-500 dark:bg-zinc-800">
                <td colSpan={WB_TABLE_COLS - 1} className={`${cell} bg-sf-page text-right align-top dark:bg-zinc-800`}>
                  <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                    Project total
                  </span>
                </td>
                <td
                  className={`${cell} bg-sf-page text-right align-top text-base tabular-nums text-sf-accent dark:text-emerald-200 dark:bg-zinc-800`}
                >
                  <span className="block text-xs font-medium uppercase tracking-wide text-sf-accent/80 dark:text-emerald-200/90">
                    Total price
                  </span>
                  <span className="text-base font-semibold">
                    {formatMoney(grandFinalTotal)}
                  </span>
                </td>
              </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {mode !== "workbench" && clScrollContextAreas.length > 0 ? (
        <ClScrollContextRail
          areas={clScrollContextAreas}
          projectTotalLabel={
            grandFinalTotal > 0 ? formatMoney(grandFinalTotal) : "—"
          }
        />
      ) : null}

      {wbBlindsEditLineId && mode === "workbench"
        ? (() => {
            const line = allObjects.find((o) => o.id === wbBlindsEditLineId);
            if (!line || !isBlindsSystemLine(line)) return null;
            return (
              <BlindsScopeEditModal
                open
                line={line}
                blindsRows={blindsData}
                disabled={rowSavingId === line.id}
                selectClassName={wbSelectRow}
                onClose={() => setWbBlindsEditLineId(null)}
                onPatch={(patch) => patchLineItem(line.id, patch)}
              />
            );
          })()
        : null}

      {wbBuildingElementLineId && mode === "workbench"
        ? (() => {
            const line = allObjects.find((o) => o.id === wbBuildingElementLineId);
            if (!line) return null;
            const element = findBuildingElementForLine(
              line,
              catalogSkus,
              buildingElementBySkuName,
            );
            if (!element) return null;
            return (
              <WbBuildingElementConsumptionModal
                line={line}
                element={element}
                catalogSkus={catalogSkus}
                suppliersBySkuId={suppliersBySkuId}
                supplierDiscountByKey={supplierDiscountByKey}
                onClose={() => setWbBuildingElementLineId(null)}
              />
            );
          })()
        : null}

      {wbPaintingElementLineId && mode === "workbench"
        ? (() => {
            const line = allObjects.find((o) => o.id === wbPaintingElementLineId);
            if (!line) return null;
            const element = findPaintingElementForLine(
              line,
              catalogSkus,
              paintingElementBySkuName,
            );
            if (!element) return null;
            return (
              <WbPaintingElementConsumptionModal
                line={line}
                element={element}
                catalogSkus={catalogSkus}
                suppliersBySkuId={suppliersBySkuId}
                supplierDiscountByKey={supplierDiscountByKey}
                onClose={() => setWbPaintingElementLineId(null)}
              />
            );
          })()
        : null}

      {clNonStdModal && mode !== "workbench" ? (() => {
        if (clNonStdModal.kind === "area") {
          const pa = projectAreas.find((p) => p.id === clNonStdModal.paId);
          if (!pa) return null;
          return (
            <ClNonStdTierModal
              target={clNonStdModal}
              pa={pa}
              line={null}
              project={project}
              cascades={cascades}
              priceLevels={priceLevels}
              styleOptions={baseStyleOptions.out}
              styleOptionsSeen={baseStyleOptions.seen}
              disabled={areaSavingId === pa.id}
              onClose={() => setClNonStdModal(null)}
              onSave={(body) => patchProjectArea(pa.id, body)}
            />
          );
        }
        const line = allObjects.find((o) => o.id === clNonStdModal.lineId);
        if (!line) return null;
        const pa = projectAreas.find((p) => p.id === (line.projectAreaDocId ?? ""));
        if (!pa) return null;
        return (
          <ClNonStdTierModal
            target={clNonStdModal}
            pa={pa}
            line={line}
            project={project}
            cascades={cascades}
            priceLevels={priceLevels}
            styleOptions={baseStyleOptions.out}
            styleOptionsSeen={baseStyleOptions.seen}
            disabled={rowSavingId === line.id}
            onClose={() => setClNonStdModal(null)}
            onSave={(body) => patchLineItem(line.id, body)}
          />
        );
      })() : null}

      {pickAreaOpen ? (
        <ModalFrame
          title="Add area"
          description="Choose a template area from Setup. Scope questions for that template appear on the checklist; default quote lines from Setup are copied in, same as when areas are added automatically for a new project."
          onClose={() => !addAreaSaving && setPickAreaOpen(false)}
          wide
          footer={
            <button
              type="button"
              onClick={() => !addAreaSaving && setPickAreaOpen(false)}
              className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
            >
              Cancel
            </button>
          }
        >
          {addAreaSaving ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Adding…</p>
          ) : areasSortedForPicker.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No template areas are defined yet. Add them under Setup → Areas.
            </p>
          ) : (
            <>
              <label className="mb-3 block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Area nickname (optional)
                </span>
                <input
                  value={addAreaDisplayName}
                  onChange={(e) => setAddAreaDisplayName(e.target.value)}
                  placeholder="e.g. Master, En-suite"
                  className={addAreaModalInputClass}
                />
                <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Display only — useful when you have two of the same area (e.g. two bathrooms).
                  Leave blank to show the template name only.
                </span>
              </label>
              {project?.defaultpricelevelid == null ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                  <p className="mb-2 text-sm font-medium text-amber-950 dark:text-amber-100">
                    Elevate required
                  </p>
                  <p className="mb-2 text-xs text-amber-900/90 dark:text-amber-200/90">
                    This project has no default Elevate. Choose Elevate for this area so scope
                    answers and line pricing resolve correctly.
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-300">
                      Elevate for this area
                    </span>
                    <PriceLevelIdSelect
                      value={addAreaPriceLevelId}
                      onChange={setAddAreaPriceLevelId}
                      className={addAreaModalInputClass}
                      emptyLabel="Select Elevate (required)"
                    />
                  </label>
                </div>
              ) : (
                <p className="mb-3 text-xs text-sf-text-secondary dark:text-zinc-400">
                  This area will use the project default Elevate (#{project?.defaultpricelevelid}).
                </p>
              )}
              <ul className="max-h-[min(24rem,55vh)] space-y-1 overflow-y-auto pr-1">
                {areasSortedForPicker.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void addProjectAreaFromTemplate(a.id)}
                      disabled={addAreaSaving}
                      className="w-full rounded-lg border border-sf-border px-4 py-3 text-left text-sm font-medium transition hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      {a.areaname}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ModalFrame>
      ) : null}

      <AddObjectPickerModal
        open={pickObjectOpen && Boolean(pickObjectArea)}
        areaLabel={
          pickObjectArea ? projectAreaHeading(pickObjectArea, areas) : ""
        }
        scopeLabel={pickObjectContext?.scopeLabel}
        quoteObjects={quoteObjects}
        saving={pickObjectSaving}
        onClose={closePickObjectModal}
        onPick={(id) => void addLineItemFromQuoteObject(id)}
      />

      {wbBlankLineArea ? (
        <WbBlankLineModal
          open={Boolean(wbBlankLineContext)}
          pa={wbBlankLineArea}
          project={project}
          quoteObjects={quoteObjects}
          catalogSkus={catalogSkus}
          suppliersBySkuId={suppliersBySkuId}
          priceLevels={priceLevels}
          cascades={cascades}
          baseStyleOptions={baseStyleOptions}
          effectiveCascadeStyleForLine={effectiveCascadeStyleForLine}
          wbLineColourEmptyLabel={wbLineColourEmptyLabel}
          saving={wbBlankLineSaving}
          initialCategory={wbBlankLineContext?.category ?? null}
          initialSeed={wbBlankLineContext?.seed ?? null}
          entryMode={wbBlankLineContext?.linesource ?? "manual"}
          onClose={closeWbBlankLineModal}
          onSave={(body) =>
            void saveWorkbenchBlankLine(
              wbBlankLineArea,
              body,
              wbBlankLineContextRef.current?.afterLineId,
            )
          }
        />
      ) : null}

      <AddScopePickerModal
        open={pickScopeOpen && Boolean(pickScopeArea)}
        areaLabel={
          pickScopeArea ? projectAreaHeading(pickScopeArea, areas) : ""
        }
        scopes={scopes}
        areas={areas}
        defaultSetupAreaDocId={pickScopeTemplateAreaDocId}
        scopeIdsOnArea={pickScopeOnAreaIds}
        saving={pickScopeSaving}
        onClose={closePickScopeModal}
        onPick={(id) => void addScopeToAreaFromPicker(id)}
      />

      <ConfirmDialog
        open={Boolean(escalationNotePrompt)}
        title="Add escalation note?"
        description={
          escalationNotePrompt
            ? `Area “${escalationNotePrompt.areaLabel}” is marked Escalated. Do you want to add a note explaining why?`
            : ""
        }
        confirmLabel="Yes, add note"
        cancelLabel="No"
        onCancel={() => setEscalationNotePrompt(null)}
        onConfirm={() => {
          if (!escalationNotePrompt) return;
          setAreaNotesEscalationDraftPaId(escalationNotePrompt.paId);
          setAreaNotesOpenPaId(escalationNotePrompt.paId);
          setEscalationNotePrompt(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(paDeleteId)}
        title="Remove area from project?"
        description={
          projectAreaPendingDelete
            ? `“${projectAreaHeading(projectAreaPendingDelete, areas)}” and all scope answers, line items, and area questions for this area will be removed from the project. This cannot be undone.`
            : "This area and all its scope answers, line items, and area questions will be removed. This cannot be undone."
        }
        confirmLabel="Remove area"
        cancelLabel="Cancel"
        variant="danger"
        pending={paDeleting}
        onCancel={() => setPaDeleteId(null)}
        onConfirm={() => void confirmProjectAreaDelete()}
      />

      <ConfirmDialog
        open={Boolean(paoDeleteId)}
        title="Remove line item?"
        description={
          linePendingDelete
            ? `“${objectLabel(linePendingDelete, quoteObjects)}” will be removed from this project. This cannot be undone.`
            : "This quote line will be removed from the project area. This cannot be undone."
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        pending={paoDeleting}
        onCancel={() => setPaoDeleteId(null)}
        onConfirm={() => void confirmProjectAreaObjectDelete()}
      />

      {wbTradeReportData ? (
        <WorkbenchTradeReportWindow
          data={wbTradeReportData}
          onClose={() => setWbTradeReportData(null)}
        />
      ) : null}
      {wbPaintLitresReportData ? (
        <WorkbenchPaintLitresPrintReport data={wbPaintLitresReportData} />
      ) : null}
      {wbPurchasingListReportWindowData ? (
        <WorkbenchPurchasingListReportWindow
          data={wbPurchasingListReportWindowData}
          onClose={() => setWbPurchasingListReportWindowData(null)}
        />
      ) : null}
    </div>
  );
}

