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
import { BlindsScopeEditModal } from "@/components/blinds-scope-edit-modal";
import { BlindsScopeFields } from "@/components/blinds-scope-fields";
import { BlindsWorkbenchSkuLink } from "@/components/blinds-workbench-sku-link";
import { AddObjectPickerModal } from "@/components/add-object-picker-modal";
import { AddScopePickerModal } from "@/components/add-scope-picker-modal";
import {
  clAnswerInlineFieldClass,
  clAnswerWidthCh,
  clScopeQuestionSkuDividerClass,
  clActionBtnClass,
  clActionBtnDangerClass,
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
  clScopeToolColClass,
  clToolCellClass,
  clScopeQuestionAnswerGroupClass,
  clScopeQuestionAnswerGroupBlindsClass,
  clScopeQuestionAnswerRowClass,
  clScopeQuestionTextClass,
  clScopeSkuColClass,
  clScopeUomColClass,
  clSkuFieldClass,
  clSkuPickerWrapClass,
  clSkuSelectExtraClass,
  clUomFieldClass,
} from "@/components/cl-checklist-layout";
import { ScopeLineMeasureTool, ScopeToolAfterAnswer } from "@/components/scope-tool-modal";
import { ScopeLineSkuPicker } from "@/components/scope-line-sku-picker";
import {
  ScopeLineBundledChildren,
  type WorkbenchBundledContext,
} from "@/components/scope-line-bundled-children";
import { applyScopeLineSkuWithBundledChildren } from "@/lib/client/apply-scope-line-sku-selection";
import { partitionAreaLines } from "@/lib/client/partition-area-lines";
import {
  resolveScopeLineSkuUnitPriceExcGst,
  scopeLineMatchesSkuPick,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import { IconNotes, IconTrash } from "@/components/icons/lightning-icons";
import { ModalFrame } from "@/components/modal-frame";
import { CascadeElevateSelect } from "@/components/cascade-elevate-select";
import { PriceLevelIdSelect } from "@/components/price-level-id-select";
import { ProjectsTabs } from "@/components/projects-tabs";
import { useLookups } from "@/lib/client/use-lookups";
import { ChecklistMeasureInput } from "@/components/checklist-measure-input";
import { ChecklistProjectDimensionsRow } from "@/components/checklist-project-dimensions-row";
import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import { singleYesAnswerId } from "@/lib/scope-single-yes-answer";
import { scopesForProjectArea } from "@/lib/scopes-for-project-area";
import { marginPercentFromSettings } from "@/lib/settings-margin";
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
import { WbLabourSiloValue } from "@/components/wb-labour-silo-cell";
import { WbLineSupplierCell } from "@/components/wb-line-supplier-cell";
import { WbObjectName } from "@/components/wb-object-name";
import { projectLineObjectLabel } from "@/lib/client/project-line-quote-object";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import { distinctLookupValues } from "@/lib/lookup-list-values";
import { LOOKUP_TYPE_STYLE } from "@/lib/lookup-types";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import {
  cascadeLevelFromPriceLevel,
} from "@/lib/cascades/cascade-level-from-price-level";
import { scopeSelectionUsesSystemBlinds } from "@/lib/blinds/blinds-scope-answer";
import { isBlindsSystemLine, blindsSkuDisplayLabel } from "@/lib/blinds/blinds-data-utils";
import type { DataBlindPublic } from "@/types/data-blind-public";
import type { AreaPublic } from "@/types/area";
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from "@/lib/client/format-money";
import { loadCatalogSkuData } from "@/lib/client/load-catalog-sku-data";
import { supplierDiscountByKeyFromRows } from "@/lib/client/supplier-discount-price";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";
import { patchBodyForScopeLineSku } from "@/lib/client/scope-line-sku-patch";
import { scopeAnswerNeedsShowAllLineSync } from "@/lib/client/scope-show-all-sync";
import { useViewMode } from "@/lib/view-mode";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { ProjectAreaAnswerPublic } from "@/types/project-area-answer";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import type { SettingPublic } from "@/types/setting";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  if (s === "manual") return "Manual";
  if (s === "bundled") return "Bundled";
  return "Default";
}

/** Amount counted toward area / project totals when line is included. */
function includedLineTotal(row: ProjectAreaObjectPublic): number {
  if (row.included === false) return 0;
  const t = row.totalprice;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

function lineFinalPrice(
  row: ProjectAreaObjectPublic,
  marginPct: number,
): number | null {
  if (row.included === false) return null;
  const t = row.totalprice;
  if (t == null || !Number.isFinite(t)) return null;
  return t * (1 + marginPct / 100);
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function splitNotes(text: string): { notes1: string; notes2: string } {
  const lines = text.split(/\r?\n/);
  const notes1 = (lines[0] ?? "").trim();
  const notes2 = lines.slice(1).join("\n").trim();
  return { notes1, notes2 };
}

function areaNotesCombined(pa: ProjectAreaPublic): string {
  return [pa.areanotes1, pa.areanotes2].filter(Boolean).join("\n").trim();
}

function areaNotesCombinedMatches(pa: ProjectAreaPublic, draft: string): boolean {
  return areaNotesCombined(pa) === draft.trim();
}

function lineHasNotes(row: ProjectAreaObjectPublic): boolean {
  return Boolean(row.notes1?.trim() || row.notes2?.trim());
}

function lineNotesCombined(row: ProjectAreaObjectPublic): string {
  return [row.notes1, row.notes2].filter(Boolean).join("\n").trim();
}

/** Native tooltip on line notes icon (hover preview). */
function lineNotesTooltip(row: ProjectAreaObjectPublic): string {
  const text = lineNotesCombined(row);
  if (!text) return "No notes — click to add";
  const max = 500;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const sfRowIconBtnNotesEmpty =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-emerald-400 bg-sf-surface text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 disabled:opacity-50 dark:border-emerald-700 dark:bg-zinc-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40";

function lineNotesIconBtnClass(hasNotes: boolean): string {
  return hasNotes ? sfRowIconBtnDanger : sfRowIconBtnNotesEmpty;
}

const thBase =
  "border border-sf-border-strong bg-sf-page px-1 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
/** Workbench object header row inside an area band (background comes from `<tr>`). */
const thBaseWb =
  "border border-sf-border-strong py-1.5 pl-2.5 pr-1 text-left text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:border-zinc-600 dark:text-zinc-300";
/** Workbench area: darker header row, lighter object table (lines + column headers + notes). */
const wbAreaHdrBand = "bg-sky-100 dark:bg-sky-900/55";
const wbAreaObjectBand = "bg-sky-50 dark:bg-sky-950/30";
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
 * Col widths: colgroup only; reclaimed width → wbSpacerCol (19th column).
 */
const WB_TABLE_COLS = 19;
const wbSupplierCol = "w-[6rem]";
const wbSpacerCol = "w-[4.9rem]";
const wbSpacerCell = `${wbCellMuted} border border-sf-border dark:border-zinc-700`;
/** Area / project header rows: same columns as object table, no internal column borders. */
const wbAreaHdrCell = "border-0 align-top px-1 py-1.5";
const wbAreaHdrCellRight = `${wbAreaHdrCell} text-right`;
/** Workbench area header row: outer border only (no vertical rules between cells). */
const wbAreaHdrOutline = "border-sf-border dark:border-zinc-700";
const wbAreaHdrCellOutlineFirst = `border-0 border-b border-l border-t ${wbAreaHdrOutline} align-middle py-1.5 pl-3 pr-1`;
const wbAreaHdrCellOutlineMid = `border-0 border-b border-t ${wbAreaHdrOutline} align-top px-1 py-1.5`;
const wbAreaHdrCellOutlineMidRight = `${wbAreaHdrCellOutlineMid} text-right`;
const wbAreaHdrCellOutlineLast = `border-0 border-b border-r border-t ${wbAreaHdrOutline} align-top px-1 py-1.5`;
const wbProjectHdrRow =
  "border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900/60";
const linkArea =
  "font-semibold text-sf-text underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-600 dark:text-zinc-50 dark:decoration-zinc-500 dark:hover:decoration-zinc-300";

const inputNum =
  "w-full min-w-0 rounded border border-sf-border-strong bg-sf-surface px-1.5 py-1 text-sm tabular-nums text-right outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-emerald-500";
const inputText =
  "w-full min-w-0 rounded border border-sf-border-strong bg-sf-surface px-1.5 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-emerald-500";
const inputLong =
  "w-full min-w-0 rounded border border-sf-border-strong bg-sf-surface px-2 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-emerald-500";
const selectBase =
  "rounded border border-sf-border-strong bg-sf-surface px-1 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950";
const selectCell = `${selectBase} w-full min-w-0`;
/** Workbench row controls (no text-sm — avoids conflicting with text-xs). */
const wbFieldBase =
  "rounded border border-sf-border-strong bg-sf-surface px-1 py-0.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-emerald-500";
/** Workbench column-aligned field labels (project/area header rows). */
const wbHdrLabel =
  "mb-0.5 block text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400";
/** Workbench: Elevate select ~30 characters; colour ~10. */
const wbSelectTier = `${selectBase} w-[30ch] max-w-full`;
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

export function ProjectChecklistPanel({
  mode = "checklist",
}: {
  mode?: ProjectChecklistPanelMode;
}) {
  const searchParams = useSearchParams();
  const projectDocId = searchParams.get("id");
  const { lookups } = useLookups();
  const { isAdminMode } = useViewMode();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectPublic | null>(null);
  const [numericProjectId, setNumericProjectId] = useState<number | null>(null);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [projectAreas, setProjectAreas] = useState<ProjectAreaPublic[]>([]);
  const [allObjects, setAllObjects] = useState<ProjectAreaObjectPublic[]>([]);
  const [projectAreaAnswers, setProjectAreaAnswers] = useState<ProjectAreaAnswerPublic[]>([]);
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
  const baseStyleOptions = useMemo(() => {
    const out = distinctLookupValues(lookups, LOOKUP_TYPE_STYLE);
    return { out, seen: new Set(out) };
  }, [lookups]);

  const [pickAreaOpen, setPickAreaOpen] = useState(false);
  const [addAreaPriceLevelId, setAddAreaPriceLevelId] = useState<number | null>(null);
  const [addAreaDisplayName, setAddAreaDisplayName] = useState("");
  const [addAreaSaving, setAddAreaSaving] = useState(false);
  const [paDeleteId, setPaDeleteId] = useState<string | null>(null);
  const [paDeleting, setPaDeleting] = useState(false);
  const [paoDeleteId, setPaoDeleteId] = useState<string | null>(null);
  const [paoDeleting, setPaoDeleting] = useState(false);
  const [pickObjectOpen, setPickObjectOpen] = useState(false);
  const [pickObjectAreaId, setPickObjectAreaId] = useState<string | null>(null);
  const [pickObjectSaving, setPickObjectSaving] = useState(false);
  const [pickScopeOpen, setPickScopeOpen] = useState(false);
  const [pickScopeAreaId, setPickScopeAreaId] = useState<string | null>(null);
  const [pickScopeSaving, setPickScopeSaving] = useState(false);
  const [answerSavingId, setAnswerSavingId] = useState<string | null>(null);
  /** Workbench object line notes (icon opens popup; area notes stay inline in header). */
  const [lineNotesModal, setLineNotesModal] = useState<{
    lineId: string;
    label: string;
    draft: string;
  } | null>(null);
  /** Workbench (admin): per line, include non–priority-1 supplier SKUs in SKU picker. */
  const [skuShowAllByLineId, setSkuShowAllByLineId] = useState<Record<string, boolean>>(
    {},
  );
  /** Checklist: Non Std tier/style/colour popup target (area or line). */
  const [clNonStdModal, setClNonStdModal] = useState<ClNonStdModalTarget | null>(null);
  const [blindsData, setBlindsData] = useState<DataBlindPublic[]>([]);
  const [wbBlindsEditLineId, setWbBlindsEditLineId] = useState<string | null>(null);
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
        lines = await persistWorkbenchLookupLabour(lines, quoteObjects, objectLabourRates);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to sync labour hours from rates table",
        );
      }
    }
    setAllObjects(lines);
  }, [projectDocId, mode, quoteObjects, objectLabourRates]);

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

  const applyScopeAnswer = useCallback(
    async (pa: ProjectAreaPublic, scopeDocId: string, answerid: string | null) => {
      setScopeAnswerSaving(scopeDocId);
      setError(null);
      try {
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(pa.id)}/scope-answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scopeDocId, answerid }),
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
            data.diagnostics.noLinesReason !== "answer_cleared"
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

  /** Re-apply scope answers when Show All was configured in Setup but lines are still a single SKU dropdown row. */
  useEffect(() => {
    if (!projectDocId || scopes.length === 0 || quoteObjects.length === 0) return;

    for (const pa of projectAreas) {
      for (const entry of pa.scopeAnswers ?? []) {
        const scope = scopes.find((s) => s.id === entry.scopeDocId);
        if (!scope) continue;
        const scopeLines = allObjects.filter(
          (o) =>
            o.projectAreaDocId === pa.id &&
            o.linesource === "scope" &&
            o.scopeDocId === entry.scopeDocId,
        );
        if (
          !scopeAnswerNeedsShowAllLineSync(scope, entry.answerid, scopeLines, quoteObjects)
        ) {
          continue;
        }
        const key = `${pa.id}:${entry.scopeDocId}`;
        if (showAllSyncInFlightRef.current.has(key)) continue;
        if (scopeAnswerSaving === entry.scopeDocId) continue;
        showAllSyncInFlightRef.current.add(key);
        void applyScopeAnswer(pa, entry.scopeDocId, entry.answerid).finally(() => {
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

  const patchLineItem = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const shouldRecalcLookupLabour =
        body.custommeasure !== undefined || body.customuom !== undefined;

      setRowSavingId(id);
      setError(null);

      if (shouldRecalcLookupLabour && mode === "workbench") {
        setAllObjects((prev) =>
          prev.map((o) => {
            if (o.id !== id) return o;
            const q = quoteObjects.find((qo) => qo.objectid === o.objectid);
            const objectName = q?.objectname?.trim() ?? "";
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
      if (scopeLineMatchesSkuPick(parentLine, pick)) return;

      setRowSavingId(parentLine.id);
      setError(null);
      try {
        if (mode === "workbench") {
          await applyScopeLineSkuWithBundledChildren({
            parentLine,
            pick,
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
          });
        } else {
          await patchLineItem(
            parentLine.id,
            patchBodyForScopeLineSku(parentLine, pick),
          );
        }
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

        await reloadProjectAreaAnswers();
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
    reloadProjectAreaAnswers,
    mode,
  ]);

  const workbenchLookupLabourSyncingRef = useRef(false);

  /** Workbench: apply object labour rates table to lookup silos on load and when rates/lines change. */
  useEffect(() => {
    if (mode !== "workbench" || loading || !projectDocId) return;

    const updates = lookupLabourUpdatesForLines(
      allObjects,
      quoteObjects,
      objectLabourRates,
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
  }, [mode, loading, projectDocId, allObjects, quoteObjects, objectLabourRates]);

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
      list.sort((a, b) => a.objectid - b.objectid);
    }
    return m;
  }, [allObjects, projectAreas]);

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

  function openPickObjectModal(pa: ProjectAreaPublic) {
    setPickObjectAreaId(pa.id);
    setPickObjectOpen(true);
  }

  function closePickObjectModal() {
    if (pickObjectSaving) return;
    setPickObjectOpen(false);
    setPickObjectAreaId(null);
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
      const ok = await addExtraScopeToArea(pa, scopeDocId);
      if (ok) closePickScopeModal();
    } finally {
      setPickScopeSaving(false);
    }
  }

  function checklistAreaAddButtons(pa: ProjectAreaPublic, disabled: boolean) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openPickScopeModal(pa)}
          disabled={disabled}
          className={clActionBtnClass}
        >
          Add scope…
        </button>
        <button
          type="button"
          onClick={() => openPickObjectModal(pa)}
          disabled={disabled}
          className={clActionBtnClass}
        >
          Add object…
        </button>
      </div>
    );
  }

  function checklistAreaRemoveButton(pa: ProjectAreaPublic, disabled: boolean) {
    return (
      <button
        type="button"
        onClick={() => setPaDeleteId(pa.id)}
        disabled={disabled || paDeleting}
        className={clActionBtnDangerClass}
        aria-label={`Remove area ${projectAreaHeading(pa, areas)} from project`}
        title="Remove area from project"
      >
        Remove area
      </button>
    );
  }

  async function addLineItemFromQuoteObject(quoteObjectDocId: string) {
    if (!pickObjectAreaId) return;
    setPickObjectSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projectareaobjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectAreaDocId: pickObjectAreaId, quoteObjectDocId }),
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

  const grandTotal = useMemo(
    () => allObjects.reduce((sum, row) => sum + includedLineTotal(row), 0),
    [allObjects],
  );

  const marginPct = useMemo(() => marginPercentFromSettings(settings), [settings]);

  const projectAreaPendingDelete = paDeleteId
    ? projectAreas.find((pa) => pa.id === paDeleteId)
    : undefined;
  const linePendingDelete = paoDeleteId
    ? allObjects.find((o) => o.id === paoDeleteId)
    : undefined;

  const pickScopeArea = pickScopeAreaId
    ? projectAreas.find((pa) => pa.id === pickScopeAreaId)
    : undefined;

  const scopePickerCandidates = useMemo(() => {
    if (!pickScopeArea) return [];
    const onArea = new Set(
      scopesForProjectArea(pickScopeArea, areas, scopes).map((s) => s.id),
    );
    return scopes.filter((s) => !onArea.has(s.id));
  }, [pickScopeArea, areas, scopes]);

  const pickObjectArea = pickObjectAreaId
    ? projectAreas.find((pa) => pa.id === pickObjectAreaId)
    : undefined;

  const grandFinalTotal = useMemo(
    () =>
      allObjects.reduce((sum, row) => {
        const f = lineFinalPrice(row, marginPct);
        return sum + (f != null ? f : 0);
      }, 0),
    [allObjects, marginPct],
  );

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
      cascades,
      baseStyleOptions,
      marginPct,
      isAdminMode,
      paoDeleting,
      includeAllSuppliersForLine,
      setIncludeAllSuppliersForLine,
      inputKey,
      objectLabel,
      lineSourceLabel,
      lineFinalPrice,
      effectiveCascadeStyleForLine,
      wbLineColourEmptyLabel,
      formatMoney,
      lineHasNotes,
      lineNotesTooltip,
      lineNotesIconBtnClass,
      onOpenLineNotes: (lineId, label, draft) =>
        setLineNotesModal({ lineId, label, draft }),
      lineNotesCombined,
      onDeleteLine: (lineId) => setPaoDeleteId(lineId),
      onValidationError: setError,
      contractLabourRates,
      objectLabourRates,
    };
  }, [
    objectLabel,
    cascades,
    baseStyleOptions,
    marginPct,
    isAdminMode,
    paoDeleting,
    includeAllSuppliersForLine,
    setIncludeAllSuppliersForLine,
    contractLabourRates,
    objectLabourRates,
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
          {mode === "workbench" ? "Workbench" : "Check List"}
        </h1>
        <ProjectsTabs />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {mode !== "workbench" ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            {project
              ? `${project.projectname}${numericProjectId != null ? ` · ID ${numericProjectId}` : ""}`
              : "At-a-glance scope, measurements, and line totals by area."}
          </p>
        ) : (
          <span className="sr-only">Workbench</span>
        )}
        {projectDocId && project && numericProjectId != null && !loading ? (
          <button
            type="button"
            onClick={openPickAreaModal}
            className="min-h-11 shrink-0 rounded-lg bg-sf-brand px-4 py-2.5 text-sm font-medium text-white"
          >
            Add area…
          </button>
        ) : null}
      </div>

      <p className="text-xs text-sf-text-weak dark:text-zinc-400">
        Edits save when you leave a cell (Tab or click away). Unchecked lines are excluded from
        subtotals. Line total updates from measure × unit price when both are set.{" "}
        <span className="font-medium text-sf-text-secondary dark:text-zinc-300">
          Margin {marginPct}%
        </span>{" "}
        (System → Settings) applies to Final price.{" "}
        <span className="font-medium text-sf-text-secondary dark:text-zinc-300">Load rates</span>{" "}
        ($/unit) show as dollar lines under each load total when set.
      </p>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {projectDocId && project && !loading && mode !== "workbench" ? (
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-lg border border-sf-border bg-sf-page px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/60">
            <ChecklistProjectDimensionsRow
              project={project}
              disabled={projectSaving}
              onPatch={(body) => void patchProject(body)}
              onValidationError={setError}
            />
            <label className="flex min-w-[10rem] flex-col gap-0.5">
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
                className={selectCell}
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
              selectClassName={selectCell}
              styleSelectClassName={selectCell}
              colourSelectClassName={selectCell}
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
            <span className="w-full text-xs text-sf-text-weak dark:text-zinc-400">
              Style and colour options come from Cascades (Import). Used for SKU matching on scope
              lines unless an area overrides them.
            </span>
          </div>
      ) : null}

      {!projectDocId ? (
        <div className="rounded-lg border border-sf-border bg-sf-surface p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
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
        <p className="text-sf-text-secondary dark:text-zinc-400">Loading…</p>
      ) : numericProjectId == null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          This project needs a numeric ID before line items can load. Save it once from the Project
          tab, or run Assign missing numeric IDs from the Projects list.
        </div>
      ) : sortedProjectAreas.length === 0 && mode !== "workbench" ? (
        <div className="rounded-lg border border-sf-border bg-sf-surface p-6 text-sm text-sf-text-secondary shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
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
        <div className="w-full min-w-0">
          <table
            className={
              mode === "workbench"
                ? "w-full border-collapse text-sm table-fixed"
                : "w-full min-w-[102rem] border-collapse text-sm table-fixed"
            }
          >
            {mode === "workbench" ? (
              <colgroup>
                <col className="w-[2.25rem]" />
                <col className="w-[4rem]" />
                <col className="w-[2.63rem]" />
                <col className="w-[5.25rem]" />
                <col className="w-[5.25rem]" />
                <col className="w-[5.95rem]" />
                <col className="w-[14.38rem]" />
                <col className="w-[2.3rem]" />
                <col className="w-[2.75rem]" />
                <col className="w-[2.8rem]" />
                <col className="w-[2.8rem]" />
                <col className="w-[1.85rem]" />
                <col className="w-[1.85rem]" />
                <col className="w-[1.85rem]" />
                <col className="w-[1.85rem]" />
                <col className="w-[3.15rem]" />
                <col className="w-[2.75rem]" />
                <col className={wbSupplierCol} />
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
              {mode === "workbench" && project ? (
                <tr className={wbProjectHdrRow}>
                  <td colSpan={3} className={`${wbAreaHdrCell} pl-2.5`}>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                      Project
                    </span>
                    <span
                      className="mt-0.5 block truncate text-sm font-bold leading-tight text-sf-text dark:text-zinc-50"
                      title={project.projectname}
                    >
                      {project.projectname}
                      {numericProjectId != null ? (
                        <span className="font-normal text-sf-text-secondary dark:text-zinc-400">
                          {" "}
                          · ID {numericProjectId}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${wbAreaHdrCell} pl-2.5`}>
                    <label className="flex min-w-0 flex-col gap-0.5">
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
                        className={wbSelectRow}
                        disabled={projectSaving}
                        emptyLabel="Not set"
                      />
                    </label>
                  </td>
                  <td className={wbAreaHdrCell}>
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
                      selectClassName={wbSelectRow}
                      styleSelectClassName={wbSelectRow}
                      colourSelectClassName={wbSelectRow}
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
                  </td>
                  <td className={wbAreaHdrCell}>
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
                      selectClassName={wbSelectRow}
                      styleSelectClassName={wbSelectRow}
                      colourSelectClassName={wbSelectRow}
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
                  </td>
                  <td className={wbAreaHdrCell} />
                  <td className={wbAreaHdrCell} />
                  <td className={wbAreaHdrCell} />
                  <td className={wbAreaHdrCell} />
                  <td className={wbAreaHdrCellRight}>
                    <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                      Project subtotal
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-sf-text dark:text-zinc-100">
                      {grandTotal > 0 ? formatMoney(grandTotal) : "—"}
                    </span>
                  </td>
                  {WB_WORKBENCH_LABOUR_SILO_HEADERS.map(({ key, label, title }) => {
                    const hoursSum = projectLoadTotals[key];
                    const rate = contractLabourRateBySiloProduct(contractLabourRates, key);
                    const cost = labourSiloCostExcGst(hoursSum > 0 ? hoursSum : null, rate);
                    return (
                      <td key={key} className={wbAreaHdrCellRight} title={title}>
                        <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                          {label}
                        </span>
                        <WbLabourSiloValue
                          hours={hoursSum > 0 ? hoursSum : null}
                          cost={cost}
                        />
                      </td>
                    );
                  })}
                  <td className={wbAreaHdrCellRight}>
                    <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                      Final (incl. margin)
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                      {grandFinalTotal > 0 ? formatMoney(grandFinalTotal) : "—"}
                    </span>
                  </td>
                  <td className={wbAreaHdrCell} />
                  <td className={wbAreaHdrCell} />
                  <td className={wbAreaHdrCell} />
                </tr>
              ) : null}
              {sortedProjectAreas.length === 0 ? (
                <tr>
                  <td
                    colSpan={WB_TABLE_COLS}
                    className="border border-sf-border bg-sf-surface px-4 py-6 text-sm text-sf-text-secondary dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
                  >
                    No areas on this project yet. Use{" "}
                    <span className="font-medium text-sf-text dark:text-zinc-200">Add area</span> above.
                  </td>
                </tr>
              ) : (
              sortedProjectAreas.map((pa, areaIndex) => {
                const rows = objectsByProjectAreaDocId.get(pa.id) ?? [];
                const { topLevel: areaTopLines, bundledByParentId } = partitionAreaLines(rows);
                const areaSubtotal = rows.reduce((sum, row) => sum + includedLineTotal(row), 0);
                const areaFinalSubtotal = areaSubtotal * (1 + marginPct / 100);
                const hasIncludedMoney = rows.some((r) => includedLineTotal(r) > 0);
                const areaLoadTotals = Object.fromEntries(
                  LOOKUP_LABOUR_SILO_KEYS.map((k) => [k, sumLabourHours(rows, k)]),
                ) as Record<LabourSiloKey, number>;
                const areaBusy = areaSavingId === pa.id;
                const areaScopes = scopesForProjectArea(pa, areas, scopes);
                const areaNameForHeading = projectAreaHeading(pa, areas);
                const templateAreaDocId =
                  areas.find((a) => a.areaid != null && Number(a.areaid) === Number(pa.areaid))
                    ?.id ?? null;
                const areaAnswers = projectAreaAnswers.filter(
                  (a) => a.projectAreaDocId === pa.id,
                );
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
                      <tr>
                        <td
                          colSpan={19}
                          className="border-x border-b border-sf-border p-0 align-top dark:border-zinc-700"
                        >
                          <div
                            className={`${wbAreaHdrBand} border-b border-sf-border px-3 py-3 dark:border-zinc-700`}
                          >
                            <div className="inline-flex max-w-full flex-wrap items-end gap-x-4 gap-y-2">
                              <span
                                className="shrink-0 text-[1.09375rem] font-semibold leading-snug text-sf-text dark:text-zinc-50"
                                title={areaNameForHeading}
                              >
                                {areaNameForHeading}
                              </span>
                              <label className="flex shrink-0 flex-col gap-0.5">
                                <span className={wbHdrLabel}>Area m²</span>
                                <input
                                  key={areaFieldKey(pa, "m2")}
                                  type="text"
                                  inputMode="decimal"
                                  className={wbInputM2}
                                  defaultValue={pa.aream2 ?? ""}
                                  disabled={areaBusy}
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
                              <div className="shrink-0 pr-3">
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
                              {checklistAreaAddButtons(pa, areaBusy)}
                              {checklistAreaRemoveButton(pa, areaBusy)}
                            </div>
                          </div>
                          <div className={`${wbAreaObjectBand} space-y-3 px-3 py-3`}>
                          <h4 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
                            Scope Questions
                          </h4>
                          {areaScopes.length > 0 ? (
                            <ul className="flex w-full flex-col items-start space-y-2">
                              {areaScopes.map((scope) => {
                                if (scope.kind === "header") {
                                  return (
                                    <li
                                      key={scope.id}
                                      className="border-b border-sf-border pb-2 pt-1 dark:border-zinc-700"
                                    >
                                      <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-300">
                                        {scope.question}
                                      </span>
                                    </li>
                                  );
                                }
                                if (scope.kind === "footer") {
                                  return (
                                    <li
                                      key={scope.id}
                                      aria-hidden
                                      className="hidden"
                                    />
                                  );
                                }
                                const saved = pa.scopeAnswers?.find(
                                  (e) => e.scopeDocId === scope.id,
                                );
                                const value = saved?.answerid ?? "";
                                const busy = scopeAnswerSaving === scope.id;
                                const yesOnlyId = singleYesAnswerId(scope);
                                const isExtraScope = (pa.extraScopeDocIds ?? []).includes(scope.id);
                                const scopeLines = rows.filter(
                                  (r) => r.linesource === "scope" && r.scopeDocId === scope.id,
                                );
                                const scopeAnswered = Boolean(value) || scopeLines.length > 0;
                                const usesBlindsAnswer = scopeSelectionUsesSystemBlinds(scope, value);
                                const blindsLine =
                                  scopeLines.find((l) => l.systemObjectKind === "blinds") ?? null;
                                const answerWidthCh = clAnswerWidthCh(scope.answers);
                                const answerWidthStyle = {
                                  width: answerWidthCh,
                                  minWidth: answerWidthCh,
                                  maxWidth: answerWidthCh,
                                } as const;
                                return (
                                  <li
                                    key={scope.id}
                                    className={
                                      scopeAnswered
                                        ? "rounded-md border border-sf-border bg-sf-surface py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/55"
                                        : `rounded-md border border-transparent py-2 ${wbAreaObjectBand}`
                                    }
                                  >
                                    {scopeLines.length === 0 ? (
                                      <div className={clScopeLineStackClass}>
                                        <div className={clScopeQuestionAnswerRowClass}>
                                          <div className={clScopeQuestionAnswerGroupClass}>
                                            <span
                                              className={clScopeQuestionTextClass}
                                              title={scope.question}
                                            >
                                              {scope.question}
                                            </span>
                                            <label
                                              className={clAnswerInlineFieldClass}
                                              style={yesOnlyId ? undefined : answerWidthStyle}
                                            >
                                              {yesOnlyId ? (
                                                <span className="flex h-[2.125rem] items-center">
                                                  <input
                                                    type="checkbox"
                                                    className="size-4 shrink-0 rounded border-sf-border-strong accent-green-600 focus:ring-2 focus:ring-green-500/40 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-500"
                                                    disabled={busy}
                                                    checked={value === yesOnlyId}
                                                    onChange={(e) => {
                                                      void applyScopeAnswer(
                                                        pa,
                                                        scope.id,
                                                        e.target.checked ? yesOnlyId : null,
                                                      );
                                                    }}
                                                    aria-label={`Yes — ${scope.question}`}
                                                  />
                                                </span>
                                              ) : (
                                                <select
                                                  aria-label={`Answer for: ${scope.question}`}
                                                  className={clAnswerSelectBase}
                                                  style={answerWidthStyle}
                                                  disabled={busy}
                                                  value={value}
                                                  onChange={(e) => {
                                                    const v = e.target.value;
                                                    void applyScopeAnswer(
                                                      pa,
                                                      scope.id,
                                                      v === "" ? null : v,
                                                    );
                                                  }}
                                                >
                                                  <option value="">{"\u00A0"}</option>
                                                  {scope.answers.map((a) => (
                                                    <option key={a.answerid} value={a.answerid}>
                                                      {a.label}
                                                    </option>
                                                  ))}
                                                </select>
                                              )}
                                              {busy ? (
                                                <span className="text-[10px] text-sf-text-weak">
                                                  Updating…
                                                </span>
                                              ) : null}
                                            </label>
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
                                        </div>
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
                                            className={`${clToolCellClass} ${clScopeToolColClass}`}
                                            aria-hidden
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                    scopeLines.map((lineRow, lineIdx) => {
                                        const isFirstRow = lineIdx === 0;
                                        const showObjectNameHeader = scopeLineShowsObjectNameHeader(
                                          scopeLines,
                                          lineIdx,
                                        );
                                        const lineSaving = rowSavingId === lineRow.id;
                                        const qObj = quoteObjects.find(
                                          (o) => o.objectid === lineRow.objectid,
                                        );
                                        const measureKey =
                                          lineRow.custommeasure != null
                                            ? inputKey(lineRow, "scope-m")
                                            : `${inputKey(lineRow, "scope-m")}-ctx-${pa.aream2 ?? ""}-${project?.projectm2 ?? ""}-${project?.projectm2soft ?? ""}-${project?.projectm2hard ?? ""}`;
                                        return (
                                          <div
                                            key={lineRow.id}
                                            className={
                                              lineIdx > 0
                                                ? `${clScopeLineStackClass} mt-2`
                                                : clScopeLineStackClass
                                            }
                                          >
                                            {isFirstRow ? (
                                              <div className={clScopeQuestionAnswerRowClass}>
                                                {isFirstRow && usesBlindsAnswer && blindsLine ? (
                                                  <span
                                                    className={clScopeQuestionTextClass}
                                                    title={scope.question}
                                                  >
                                                    {scope.question}
                                                  </span>
                                                ) : null}
                                                <div
                                                  className={
                                                    isFirstRow && usesBlindsAnswer && blindsLine
                                                      ? clScopeQuestionAnswerGroupBlindsClass
                                                      : clScopeQuestionAnswerGroupClass
                                                  }
                                                >
                                                  {!(isFirstRow && usesBlindsAnswer && blindsLine) ? (
                                                    <span
                                                      className={clScopeQuestionTextClass}
                                                      title={scope.question}
                                                    >
                                                      {scope.question}
                                                    </span>
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
                                                      <span className="flex h-[2.125rem] items-center">
                                                        <input
                                                          type="checkbox"
                                                          className="size-4 shrink-0 rounded border-sf-border-strong accent-green-600 focus:ring-2 focus:ring-green-500/40 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-500"
                                                          disabled={busy}
                                                          checked={value === yesOnlyId}
                                                          onChange={(e) => {
                                                            void applyScopeAnswer(
                                                              pa,
                                                              scope.id,
                                                              e.target.checked ? yesOnlyId : null,
                                                            );
                                                          }}
                                                          aria-label={`Yes — ${scope.question}`}
                                                        />
                                                      </span>
                                                    ) : (
                                                      <select
                                                        aria-label={`Answer for: ${scope.question}`}
                                                        className={clAnswerSelectBase}
                                                        style={answerWidthStyle}
                                                        disabled={busy}
                                                        value={value}
                                                        onChange={(e) => {
                                                          const v = e.target.value;
                                                          void applyScopeAnswer(
                                                            pa,
                                                            scope.id,
                                                            v === "" ? null : v,
                                                          );
                                                        }}
                                                      >
                                                        <option value="">{"\u00A0"}</option>
                                                        {scope.answers.map((a) => (
                                                          <option key={a.answerid} value={a.answerid}>
                                                            {a.label}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    )}
                                                    {busy ? (
                                                      <span className="text-[10px] text-sf-text-weak">
                                                        Updating…
                                                      </span>
                                                    ) : null}
                                                  </label>
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
                                              </div>
                                            ) : null}
                                            {isFirstRow ? (
                                              <div
                                                className={clScopeQuestionSkuDividerClass}
                                                role="separator"
                                                aria-hidden
                                              />
                                            ) : null}
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
                                            <div className={clFieldsGridClass} style={clFieldsGridStyle}>
                                            <div
                                              className={`${clSkuFieldClass} ${clScopeSkuColClass}`}
                                              title={objectLabel(lineRow, quoteObjects)}
                                            >
                                              <span className={wbHdrLabel}>SKU</span>
                                              <div className={clSkuPickerWrapClass}>
                                                {isBlindsSystemLine(lineRow) ? (
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
                                                lockToSkuId={
                                                  lineRow.scopeShowAllSku ? lineRow.skuId : null
                                                }
                                                onSelectSku={(pick) => {
                                                  void applyLineSkuSelection(lineRow, pa, pick);
                                                }}
                                              />
                                                )}
                                              </div>
                                            </div>
                                            <label className={`${clMeasureFieldClass} ${clScopeMeasureColClass}`}>
                                              <span className={wbHdrLabel}>Measure</span>
                                              <ChecklistMeasureInput
                                                line={lineRow}
                                                quoteObject={qObj}
                                                pa={pa}
                                                project={project}
                                                measureKey={measureKey}
                                                inputClassName={clMeasureInput}
                                                disabled={lineSaving}
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
                                            <div className={`${clToolCellClass} ${clScopeToolColClass}`}>
                                              <ScopeLineMeasureTool
                                                scope={scope}
                                                line={lineRow}
                                                quoteObjects={quoteObjects}
                                                objectLabel={objectLabel(lineRow, quoteObjects)}
                                                disabled={lineSaving}
                                                onApplyMeasure={(m2) => {
                                                  void patchLineItem(lineRow.id, {
                                                    custommeasure: m2,
                                                  });
                                                }}
                                              />
                                            </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                              No scope questions for this template area. Add them under{" "}
                              <span className="font-medium">Setup → Scopes</span>, or use{" "}
                              <span className="font-medium">Add scope…</span> to attach a question
                              from any setup area.
                            </p>
                          )}
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
                                    return (
                                      <div
                                        key={lineRow.id}
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
                                          <span className={wbHdrLabel}>SKU</span>
                                          <div className={clSkuPickerWrapClass}>
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
                                              lockToSkuId={
                                                lineRow.scopeShowAllSku ? lineRow.skuId : null
                                              }
                                              onSelectSku={(pick) => {
                                                void applyLineSkuSelection(lineRow, pa, pick);
                                              }}
                                            />
                                          </div>
                                        </div>
                                        <label className={`${clMeasureFieldClass} ${clScopeMeasureColClass}`}>
                                          <span className={wbHdrLabel}>Measure</span>
                                          <ChecklistMeasureInput
                                            line={lineRow}
                                            quoteObject={qObj}
                                            pa={pa}
                                            project={project}
                                            measureKey={measureKey}
                                            inputClassName={clMeasureInput}
                                            disabled={lineSaving}
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
                                        <div className={`flex items-end justify-end pb-0.5 ${clScopeNonStdColClass}`}>
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
                                        </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null;
                          })()}
                          <div className="flex flex-wrap items-center justify-start gap-2 border-t border-sf-border pt-3 dark:border-zinc-700">
                            {checklistAreaAddButtons(pa, areaBusy)}
                            {checklistAreaRemoveButton(pa, areaBusy)}
                          </div>
                          <div className={wbAreaSectionStack}>
                            <h5 className={wbAreaSectionTitle}>Area notes</h5>
                            <textarea
                              key={areaFieldKey(pa, "notes")}
                              rows={3}
                              className={wbAreaFieldTextarea}
                              defaultValue={areaNotesCombined(pa)}
                              disabled={areaBusy}
                              placeholder="—"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey)
                                  (e.target as HTMLTextAreaElement).blur();
                              }}
                              onBlur={(e) => {
                                const next = e.target.value;
                                if (areaNotesCombinedMatches(pa, next)) return;
                                const { notes1, notes2 } = splitNotes(next);
                                void patchProjectArea(pa.id, {
                                  areanotes1: notes1,
                                  areanotes2: notes2,
                                });
                              }}
                            />
                          </div>
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
                        </td>
                      </tr>
                      </>
                    ) : null}
                    {mode !== "checklist" ? (
                      <>
                        {areaIndex > 0 ? (
                          <tr aria-hidden>
                            <td colSpan={WB_TABLE_COLS} className={wbAreaGapCell} />
                          </tr>
                        ) : null}
                        <tr className={wbAreaHdrBand}>
                      <td colSpan={2} className={wbAreaHdrCellOutlineFirst}>
                        <div className="flex min-w-0 flex-col justify-center">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                            Area
                          </span>
                          <span
                            className="mt-0.5 block text-[1.09375rem] font-semibold leading-snug text-sf-text dark:text-zinc-50"
                            title={projectAreaHeading(pa, areas)}
                          >
                            {projectAreaHeading(pa, areas)}
                          </span>
                        </div>
                      </td>
                      <td className={`${wbAreaHdrCellOutlineMid} pl-2.5`}>
                        <label className="flex min-w-0 flex-col gap-0.5">
                          <span className={wbHdrLabel}>Area m²</span>
                          <input
                            key={areaFieldKey(pa, "m2")}
                            type="text"
                            inputMode="decimal"
                            className={`${wbInputM2} w-full min-w-0`}
                            defaultValue={pa.aream2 ?? ""}
                            disabled={areaBusy}
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
                      </td>
                      <td className={`${wbAreaHdrCellOutlineMid} pl-2.5`}>
                        <label className="flex min-w-0 flex-col gap-0.5">
                          <span className={wbHdrLabel}>Elevate</span>
                          <CascadeElevateSelect
                            cascades={cascades}
                            priceLevels={priceLevels}
                            priceLevelId={pa.pricelevelid ?? null}
                            projectFinish={project?.projectfinish}
                            onChange={({ priceLevelId }) => {
                              void patchProjectArea(pa.id, { pricelevelid: priceLevelId });
                            }}
                            className={wbSelectRow}
                            disabled={areaBusy}
                            emptyLabel="Default (project)"
                          />
                        </label>
                      </td>
                      <td className={wbAreaHdrCellOutlineMid}>
                        <CascadeStyleColourFields
                          cascades={cascades}
                          level={cascadeLevelFromPriceLevel(
                            priceLevels,
                            pa.pricelevelid ?? project?.defaultpricelevelid,
                            project?.projectfinish,
                            cascades,
                          )}
                          style={pa.style ?? ""}
                          colourFilterStyle={effectiveCascadeStyleForArea(pa, project)}
                          colour={pa.colour ?? ""}
                          disabled={areaBusy}
                          selectClassName={wbSelectRow}
                          styleSelectClassName={wbSelectRow}
                          colourSelectClassName={wbSelectRow}
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
                            void patchProjectArea(pa.id, { colour: v ? v : null })
                          }
                        />
                      </td>
                      <td className={wbAreaHdrCellOutlineMid}>
                        <CascadeStyleColourFields
                          cascades={cascades}
                          level={cascadeLevelFromPriceLevel(
                            priceLevels,
                            pa.pricelevelid ?? project?.defaultpricelevelid,
                            project?.projectfinish,
                            cascades,
                          )}
                          style={pa.style ?? ""}
                          colourFilterStyle={effectiveCascadeStyleForArea(pa, project)}
                          colour={pa.colour ?? ""}
                          disabled={areaBusy}
                          selectClassName={wbSelectRow}
                          styleSelectClassName={wbSelectRow}
                          colourSelectClassName={wbSelectRow}
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
                            void patchProjectArea(pa.id, { colour: v ? v : null })
                          }
                        />
                      </td>
                      <td className={wbAreaHdrCellOutlineMid} />
                      <td className={wbAreaHdrCellOutlineMid} />
                      <td className={wbAreaHdrCellOutlineMid} />
                      <td className={wbAreaHdrCellOutlineMid} />
                      <td className={wbAreaHdrCellOutlineMidRight}>
                        <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                          Area subtotal
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-sf-text dark:text-zinc-100">
                          {hasIncludedMoney ? formatMoney(areaSubtotal) : "—"}
                        </span>
                      </td>
                      {WB_WORKBENCH_LABOUR_SILO_HEADERS.map(({ key, label, title }) => {
                        const hoursSum = areaLoadTotals[key];
                        const rate = contractLabourRateBySiloProduct(contractLabourRates, key);
                        const cost = labourSiloCostExcGst(hoursSum > 0 ? hoursSum : null, rate);
                        return (
                          <td
                            key={key}
                            className={wbAreaHdrCellOutlineMidRight}
                            title={title}
                          >
                            <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                              {label}
                            </span>
                            <WbLabourSiloValue
                              hours={hoursSum > 0 ? hoursSum : null}
                              cost={cost}
                            />
                          </td>
                        );
                      })}
                      <td className={wbAreaHdrCellOutlineMidRight}>
                        <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                          Final (incl. margin)
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                          {hasIncludedMoney ? formatMoney(areaFinalSubtotal) : "—"}
                        </span>
                      </td>
                      <td className={wbAreaHdrCellOutlineMid} />
                      <td colSpan={2} className={wbAreaHdrCellOutlineLast}>
                        <div className="flex flex-wrap items-center justify-end gap-1.5 pr-1">
                          <button
                            type="button"
                            onClick={() => openPickObjectModal(pa)}
                            disabled={areaBusy || paDeleting}
                            className="min-h-8 rounded border border-sf-border-strong bg-sf-surface px-2 py-1 text-xs font-medium text-sf-text hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                          >
                            Add object…
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaDeleteId(pa.id)}
                            disabled={areaBusy || paDeleting}
                            className={sfRowIconBtnDanger}
                            aria-label={`Remove area ${projectAreaHeading(pa, areas)}`}
                            title="Remove area from project"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
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
                      <th scope="col" className={thBaseWb}>
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
                        title="Line total including project margin"
                      >
                        Final price
                      </th>
                      <th scope="col" className={thBaseWb}>
                        Notes
                      </th>
                      <th scope="col" className={thBaseWb} title="Supplier for the line SKU">
                        Supplier
                      </th>
                      <th scope="col" className={wbSpacerCell} aria-hidden />
                        </tr>
                        {areaTopLines.length === 0 ? (
                          <tr className={areaObjectBand}>
                            <td colSpan={WB_TABLE_COLS} className={`${cellMuted} py-3 pl-8 text-xs`}>
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
                          areaTopLines.flatMap((row) => {
                        const included = row.included !== false;
                        const saving = rowSavingId === row.id;
                        const rowStyle = included
                          ? `${areaObjectBand} hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30`
                          : `${areaObjectBand} text-sf-text-weak opacity-60 dark:text-sf-text-weak`;
                        const lf = lineFinalPrice(row, marginPct);
                        const bundledRows = bundledByParentId.get(row.id) ?? [];

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
                            <td className={wbCellSku}>
                              {isBlindsSystemLine(row) ? (
                                <BlindsWorkbenchSkuLink
                                  line={row}
                                  disabled={saving}
                                  onOpen={() => setWbBlindsEditLineId(row.id)}
                                />
                              ) : (() => {
                                const qObj = quoteObjects.find(
                                  (o) => o.objectid === row.objectid,
                                );
                                if (!qObj) {
                                  return (
                                    <span className="text-xs text-sf-text-weak">—</span>
                                  );
                                }
                                return (
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
                                    disabled={saving}
                                    selectClassName={wbSelectRow}
                                    variant="compact"
                                    showSupplierPrice
                                    shortMatchLabels
                                    inlineRow
                                    autoApplySingleMatch
                                    autoApplyOnlyWhenEmptySku
                                    syncUnitPriceFromPick
                                    lockToSkuId={row.scopeShowAllSku ? row.skuId : null}
                                    showIncludeAllSupplierOptions={isAdminMode}
                                    includeAllSupplierOptions={includeAllSuppliersForLine(
                                      row.id,
                                    )}
                                    onIncludeAllSupplierOptionsChange={(checked) =>
                                      setIncludeAllSuppliersForLine(row.id, checked)
                                    }
                                    onSelectSku={(pick) => {
                                      void applyLineSkuSelection(row, pa, pick);
                                    }}
                                  />
                                );
                              })()}
                            </td>
                            <td className={wbCellMid}>
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
                                      row.custommeasure != null ? String(row.custommeasure) : "";
                                    return;
                                  }
                                  const next = parseOptionalNumber(raw);
                                  const prev = row.custommeasure ?? null;
                                  if (next === prev) return;
                                  void patchLineItem(row.id, { custommeasure: next });
                                }}
                              />
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
                            <td className={wbCellNum}>
                              {formatMoney(row.totalprice)}
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
                              className={`${wbCellNum} font-medium text-emerald-800 dark:text-emerald-200`}
                            >
                              {lf != null ? formatMoney(lf) : "—"}
                            </td>
                            <td className={`${wbCellMid} text-center`}>
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  className={lineNotesIconBtnClass(lineHasNotes(row))}
                                  disabled={saving || paoDeleting}
                                  title={lineNotesTooltip(row)}
                                  aria-label={`Notes for ${objectLabel(row, quoteObjects)}`}
                                  onClick={() =>
                                    setLineNotesModal({
                                      lineId: row.id,
                                      label: objectLabel(row, quoteObjects),
                                      draft: lineNotesCombined(row),
                                    })
                                  }
                                >
                                  <IconNotes
                                    className={`h-4 w-4 ${lineHasNotes(row) ? "text-sf-destructive dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPaoDeleteId(row.id)}
                                  disabled={saving || paoDeleting}
                                  className={sfRowIconBtnDanger}
                                  aria-label={`Remove ${objectLabel(row, quoteObjects)}`}
                                  title="Remove line from area"
                                >
                                  <IconTrash className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                            <WbLineSupplierCell
                              row={row}
                              suppliersBySkuId={suppliersBySkuId}
                              supplierDiscountByKey={supplierDiscountByKey}
                              cellClassName={wbCellMid}
                            />
                            <td className={wbSpacerCell} />
                          </tr>,
                          <ScopeLineBundledChildren
                            key={`${row.id}-bundled`}
                            mode="workbench"
                            bundledLines={bundledRows}
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
                          />,
                        ];
                          })
                        )}
                        <tr className={areaObjectBand}>
                          <td
                            colSpan={WB_TABLE_COLS}
                            className="border-x border-b border-sf-border px-3 py-3 align-top dark:border-zinc-700"
                          >
                            <div className="space-y-4">
                              <div className={wbAreaSectionStack}>
                                <h5 className={wbAreaSectionTitle}>Area notes</h5>
                                <textarea
                                  key={areaFieldKey(pa, "notes")}
                                  rows={2}
                                  className={wbAreaFieldTextarea}
                                  defaultValue={areaNotesCombined(pa)}
                                  disabled={areaBusy}
                                  placeholder="—"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.ctrlKey)
                                      (e.target as HTMLTextAreaElement).blur();
                                  }}
                                  onBlur={(e) => {
                                    const next = e.target.value;
                                    if (areaNotesCombinedMatches(pa, next)) return;
                                    const { notes1, notes2 } = splitNotes(next);
                                    void patchProjectArea(pa.id, {
                                      areanotes1: notes1,
                                      areanotes2: notes2,
                                    });
                                  }}
                                />
                              </div>
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
              {sortedProjectAreas.length > 0 ? (
              <tr className="border-t-2 border-t-zinc-400 bg-sf-page font-semibold dark:border-t-zinc-500 dark:bg-zinc-800">
                <td colSpan={10} className={`${cell} bg-sf-page text-right align-top dark:bg-zinc-800`}>
                  <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                    Project total (incl. lines)
                  </span>
                </td>
                <td
                  className={`${cell} bg-sf-page text-right align-top text-base tabular-nums dark:bg-zinc-800`}
                >
                  <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                    Line total
                  </span>
                  <span className="text-base font-semibold text-sf-text dark:text-zinc-100">
                    {formatMoney(grandTotal)}
                  </span>
                </td>
                {WB_WORKBENCH_LABOUR_SILO_HEADERS.map(({ key, label, title }) => {
                  const hoursSum = projectLoadTotals[key];
                  const rate = contractLabourRateBySiloProduct(contractLabourRates, key);
                  const cost = labourSiloCostExcGst(hoursSum > 0 ? hoursSum : null, rate);
                  return (
                    <td
                      key={key}
                      className={`${cell} bg-sf-page text-right align-top dark:bg-zinc-800`}
                      title={title}
                    >
                      <span className="block text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                        {label}
                      </span>
                      <WbLabourSiloValue
                        hours={hoursSum > 0 ? hoursSum : null}
                        cost={cost}
                      />
                    </td>
                  );
                })}
                <td
                  className={`${cell} bg-sf-page text-right align-top text-base tabular-nums text-emerald-900 dark:text-emerald-100 dark:bg-zinc-800`}
                >
                  <span className="block text-xs font-medium uppercase tracking-wide text-emerald-900/80 dark:text-emerald-200/90">
                    Final price
                  </span>
                  <span className="text-base font-semibold">
                    {formatMoney(grandFinalTotal)}
                  </span>
                </td>
                <td className={`${cell} bg-sf-page dark:bg-zinc-800`} />
                <td className={`${cell} bg-sf-page dark:bg-zinc-800`} />
                <td className={`${wbSpacerCell} bg-sf-page dark:bg-zinc-800`} />
              </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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

      {lineNotesModal ? (
        <ModalFrame
          title={`Line notes — ${lineNotesModal.label}`}
          description="Notes for this quote line on the project (not area notes)."
          onClose={() => {
            if (rowSavingId === lineNotesModal.lineId) return;
            setLineNotesModal(null);
          }}
          wide
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  if (rowSavingId === lineNotesModal.lineId) return;
                  setLineNotesModal(null);
                }}
                disabled={rowSavingId === lineNotesModal.lineId}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rowSavingId === lineNotesModal.lineId}
                className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
                onClick={() => {
                  const row = allObjects.find((o) => o.id === lineNotesModal.lineId);
                  const { notes1, notes2 } = splitNotes(lineNotesModal.draft);
                  if (
                    row &&
                    notes1 === (row.notes1 ?? "") &&
                    notes2 === (row.notes2 ?? "")
                  ) {
                    setLineNotesModal(null);
                    return;
                  }
                  void patchLineItem(lineNotesModal.lineId, { notes1, notes2 }).then(() => {
                    setLineNotesModal(null);
                  });
                }}
              >
                {rowSavingId === lineNotesModal.lineId ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <textarea
            className={`${inputLong} min-h-[10rem] w-full resize-y`}
            rows={6}
            value={lineNotesModal.draft}
            disabled={rowSavingId === lineNotesModal.lineId}
            placeholder="Line notes…"
            onChange={(e) =>
              setLineNotesModal((prev) =>
                prev ? { ...prev, draft: e.target.value } : prev,
              )
            }
          />
        </ModalFrame>
      ) : null}

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
                  Area name on this project (optional)
                </span>
                <input
                  value={addAreaDisplayName}
                  onChange={(e) => setAddAreaDisplayName(e.target.value)}
                  placeholder="e.g. Master bedroom, Bedroom 2"
                  className={addAreaModalInputClass}
                />
                <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
                  Leave blank to use the template name only (fine for a single kitchen, etc.).
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
        quoteObjects={quoteObjects}
        saving={pickObjectSaving}
        onClose={closePickObjectModal}
        onPick={(id) => void addLineItemFromQuoteObject(id)}
      />

      <AddScopePickerModal
        open={pickScopeOpen && Boolean(pickScopeArea)}
        areaLabel={
          pickScopeArea ? projectAreaHeading(pickScopeArea, areas) : ""
        }
        scopes={scopePickerCandidates}
        areas={areas}
        saving={pickScopeSaving}
        onClose={closePickScopeModal}
        onPick={(id) => void addScopeToAreaFromPicker(id)}
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
    </div>
  );
}
