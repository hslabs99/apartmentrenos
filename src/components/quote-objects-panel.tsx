"use client";

import { CreateScopesFromDataObjectsModal } from "@/components/create-scopes-from-data-objects-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ScopeFormModal } from "@/components/scope-form-modal";
import { IconCopy, IconDotsHorizontal, IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { ModalFrame } from "@/components/modal-frame";
import { readApiJson } from "@/lib/client/read-api-json";
import { scopeBuilderRowsFromQuoteObjects } from "@/lib/client/scope-builder-selection";
import { scopeLinksForQuoteObject } from "@/lib/client/scope-questions-for-data-object";
import {
  type QuoteObjectImportRow,
  triageAndParseQuoteObjectsImport,
} from "@/lib/quote-objects-import-parse";
import { downloadQuoteObjectsImportTemplateXlsx } from "@/lib/quote-objects-import-template-xlsx";
import { sortPriceLevelsPublic } from "@/lib/sort-price-levels";
import {
  sfDataSurface,
  sfNeutralToolbarButton,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import { LOOKUP_TYPE_OBJECT_CATEGORY } from "@/lib/lookup-types";
import type { AreaPublic } from "@/types/area";
import type { LookupPublic } from "@/types/lookup";
import type { PriceLevelPublic } from "@/types/price-level";
import type {
  QuoteObjectInheritM2Source,
  QuoteObjectPublic,
} from "@/types/quote-object";
import {
  QUOTE_OBJECT_INHERIT_M2_LABELS,
  QUOTE_OBJECT_INHERIT_M2_SOURCES,
} from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mode = "idle" | "create" | "edit";

const DEFAULT_OBJECT_TYPE = "Unit";
/** Carpet roll LM from checklist area m² (see `effectiveMeasurementForQuoteLine` on server). */
const LM_RUNS_UOM = "LM-Runs";
const DEFAULT_LM_RUNS_RUN_WIDTH = 3.2;

const UOM_OPTIONS = ["Unit", "M2", "M3", "LM", "LM-Runs", "Kg", "Ltr"] as const;

function uomSupportsInheritM2(uom: string): boolean {
  return uom === "M2" || uom === LM_RUNS_UOM;
}

/** Legacy tier pricing UI — hidden; existing tier data still loads/saves via levelDrafts. */
const SHOW_PRICE_LEVEL_PRICING_UI = false;

/** Positive finite number from loose string; empty → null. */
function parsePositiveAreaM2(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Effective roll width (m) for preview; matches server default when unset. */
function effectiveLmRunsRunWidthMForPreview(runWidthStr: string): number {
  const n = Number(runWidthStr.trim());
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_LM_RUNS_RUN_WIDTH;
}

type LmRunsBreakdown = {
  areaM2: number;
  runWidthM: number;
  sideM: number;
  runs: number;
  linealMetres: number;
};

function computeLmRunsBreakdown(areaM2: number, runWidthM: number): LmRunsBreakdown | null {
  if (!(areaM2 > 0) || !(runWidthM > 0)) return null;
  const sideM = Math.sqrt(areaM2);
  const runs = Math.ceil(sideM / runWidthM);
  const linealMetres = Math.round(runs * sideM * 100) / 100;
  return { areaM2, runWidthM, sideM, runs, linealMetres };
}

function computedLmFromLmRunsFormInputs(
  defaultAreaM2Str: string,
  runWidthStr: string,
): number | null {
  const m2 = parsePositiveAreaM2(defaultAreaM2Str);
  if (m2 == null) return null;
  return computeLmRunsBreakdown(m2, effectiveLmRunsRunWidthMForPreview(runWidthStr))
    ?.linealMetres ?? null;
}

type LevelDraft = {
  uompriceStr: string;
  totalpriceStr: string;
  spec1: string;
  spec2: string;
  spec3: string;
};

function emptyLevelDraft(): LevelDraft {
  return { uompriceStr: "", totalpriceStr: "", spec1: "", spec2: "", spec3: "" };
}

function buildEmptyLevelDrafts(priceLevels: PriceLevelPublic[]): Record<string, LevelDraft> {
  const out: Record<string, LevelDraft> = {};
  for (const pl of priceLevels) {
    if (pl.pricelevelid == null) continue;
    out[String(pl.pricelevelid)] = emptyLevelDraft();
  }
  return out;
}

function fillLevelDraftsFromQuote(
  r: QuoteObjectPublic,
  priceLevels: PriceLevelPublic[],
): Record<string, LevelDraft> {
  const d = buildEmptyLevelDrafts(priceLevels);
  if (r.priceLevelRows.length > 0) {
    for (const row of r.priceLevelRows) {
      const k = String(row.pricelevelid);
      if (!(k in d)) continue;
      d[k] = {
        uompriceStr: numToInput(row.uomprice),
        totalpriceStr: numToInput(row.totalprice),
        spec1: row.spec1,
        spec2: row.spec2,
        spec3: row.spec3,
      };
    }
  } else {
    for (const k of Object.keys(d)) {
      d[k] = {
        uompriceStr: numToInput(r.uomprice),
        totalpriceStr: numToInput(r.totalprice),
        spec1: r.spec1,
        spec2: r.spec2,
        spec3: r.spec3,
      };
    }
  }
  return d;
}

/** Measurement used for tier preview total = meas × UOM price (aligned with LM-Runs default LM). */
function effectiveMeasurementForTierRecalc(r: QuoteObjectPublic): number | null {
  const u = r.uom || "Unit";
  if (u === LM_RUNS_UOM) {
    const lm = computedLmFromLmRunsFormInputs(
      r.defaultAreaM2 != null && r.defaultAreaM2 > 0 ? String(r.defaultAreaM2) : "",
      r.runWidth != null && r.runWidth > 0 ? String(r.runWidth) : "",
    );
    if (lm != null) return lm;
    if (r.measurement != null && Number.isFinite(r.measurement)) return r.measurement;
    return null;
  }
  if (r.measurement != null && Number.isFinite(r.measurement)) return r.measurement;
  return null;
}

/** After import, tier totals may be null; fill empty totals as measurement × UOM price when possible. */
function recalcEmptyTierTotalsFromMeasurement(
  drafts: Record<string, LevelDraft>,
  sortedPriceLevels: PriceLevelPublic[],
  uom: string,
  isInheritingM2: boolean,
  effectiveMeasurement: number | null,
): Record<string, LevelDraft> {
  if (uom === "M2" && isInheritingM2) return drafts;
  if (effectiveMeasurement == null || !Number.isFinite(effectiveMeasurement)) return drafts;
  const next: Record<string, LevelDraft> = { ...drafts };
  for (const pl of sortedPriceLevels) {
    if (pl.pricelevelid == null) continue;
    const k = String(pl.pricelevelid);
    const d = next[k] ?? emptyLevelDraft();
    if (d.totalpriceStr.trim() !== "") continue;
    const up = Number(d.uompriceStr);
    if (!Number.isFinite(up)) continue;
    next[k] = { ...d, totalpriceStr: String(effectiveMeasurement * up) };
  }
  return next;
}

function toNumOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error("Numeric fields must be valid numbers");
  return n;
}

function numToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function formatNzDollars(n: number): string {
  return `$${n.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cmpLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/** Same shape as Setup → Scopes save: one “Yes” answer with this quote object on every price tier. */
function buildCreateScopePayload(
  areaDocId: string,
  question: string,
  quoteObjectDocId: string,
  priceLevels: PriceLevelPublic[],
) {
  const sorted = sortPriceLevelsPublic(priceLevels).filter(
    (pl): pl is PriceLevelPublic & { pricelevelid: number } => pl.pricelevelid != null,
  );
  const pick = `qo:${quoteObjectDocId}`;
  return {
    areaDocId,
    question: question.trim(),
    answers: [
      {
        answerid: crypto.randomUUID(),
        label: "Yes",
        byPriceLevel: sorted.map((pl) => ({
          pricelevelid: pl.pricelevelid,
          objectPickOrder: [pick],
        })),
      },
    ],
  };
}

function InvestorTierOverflowMenu({
  disabled,
  onSendToAllPls,
}: {
  disabled?: boolean;
  onSendToAllPls: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-label="First price tier actions"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded border border-sf-border bg-sf-surface text-sf-text-weak shadow-sm hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <IconDotsHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={disabled}
            title={
              disabled
                ? "Configure the first price tier (top of System → Price Levels order), then copy to the rest."
                : "Copy UOM price, total, and specs from this tier to every other price level."
            }
            onClick={() => {
              setOpen(false);
              onSendToAllPls();
            }}
          >
            Send to all PLs
          </button>
        </div>
      ) : null}
    </div>
  );
}

function QuoteObjectFormOverflowMenu({
  disabled,
  onCreateScope,
}: {
  disabled?: boolean;
  onCreateScope: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-label="More quote object actions"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded border border-sf-border bg-sf-surface text-sf-text-weak shadow-sm hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <IconDotsHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={disabled}
            title={
              disabled
                ? "Tag at least one area on this object before creating a scope."
                : undefined
            }
            onClick={() => {
              setOpen(false);
              onCreateScope();
            }}
          >
            Create Scope
          </button>
        </div>
      ) : null}
    </div>
  );
}

function QuoteObjectsImportMenu({
  disabled,
  onImport,
}: {
  disabled?: boolean;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-label="Quote object import actions"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-sf-border bg-sf-surface text-sf-text-weak shadow-sm hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <IconDotsHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              void downloadQuoteObjectsImportTemplateXlsx();
            }}
          >
            Download Template
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={disabled}
            title="Upload the filled template and import quote objects."
            onClick={() => {
              setOpen(false);
              onImport();
            }}
          >
            Import Objects
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function QuoteObjectsPanel() {
  const [rows, setRows] = useState<QuoteObjectPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);

  const [objectname, setObjectname] = useState("");
  const [product, setProduct] = useState("");
  const [uom, setUom] = useState("Unit");
  const [inheritM2Source, setInheritM2Source] = useState<QuoteObjectInheritM2Source>("none");
  const [measurementStr, setMeasurementStr] = useState("");
  const [runWidthStr, setRunWidthStr] = useState("");
  /** For LM-Runs: saved default room area (m²); with run width derives default measurement (LM). */
  const [defaultAreaM2Str, setDefaultAreaM2Str] = useState("");
  const [priceLevels, setPriceLevels] = useState<PriceLevelPublic[]>([]);
  const [levelDrafts, setLevelDrafts] = useState<Record<string, LevelDraft>>({});
  const [notes1, setNotes1] = useState("");
  const [notes2, setNotes2] = useState("");
  const [tooltip, setTooltip] = useState("");
  const [category, setCategory] = useState("");
  const [areaTagIds, setAreaTagIds] = useState<string[]>([]);
  const [areaPickerKey, setAreaPickerKey] = useState(0);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [lookups, setLookups] = useState<LookupPublic[]>([]);
  const [tableFilter, setTableFilter] = useState("");
  /** Column filter: "" = all, "__none__" = no category, else exact category string. */
  const [tableFilterCategory, setTableFilterCategory] = useState<"" | "__none__" | string>("");
  /** Column filter: area template doc id, or "" = any. */
  const [tableFilterAreaTagId, setTableFilterAreaTagId] = useState("");

  const normalizeUom = useCallback((v: unknown): string => {
    const s = String(v ?? "");
    return s.trim();
  }, []);

  const [scopes, setScopes] = useState<ScopePublic[]>([]);
  const [bulkCreateScopesOpen, setBulkCreateScopesOpen] = useState(false);
  const [editScopeDocId, setEditScopeDocId] = useState<string | null>(null);
  const [createScopeOpen, setCreateScopeOpen] = useState(false);
  const [createScopeQuestion, setCreateScopeQuestion] = useState("");
  const [createScopeDialogError, setCreateScopeDialogError] = useState<string | null>(null);
  const [creatingScope, setCreatingScope] = useState(false);

  const IMPORT_BATCH_SIZE = 8;

  const [importModalOpen, setImportModalOpen] = useState(false);
  /** idle | triaged | importing | done */
  const [importPhase, setImportPhase] = useState<"idle" | "triaged" | "importing" | "done">("idle");
  const [importFileLabel, setImportFileLabel] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<QuoteObjectImportRow[] | null>(null);
  const [importTriageError, setImportTriageError] = useState<string | null>(null);
  const [importTriageSheet, setImportTriageSheet] = useState<string | null>(null);
  const [importTriageWarnings, setImportTriageWarnings] = useState<string[]>([]);
  const [importProgressPct, setImportProgressPct] = useState(0);
  const [importReport, setImportReport] = useState<{
    created: number;
    updated: number;
    errorCount: number;
    errors: string[];
  } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  function openImportModal() {
    setImportModalOpen(true);
    setImportPhase("idle");
    setImportFileLabel(null);
    setImportRows(null);
    setImportTriageError(null);
    setImportTriageSheet(null);
    setImportTriageWarnings([]);
    setImportProgressPct(0);
    setImportReport(null);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  }

  function closeImportModal() {
    if (importPhase === "importing") return;
    setImportModalOpen(false);
    setImportPhase("idle");
    setImportFileLabel(null);
    setImportRows(null);
    setImportTriageError(null);
    setImportTriageSheet(null);
    setImportTriageWarnings([]);
    setImportProgressPct(0);
    setImportReport(null);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  }

  async function onImportFileSelected(file: File) {
    setImportTriageError(null);
    setImportRows(null);
    setImportReport(null);
    setImportPhase("idle");
    setImportFileLabel(file.name);
    setImportProgressPct(0);
    try {
      const buf = await file.arrayBuffer();
      const triage = await triageAndParseQuoteObjectsImport(buf);
      if (!triage.ok) {
        setImportTriageError(triage.error ?? "Invalid file.");
        setImportTriageSheet(triage.sheetName ?? null);
        setImportTriageWarnings([]);
        return;
      }
      setImportTriageSheet(triage.sheetName ?? null);
      setImportTriageWarnings(triage.warnings ?? []);
      setImportRows(triage.rows ?? []);
      setImportPhase("triaged");
    } catch (e) {
      setImportTriageError(e instanceof Error ? e.message : "Could not read file.");
      setImportTriageSheet(null);
      setImportTriageWarnings([]);
    }
  }

  async function runImportBatches() {
    if (!importRows?.length) return;
    setError(null);
    setImportPhase("importing");
    setImportProgressPct(0);
    setImportReport(null);
    let created = 0;
    let updated = 0;
    const allErrors: string[] = [];
    const total = importRows.length;
    try {
      for (let i = 0; i < total; i += IMPORT_BATCH_SIZE) {
        const batch = importRows.slice(i, i + IMPORT_BATCH_SIZE);
        setImportProgressPct(Math.round((i / total) * 100));
        const res = await fetch("/api/quote-objects/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        });
        const data = await readApiJson<{
          created?: number;
          updated?: number;
          errorCount?: number;
          errors?: string[];
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        created += data.created ?? 0;
        updated += data.updated ?? 0;
        if (Array.isArray(data.errors)) allErrors.push(...data.errors);
        setImportProgressPct(Math.round((Math.min(i + IMPORT_BATCH_SIZE, total) / total) * 100));
      }
      setImportProgressPct(100);
      setImportReport({
        created,
        updated,
        errorCount: allErrors.length,
        errors: allErrors,
      });
      setImportPhase("done");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setImportPhase("triaged");
      setImportProgressPct(0);
    }
  }

  const sortedPriceLevels = useMemo(
    () => sortPriceLevelsPublic(priceLevels),
    [priceLevels],
  );

  const lmRunsDefaultBreakdown = useMemo(() => {
    if (uom !== LM_RUNS_UOM) return null;
    const areaM2 = parsePositiveAreaM2(defaultAreaM2Str);
    if (areaM2 == null) return null;
    const runWidthM = effectiveLmRunsRunWidthMForPreview(runWidthStr);
    return computeLmRunsBreakdown(areaM2, runWidthM);
  }, [uom, defaultAreaM2Str, runWidthStr]);

  useEffect(() => {
    if (uom !== LM_RUNS_UOM) return;
    const lm = computedLmFromLmRunsFormInputs(defaultAreaM2Str, runWidthStr);
    if (lm == null) return;
    setMeasurementStr(String(lm));
  }, [uom, defaultAreaM2Str, runWidthStr]);

  /** First row in System → Price Levels display order (e.g. Investor when listed first). */
  const investorPriceLevelKey = useMemo(() => {
    const first = sortedPriceLevels.find((p) => p.pricelevelid != null);
    return first ? String(first.pricelevelid) : null;
  }, [sortedPriceLevels]);

  const sendInvestorTierToAllPriceLevels = useCallback(() => {
    if (!investorPriceLevelKey) return;
    setLevelDrafts((prev) => {
      const src = prev[investorPriceLevelKey] ?? emptyLevelDraft();
      const next = { ...prev };
      for (const pl of sortedPriceLevels) {
        if (pl.pricelevelid == null) continue;
        const k = String(pl.pricelevelid);
        if (k === investorPriceLevelKey) continue;
        next[k] = { ...src };
      }
      return next;
    });
  }, [investorPriceLevelKey, sortedPriceLevels]);

  const recalcTierTotalFromMeasurement = useCallback(
    (pk: string) => {
      if ((uom === "M2" || uom === LM_RUNS_UOM) && inheritM2Source !== "none") return;
      setLevelDrafts((prev) => {
        const cur = prev[pk] ?? emptyLevelDraft();
        const m = Number(measurementStr);
        const up = Number(cur.uompriceStr);
        const tc = Number.isFinite(m) && Number.isFinite(up) ? m * up : null;
        if (tc === null) return prev;
        return { ...prev, [pk]: { ...cur, totalpriceStr: String(tc) } };
      });
    },
    [uom, inheritM2Source, measurementStr],
  );

  const areaById = useMemo(() => {
    const m = new Map<string, AreaPublic>();
    for (const a of areas) m.set(a.id, a);
    return m;
  }, [areas]);

  const objectCategoryLookups = useMemo(
    () =>
      lookups
        .filter((l) => l.lookuptype === LOOKUP_TYPE_OBJECT_CATEGORY)
        .sort((a, b) =>
          a.lookupvalue.localeCompare(b.lookupvalue, undefined, { sensitivity: "base" }),
        ),
    [lookups],
  );

  const areasToAdd = useMemo(
    () =>
      [...areas]
        .filter((a) => !areaTagIds.includes(a.id))
        .sort((x, y) =>
          x.areaname.localeCompare(y.areaname, undefined, { sensitivity: "base" }),
        ),
    [areas, areaTagIds],
  );

  const categoryFilterOptions = useMemo(() => {
    const fromLookupsRaw = objectCategoryLookups
      .map((l) => l.lookupvalue.trim())
      .filter(Boolean);
    const fromLookups: string[] = [];
    const set = new Set<string>();
    for (const v of fromLookupsRaw) {
      if (set.has(v)) continue;
      set.add(v);
      fromLookups.push(v);
    }
    const savedOnly: string[] = [];
    for (const r of rows) {
      const c = r.category?.trim();
      if (!c) continue;
      if (set.has(c)) continue;
      set.add(c);
      savedOnly.push(c);
    }
    savedOnly.sort((a, b) => cmpLocale(a, b));
    return [
      ...fromLookups.map((v) => ({ value: v, label: v })),
      ...savedOnly.map((v) => ({ value: v, label: `${v} (saved)` })),
    ];
  }, [objectCategoryLookups, rows]);

  const areasSortedByName = useMemo(
    () =>
      [...areas].sort((a, b) =>
        a.areaname.localeCompare(b.areaname, undefined, { sensitivity: "base" }),
      ),
    [areas],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qoRes, scopeRes] = await Promise.all([
        fetch("/api/quote-objects"),
        fetch("/api/scopes"),
      ]);
      const data = await readApiJson<{ quoteObjects?: QuoteObjectPublic[]; error?: string }>(
        qoRes,
      );
      const scopeData = await readApiJson<{ scopes?: ScopePublic[]; error?: string }>(scopeRes);
      if (!qoRes.ok) throw new Error(data.error ?? "Failed to load quote objects");
      if (!scopeRes.ok) throw new Error(scopeData.error ?? "Failed to load scopes");
      setRows(data.quoteObjects ?? []);
      setScopes(scopeData.scopes ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load quote objects");
      setRows([]);
      setScopes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshScopes = useCallback(async () => {
    const scopeRes = await fetch("/api/scopes");
    const scopeData = await readApiJson<{ scopes?: ScopePublic[]; error?: string }>(scopeRes);
    if (!scopeRes.ok) throw new Error(scopeData.error ?? "Failed to load scopes");
    setScopes(scopeData.scopes ?? []);
  }, []);

  const selectedQuoteRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  const selectionRowsForScopes = useMemo(
    () => scopeBuilderRowsFromQuoteObjects(selectedQuoteRows),
    [selectedQuoteRows],
  );

  function openBulkCreateScopesModal() {
    if (selectedIds.size === 0) return;
    setBulkCreateScopesOpen(true);
  }

  function onBulkScopesCreated(newScopes: ScopePublic[]) {
    setScopes((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      for (const s of newScopes) byId.set(s.id, s);
      return [...byId.values()].sort((a, b) =>
        (a.question ?? "").localeCompare(b.question ?? "", undefined, { sensitivity: "base" }),
      );
    });
  }

  const areaTagsFilterText = useCallback(
    (r: QuoteObjectPublic) => {
      return (r.areaTagIds ?? [])
        .map((id) => {
          const name = areaById.get(id)?.areaname?.trim();
          return name || id;
        })
        .join(" ")
        .toLowerCase();
    },
    [areaById],
  );

  const displayRows = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    let filtered =
      q.length === 0
        ? rows
        : rows.filter(
            (r) =>
              r.objectname.toLowerCase().includes(q) ||
              (r.product || "").toLowerCase().includes(q) ||
              r.objecttype.toLowerCase().includes(q) ||
              (r.category || "").toLowerCase().includes(q) ||
              areaTagsFilterText(r).includes(q) ||
              String(r.objectid ?? "").includes(q),
          );

    if (tableFilterCategory === "__none__") {
      filtered = filtered.filter((r) => !r.category?.trim());
    } else if (tableFilterCategory) {
      filtered = filtered.filter((r) => (r.category ?? "").trim() === tableFilterCategory);
    }
    if (tableFilterAreaTagId) {
      filtered = filtered.filter((r) => (r.areaTagIds ?? []).includes(tableFilterAreaTagId));
    }

    return filtered;
  }, [rows, tableFilter, tableFilterCategory, tableFilterAreaTagId, areaTagsFilterText]);

  const allVisibleSelected =
    displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.id));
  const someVisibleSelected = displayRows.some((r) => selectedIds.has(r.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of displayRows) next.delete(r.id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of displayRows) next.add(r.id);
      return next;
    });
  };

  const requestDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setPendingDeleteIds([...selectedIds]);
  };

  const loadPriceLevels = useCallback(async () => {
    const initRes = await fetch("/api/price-levels/init", { method: "POST" });
    const initData = await readApiJson<{ error?: string }>(initRes);
    if (!initRes.ok) {
      throw new Error(initData.error ?? "Failed to initialize price levels");
    }
    const res = await fetch("/api/price-levels");
    const data = await readApiJson<{ priceLevels?: PriceLevelPublic[]; error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to load price levels");
    setPriceLevels(data.priceLevels ?? []);
  }, []);

  const loadAreas = useCallback(async () => {
    const initRes = await fetch("/api/areas/init", { method: "POST" });
    const initData = await readApiJson<{ error?: string }>(initRes);
    if (!initRes.ok) {
      throw new Error(initData.error ?? "Failed to initialize areas collection");
    }
    const res = await fetch("/api/areas");
    const data = await readApiJson<{ areas?: AreaPublic[]; error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to load areas");
    setAreas(data.areas ?? []);
  }, []);

  const loadLookups = useCallback(async () => {
    const initRes = await fetch("/api/lookups/init", { method: "POST" });
    const initData = await readApiJson<{ error?: string }>(initRes);
    if (!initRes.ok) {
      throw new Error(initData.error ?? "Failed to initialize lookups collection");
    }
    const res = await fetch("/api/lookups");
    const data = await readApiJson<{ lookups?: LookupPublic[]; error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to load lookups");
    setLookups(data.lookups ?? []);
  }, []);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/quote-objects/init", { method: "POST" });
        const initData = await readApiJson<{ error?: string }>(initRes);
        if (!initRes.ok) {
          setError(
            initData.error ??
              "Failed to initialize quote objects collection in Firestore",
          );
          setRows([]);
          setLoading(false);
          return;
        }
        try {
          await loadPriceLevels();
        } catch (plErr) {
          console.error(plErr);
          setPriceLevels([]);
        }
        try {
          await loadLookups();
        } catch (luErr) {
          console.error(luErr);
          setLookups([]);
        }
        try {
          await loadAreas();
        } catch (arErr) {
          console.error(arErr);
          setAreas([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setRows([]);
        setLoading(false);
        return;
      }
      await load();
    }
    void bootstrapThenLoad();
  }, [load, loadAreas, loadLookups, loadPriceLevels]);

  useEffect(() => {
    setLevelDrafts((prev) => {
      const next = { ...prev };
      for (const pl of priceLevels) {
        if (pl.pricelevelid == null) continue;
        const k = String(pl.pricelevelid);
        if (!(k in next)) next[k] = emptyLevelDraft();
      }
      return next;
    });
  }, [priceLevels]);

  useEffect(() => {
    if (uom !== "M2" && uom !== LM_RUNS_UOM) setInheritM2Source("none");
  }, [uom]);

  useEffect(() => {
    if (uom !== LM_RUNS_UOM) return;
    setRunWidthStr((prev) =>
      prev.trim() === "" ? String(DEFAULT_LM_RUNS_RUN_WIDTH) : prev,
    );
  }, [uom]);

  function openCreate() {
    setEditingId(null);
    setObjectname("");
    setProduct("");
    setUom("Unit");
    setInheritM2Source("none");
    setMeasurementStr("");
    setRunWidthStr("");
    setDefaultAreaM2Str("");
    setLevelDrafts(buildEmptyLevelDrafts(priceLevels));
    setNotes1("");
    setNotes2("");
    setTooltip("");
    setCategory("");
    setAreaTagIds([]);
    setAreaPickerKey((k) => k + 1);
    setMode("create");
  }

  function openEdit(r: QuoteObjectPublic) {
    setEditingId(r.id);
    setObjectname(r.objectname);
    setProduct(r.product ?? "");
    setUom(normalizeUom(r.uom || "Unit") || "Unit");
    {
      const nu = normalizeUom(r.uom || "Unit") || "Unit";
      setInheritM2Source(
        uomSupportsInheritM2(nu) ? r.inheritM2Source ?? "none" : "none",
      );
    }
    setMeasurementStr(numToInput(r.measurement));
    setRunWidthStr(
      (r.uom || "") === LM_RUNS_UOM
        ? r.runWidth != null && r.runWidth > 0
          ? String(r.runWidth)
          : String(DEFAULT_LM_RUNS_RUN_WIDTH)
        : "",
    );
    setDefaultAreaM2Str(
      (r.uom || "") === LM_RUNS_UOM && r.defaultAreaM2 != null && r.defaultAreaM2 > 0
        ? String(r.defaultAreaM2)
        : "",
    );
    const baseDrafts = fillLevelDraftsFromQuote(r, priceLevels);
    const effM = effectiveMeasurementForTierRecalc(r);
    setLevelDrafts(
      recalcEmptyTierTotalsFromMeasurement(
        baseDrafts,
        sortedPriceLevels,
        r.uom || "Unit",
        uomSupportsInheritM2(r.uom || "Unit") &&
          (r.inheritM2Source ?? "none") !== "none",
        effM,
      ),
    );
    setNotes1(r.notes1);
    setNotes2(r.notes2);
    setTooltip(r.tooltip);
    setCategory(r.category ?? "");
    setAreaTagIds([...(r.areaTagIds ?? [])]);
    setAreaPickerKey((k) => k + 1);
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
    setDefaultAreaM2Str("");
    setCreateScopeOpen(false);
    setCreateScopeQuestion("");
    setCreateScopeDialogError(null);
    setCreatingScope(false);
  }

  function openCreateScopeDialog() {
    setCreateScopeQuestion(objectname.trim());
    setCreateScopeDialogError(null);
    setCreateScopeOpen(true);
  }

  async function submitCreateScope() {
    const q = createScopeQuestion.trim();
    if (!q) {
      setCreateScopeDialogError("Enter a scope question.");
      return;
    }
    if (!editingId) return;
    const firstAreaDocId = areaTagIds[0];
    if (!firstAreaDocId) {
      setCreateScopeDialogError("Tag at least one area on this quote object first.");
      return;
    }
    const tiers = sortedPriceLevels.filter((pl) => pl.pricelevelid != null);
    if (tiers.length === 0) {
      setCreateScopeDialogError("No price levels are configured.");
      return;
    }
    setCreatingScope(true);
    setCreateScopeDialogError(null);
    setError(null);
    try {
      const initRes = await fetch("/api/scopes/init", { method: "POST" });
      const initData = await readApiJson<{ error?: string }>(initRes);
      if (!initRes.ok) {
        throw new Error(initData.error ?? "Failed to initialize scopes collection");
      }
      const payload = buildCreateScopePayload(firstAreaDocId, q, editingId, priceLevels);
      const res = await fetch("/api/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<{ error?: string; details?: unknown }>(res);
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.details ?? data);
        throw new Error(msg);
      }
      setCreateScopeOpen(false);
      setCreateScopeQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create scope");
    } finally {
      setCreatingScope(false);
    }
  }

  function buildPayload(): Record<string, unknown> {
    const priceLevelRows = sortedPriceLevels
      .filter((pl) => pl.pricelevelid != null)
      .map((pl) => {
        const k = String(pl.pricelevelid);
        const d = levelDrafts[k] ?? emptyLevelDraft();
        return {
          pricelevelid: pl.pricelevelid as number,
          uomprice: toNumOrNull(d.uompriceStr),
          totalprice: toNumOrNull(d.totalpriceStr),
          spec1: d.spec1,
          spec2: d.spec2,
          spec3: d.spec3,
        };
      });
    const runWidthParsed = toNumOrNull(runWidthStr);
    const defaultM2Parsed = parsePositiveAreaM2(defaultAreaM2Str);
    const computedLm =
      uom === LM_RUNS_UOM
        ? computedLmFromLmRunsFormInputs(defaultAreaM2Str, runWidthStr)
        : null;
    const measurement =
      uom === LM_RUNS_UOM
        ? computedLm != null
          ? computedLm
          : toNumOrNull(measurementStr)
        : toNumOrNull(measurementStr);
    return {
      objectname,
      product,
      objecttype: DEFAULT_OBJECT_TYPE,
      category,
      areaTagIds,
      uom: normalizeUom(uom) || "Unit",
      inheritM2Source: uom === "M2" || uom === LM_RUNS_UOM ? inheritM2Source : "none",
      runWidth:
        uom === LM_RUNS_UOM
          ? runWidthParsed != null && runWidthParsed > 0
            ? runWidthParsed
            : null
          : null,
      defaultAreaM2: uom === LM_RUNS_UOM ? defaultM2Parsed : null,
      measurement,
      priceLevelRows,
      notes1,
      notes2,
      tooltip,
    };
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (mode === "create") {
        const res = await fetch("/api/quote-objects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await readApiJson<{ error?: string; details?: unknown }>(res);
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      } else if (mode === "edit" && editingId) {
        const res = await fetch(`/api/quote-objects/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await readApiJson<{ error?: string; details?: unknown }>(res);
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function cloneObject(r: QuoteObjectPublic) {
    const name = `${r.objectname} (copy)`;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        objectname: name,
        product: r.product ?? "",
        objecttype: DEFAULT_OBJECT_TYPE,
        category: r.category ?? "",
        areaTagIds: [...(r.areaTagIds ?? [])],
        uom: r.uom || "Unit",
        inheritM2Source:
          (r.uom || "Unit") === "M2"
            ? r.inheritM2Source ?? "none"
            : "none",
        runWidth:
          (r.uom || "") === LM_RUNS_UOM &&
          r.runWidth != null &&
          r.runWidth > 0
            ? r.runWidth
            : null,
        defaultAreaM2:
          (r.uom || "") === LM_RUNS_UOM &&
          r.defaultAreaM2 != null &&
          r.defaultAreaM2 > 0
            ? r.defaultAreaM2
            : null,
        measurement: r.measurement ?? null,
        priceLevelRows:
          r.priceLevelRows.length > 0
            ? r.priceLevelRows.map((row) => ({
                pricelevelid: row.pricelevelid,
                uomprice: row.uomprice,
                totalprice: row.totalprice,
                spec1: row.spec1,
                spec2: row.spec2,
                spec3: row.spec3,
              }))
            : sortedPriceLevels
                .filter((pl) => pl.pricelevelid != null)
                .map((pl) => ({
                  pricelevelid: pl.pricelevelid as number,
                  uomprice: r.uomprice ?? null,
                  totalprice: r.totalprice ?? null,
                  spec1: r.spec1,
                  spec2: r.spec2,
                  spec3: r.spec3,
                })),
        notes1: r.notes1,
        notes2: r.notes2,
        tooltip: r.tooltip,
      };
      const res = await fetch("/api/quote-objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<{
        error?: string;
        details?: unknown;
        id?: string;
        objectid?: number;
      }>(res);
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.details ?? data);
        throw new Error(msg);
      }
      await load();
      if (data.id) {
        setEditingId(data.id);
        setObjectname(name);
        setUom(normalizeUom(r.uom || "Unit") || "Unit");
        {
          const nu = normalizeUom(r.uom || "Unit") || "Unit";
          setInheritM2Source(
            uomSupportsInheritM2(nu) ? r.inheritM2Source ?? "none" : "none",
          );
        }
        setMeasurementStr(numToInput(r.measurement));
        setRunWidthStr(
          (r.uom || "") === LM_RUNS_UOM
            ? r.runWidth != null && r.runWidth > 0
              ? String(r.runWidth)
              : String(DEFAULT_LM_RUNS_RUN_WIDTH)
            : "",
        );
        setDefaultAreaM2Str(
          (r.uom || "") === LM_RUNS_UOM && r.defaultAreaM2 != null && r.defaultAreaM2 > 0
            ? String(r.defaultAreaM2)
            : "",
        );
        const cloneDrafts = fillLevelDraftsFromQuote(r, priceLevels);
        const cloneEffM = effectiveMeasurementForTierRecalc(r);
        setLevelDrafts(
          recalcEmptyTierTotalsFromMeasurement(
            cloneDrafts,
            sortedPriceLevels,
            r.uom || "Unit",
            uomSupportsInheritM2(r.uom || "Unit") &&
              (r.inheritM2Source ?? "none") !== "none",
            cloneEffM,
          ),
        );
        setNotes1(r.notes1);
        setNotes2(r.notes2);
        setTooltip(r.tooltip);
        setCategory(r.category ?? "");
        setAreaTagIds([...(r.areaTagIds ?? [])]);
        setAreaPickerKey((k) => k + 1);
        setMode("edit");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const ids = pendingDeleteIds ?? [];
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    let removed = 0;
    const failures: string[] = [];
    try {
      for (const id of ids) {
        const res = await fetch(`/api/quote-objects/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        const data = await readApiJson<{ error?: string }>(res);
        if (!res.ok) {
          failures.push(typeof data.error === "string" ? data.error : "Delete failed");
          continue;
        }
        removed += 1;
      }
      setPendingDeleteIds(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (editingId && ids.includes(editingId)) closeForm();
      await load();
      if (failures.length) {
        throw new Error(
          failures.length === ids.length
            ? failures[0]!
            : `${removed} deleted, ${failures.length} failed: ${failures[0]}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  const filterInputClass =
    "min-h-10 w-full rounded-md border border-sf-border-strong bg-sf-surface px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";

  /** Measurement and similar quantity fields: right-aligned for NZ-style numeric entry. */
  const itemNumericInputClass = `${inputClass} text-right tabular-nums`;

  /** Compact row for Type, Item, UOM, Default Measurement in the quote object header. */
  const headerFieldClass =
    "min-h-10 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";
  const headerMeasurementClass = `${headerFieldClass} text-right tabular-nums`;

  const moneyFieldShell =
    "flex min-h-12 w-full items-center rounded-lg border border-sf-border-strong bg-sf-surface dark:border-zinc-600 dark:bg-zinc-950 focus-within:ring-2 focus-within:ring-zinc-400/35 dark:focus-within:ring-zinc-500/35";

  const moneyFieldInput =
    "min-h-12 min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-3 text-right tabular-nums text-base text-sf-text outline-none dark:text-zinc-100";

  return (
    <div className="-mx-4 flex flex-col gap-6 md:-mx-6 lg:-mx-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Quote Objects</h2>
          <p className={sfSectionLead}>
            UOM price, total price, and specs are stored per price level (System → Price Levels). Tier
            order in the editor matches that screen (↑ ↓). Select rows with the checkboxes, then use{" "}
            <strong>Delete selected</strong> above the table or in the toolbar. Use search and column
            filters to narrow the list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuoteObjectsImportMenu
            disabled={saving || loading || importPhase === "importing"}
            onImport={openImportModal}
          />
          <button
            type="button"
            disabled={selectedIds.size === 0 || saving || loading}
            onClick={requestDeleteSelected}
            className={`${sfNeutralToolbarButton} text-red-700 disabled:opacity-50 dark:text-red-400`}
          >
            {selectedIds.size === 0
              ? "Delete selected"
              : `Delete selected (${selectedIds.size})`}
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || saving || loading}
            onClick={openBulkCreateScopesModal}
            className="inline-flex min-h-11 items-center justify-center rounded border border-sf-border bg-sf-surface px-4 py-2 text-sm font-normal text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
          >
            {selectedIds.size === 0
              ? "Create scopes"
              : `Create scopes (${selectedIds.size})`}
          </button>
          <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
            Add quote object
          </button>
        </div>
      </div>

      {importModalOpen ? (
        <ModalFrame
          title="Import quote objects"
          description="Choose an .xlsx file. Row 9 must be headers; data starts at row 10. Existing ObjectName values are updated (re-import)."
          wide
          onClose={closeImportModal}
          footer={
            <>
              <button
                type="button"
                onClick={closeImportModal}
                disabled={importPhase === "importing"}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium disabled:opacity-50 dark:border-zinc-600"
              >
                {importPhase === "done" ? "Close" : "Cancel"}
              </button>
              {importPhase === "triaged" && importRows?.length ? (
                <button
                  type="button"
                  onClick={() => void runImportBatches()}
                  className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white"
                >
                  Import
                </button>
              ) : null}
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                id="quote-objects-import-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void onImportFileSelected(f);
                }}
              />
              <label
                htmlFor="quote-objects-import-file"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sf-border-strong bg-sf-page px-4 py-2.5 text-sm font-medium hover:bg-sf-surface dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                Choose spreadsheet…
              </label>
              {importFileLabel ? (
                <span className="ml-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                  {importFileLabel}
                </span>
              ) : null}
            </div>

            {importTriageError ? (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {importTriageError}
              </div>
            ) : null}

            {importFileLabel || importTriageError ? (
              <div className="rounded-lg border border-sf-border bg-sf-page px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="font-medium text-sf-text dark:text-zinc-100">Triage</div>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sf-text-secondary dark:text-zinc-400">
                  <li>
                    Sheet: <span className="font-mono text-sf-text dark:text-zinc-200">{importTriageSheet ?? "—"}</span>
                  </li>
                  <li>
                    Data rows:{" "}
                    <span className="font-mono text-sf-text dark:text-zinc-200">
                      {importRows?.length ?? 0}
                    </span>
                  </li>
                  {importPhase === "triaged" && (importRows?.length ?? 0) > 0 ? (
                    <li className="list-none pl-0 text-emerald-700 dark:text-emerald-400">
                      Structure OK — press Import to write rows (existing names are updated).
                    </li>
                  ) : null}
                </ul>
                {importTriageWarnings.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900 dark:text-amber-200/90">
                    {importTriageWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {importPhase === "importing" || importPhase === "done" ? (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                  Progress
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-sf-border/80 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-sf-brand transition-[width] duration-200"
                    style={{ width: `${importProgressPct}%` }}
                  />
                </div>
                <div className="text-xs tabular-nums text-sf-text-secondary dark:text-zinc-400">
                  {importProgressPct}%
                </div>
              </div>
            ) : null}

            {importReport && importPhase === "done" ? (
              <div className="rounded-lg border border-sf-border bg-sf-surface px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/80">
                <div className="font-medium text-sf-text dark:text-zinc-100">Result</div>
                <p className="mt-1 text-sf-text-secondary dark:text-zinc-400">
                  {importReport.created} created, {importReport.updated} updated
                  {importReport.errorCount ? `, ${importReport.errorCount} logged error(s)` : ""}.
                </p>
                {importReport.errors.length ? (
                  <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sf-text-secondary dark:text-zinc-300">
                    {importReport.errors.slice(0, 80).map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                    {importReport.errors.length > 80 ? (
                      <li>…and {importReport.errors.length - 80} more</li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </ModalFrame>
      ) : null}

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className={sfDataSurface}>
        {loading ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No quote objects yet. Add one to create the{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              quote_objects
            </code>{" "}
            collection in Firestore.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-sf-border bg-sf-page px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between md:px-5">
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
                <span className="text-xs font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                  Filter
                </span>
                <input
                  type="search"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder="Search item, product, type, category, area tags, or object ID…"
                  className={inputClass}
                  aria-label="Filter quote objects"
                />
              </label>
            </div>
            <div className="flex flex-col gap-2 border-b border-sf-border px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-zinc-700/80 md:px-5">
              <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                {displayRows.length === rows.length
                  ? `${rows.length} object${rows.length === 1 ? "" : "s"}`
                  : `Showing ${displayRows.length} of ${rows.length} matching filters`}
                {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}
              </p>
              {selectedIds.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving || loading}
                    onClick={requestDeleteSelected}
                    className="inline-flex min-h-9 items-center rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    {saving ? "Deleting…" : `Delete selected (${selectedIds.size})`}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setSelectedIds(new Set())}
                    className="inline-flex min-h-9 items-center rounded border border-sf-border px-3 py-1.5 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm md:text-base">
                <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                  <tr>
                    <th className="w-10 px-2 py-3 md:px-3 md:py-4">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                        }}
                        onChange={(e) => setSelectAllVisible(e.target.checked)}
                        disabled={displayRows.length === 0}
                        aria-label="Select all visible quote objects"
                        className="size-4 rounded border-sf-border"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Category</th>
                    <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Item</th>
                    <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Type</th>
                    <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Object ID</th>
                    <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Area tags</th>
                    <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Scopes</th>
                    <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">
                      Actions
                    </th>
                  </tr>
                  <tr className="border-b border-sf-border bg-sf-page/95 dark:border-zinc-700 dark:bg-zinc-900/90">
                    <th scope="col" className="w-10 px-2 pb-3 pt-0 md:px-3" aria-hidden />
                    <th scope="col" className="px-4 pb-3 pt-0 align-top md:px-5">
                      <label className="block">
                        <span className="sr-only">Filter by category</span>
                        <select
                          value={tableFilterCategory}
                          onChange={(e) =>
                            setTableFilterCategory(
                              e.target.value as "" | "__none__" | string,
                            )
                          }
                          className={filterInputClass}
                          aria-label="Filter by category"
                        >
                          <option value="">All categories</option>
                          {rows.some((r) => !r.category?.trim()) ? (
                            <option value="__none__">No category</option>
                          ) : null}
                          {categoryFilterOptions.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </th>
                    <th
                      scope="col"
                      className="px-4 pb-3 pt-0 align-top md:px-5"
                      colSpan={3}
                      aria-hidden
                    />
                    <th scope="col" className="px-4 pb-3 pt-0 align-top md:px-5">
                      <label className="block">
                        <span className="sr-only">Filter by area tag</span>
                        <select
                          value={tableFilterAreaTagId}
                          onChange={(e) => setTableFilterAreaTagId(e.target.value)}
                          className={filterInputClass}
                          aria-label="Filter by area tag"
                        >
                          <option value="">All areas</option>
                          {areasSortedByName.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.areaname}
                            </option>
                          ))}
                        </select>
                      </label>
                    </th>
                    <th scope="col" className="px-4 pb-3 pt-0 md:px-5" aria-hidden />
                    <th
                      scope="col"
                      className="px-4 pb-3 pt-0 text-right align-top md:px-5"
                      aria-hidden
                    />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-sf-text-secondary dark:text-zinc-400 md:px-5"
                      >
                        No objects match your filters. Clear the search or column filters.
                      </td>
                    </tr>
                  ) : null}
                  {displayRows.map((r) => {
                    const checked = selectedIds.has(r.id);
                    const scopeLinks = scopeLinksForQuoteObject(scopes, r);
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-sf-border last:border-0 dark:border-zinc-700/80${
                          checked ? " bg-sf-page/80 dark:bg-zinc-800/50" : ""
                        }`}
                      >
                        <td className="px-2 py-3 md:px-3 md:py-3.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(r.id)}
                            aria-label={`Select ${r.objectname}`}
                            className="size-4 rounded border-sf-border"
                          />
                        </td>
                        <td className="px-4 py-3 md:px-5 md:py-3.5">
                          {r.category?.trim() ? r.category : "—"}
                        </td>
                        <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="max-w-full text-left text-base font-medium text-blue-700 underline decoration-blue-700/70 underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:decoration-blue-400/70 dark:hover:text-blue-300"
                          >
                            {r.objectname}
                          </button>
                        </td>
                        <td className="px-4 py-3 md:px-5 md:py-3.5">
                          {r.objecttype || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm md:px-5 md:py-3.5">
                          {numToInput(r.objectid)}
                        </td>
                        <td className="max-w-[14rem] px-4 py-3 text-sf-text-secondary dark:text-zinc-300 md:px-5 md:py-3.5">
                          {(r.areaTagIds ?? []).length === 0
                            ? "—"
                            : (r.areaTagIds ?? [])
                                .map((id) => areaById.get(id)?.areaname?.trim() || id)
                                .join(", ")}
                        </td>
                        <td className="max-w-[14rem] px-4 py-3 align-top text-xs leading-snug text-sf-text-secondary dark:text-zinc-300 md:px-5 md:py-3.5">
                          {scopeLinks.length === 0 ? (
                            <span className="text-sf-text-weak dark:text-zinc-500">—</span>
                          ) : (
                            <ul className="list-none space-y-1">
                              {scopeLinks.map((link) => (
                                <li key={link.scopeDocId}>
                                  <button
                                    type="button"
                                    onClick={() => setEditScopeDocId(link.scopeDocId)}
                                    className="text-left font-medium text-sf-brand underline underline-offset-2 hover:text-sf-brand-hover dark:text-[#58a9f5] dark:hover:text-[#7ab8ff]"
                                    title="Edit scope"
                                  >
                                    {link.question}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className={sfRowIconBtn}
                              aria-label="Edit quote object"
                            >
                              <IconPencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void cloneObject(r)}
                              disabled={saving}
                              className={sfRowIconBtn}
                              aria-label="Clone quote object"
                            >
                              <IconCopy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteIds([r.id])}
                              className={sfRowIconBtnDanger}
                              aria-label="Delete quote object"
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {(mode === "create" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quote-object-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-4xl sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <h2 id="quote-object-form-title" className="text-lg font-semibold md:text-xl">
                  {mode === "create" ? "New quote object" : "Edit quote object"}
                </h2>
                <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600 sm:min-h-10 sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="quote-object-form"
                    disabled={saving}
                    className="min-h-11 rounded-lg bg-sf-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-10 sm:text-base"
                  >
                    {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
                  </button>
                  {mode === "edit" && editingId ? (
                    <QuoteObjectFormOverflowMenu
                      disabled={
                        saving || creatingScope || (areaTagIds?.length ?? 0) === 0
                      }
                      onCreateScope={openCreateScopeDialog}
                    />
                  ) : null}
                </div>
              </div>
            </div>
            <form id="quote-object-form" onSubmit={submitForm} className="space-y-4 px-5 py-5">
              <div className="flex flex-col gap-4">
                <div
                  className={`grid gap-3 ${mode === "edit" && editingId ? "sm:grid-cols-2" : "grid-cols-1"}`}
                >
                  {mode === "edit" && editingId ? (
                    <label className="block max-w-[14rem] sm:max-w-none">
                      <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                        Object ID
                      </span>
                      <input
                        readOnly
                        value={numToInput(rows.find((x) => x.id === editingId)?.objectid)}
                        className={`${headerFieldClass} bg-sf-page font-mono dark:bg-zinc-900`}
                      />
                    </label>
                  ) : null}
                  <label className="block min-w-0 sm:max-w-none">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Category
                    </span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={headerFieldClass}
                    >
                      <option value="">— None —</option>
                      {category &&
                      !objectCategoryLookups.some((l) => l.lookupvalue === category) ? (
                        <option value={category}>{category} (saved)</option>
                      ) : null}
                      {objectCategoryLookups.map((l) => (
                        <option key={l.id} value={l.lookupvalue}>
                          {l.lookupvalue}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
                      Values from System → Lookups with type{" "}
                      <code className="rounded bg-sf-page px-1 font-mono dark:bg-zinc-800">
                        {LOOKUP_TYPE_OBJECT_CATEGORY}
                      </code>
                      .
                    </span>
                  </label>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Area tags
                  </span>
                  <p className="text-xs text-sf-text-weak dark:text-zinc-400">
                    Link this line to one or more template areas (e.g. Kitchen, Bathroom). The same
                    object can be tagged for multiple areas.
                  </p>
                  {areaTagIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {areaTagIds.map((id) => {
                        const label = areaById.get(id)?.areaname?.trim() || id;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-full bg-sf-page px-2.5 py-1 text-sm text-sf-text dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            {label}
                            <button
                              type="button"
                              onClick={() =>
                                setAreaTagIds((prev) => prev.filter((x) => x !== id))
                              }
                              className="rounded-full p-0.5 text-sf-text-weak hover:bg-sf-border/50 hover:text-sf-text dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                              aria-label={`Remove ${label}`}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  <select
                    key={areaPickerKey}
                    className={`${headerFieldClass} max-w-md`}
                    defaultValue=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      setAreaTagIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
                      setAreaPickerKey((k) => k + 1);
                    }}
                  >
                    <option value="">— Add area…</option>
                    {areasToAdd.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.areaname}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
                  <label className="block min-w-0 sm:col-span-2 lg:col-span-3">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Item
                    </span>
                    <input
                      required
                      value={objectname}
                      onChange={(e) => setObjectname(e.target.value)}
                      className={headerFieldClass}
                    />
                  </label>
                  <label className="block min-w-0 sm:col-span-2 lg:col-span-3">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Product
                    </span>
                    <textarea
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      rows={2}
                      className={`${headerFieldClass} min-h-[4.5rem] resize-y`}
                      placeholder="Optional details for this item"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      UOM
                    </span>
                    <select
                      value={uom}
                      onChange={(e) => setUom(normalizeUom(e.target.value) || "Unit")}
                      className={headerFieldClass}
                    >
                      {uom !== "" && !UOM_OPTIONS.includes(uom as (typeof UOM_OPTIONS)[number]) ? (
                        <option value={uom}>{uom} (saved)</option>
                      ) : null}
                      {UOM_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      {uom === LM_RUNS_UOM ? "Default area (m²)" : "Default Measurement"}
                    </span>
                    {uom === LM_RUNS_UOM ? (
                      <>
                        <input
                          value={defaultAreaM2Str}
                          onChange={(e) => {
                            const v = e.target.value;
                            setDefaultAreaM2Str(v);
                            if (v.trim() === "") setMeasurementStr("");
                          }}
                          inputMode="decimal"
                          placeholder="e.g. 25"
                          className={headerMeasurementClass}
                        />
                        <span className="mt-1 block text-[11px] leading-snug text-sf-text-weak dark:text-zinc-400">
                          Nominal room floor area. With run width (below), this sets{" "}
                          <span className="font-medium">default measurement (LM)</span> for new lines
                          when the checklist has no area m². On the checklist, area m² drives the same
                          formula.
                        </span>
                      </>
                    ) : (
                      <input
                        value={measurementStr}
                        onChange={(e) => setMeasurementStr(e.target.value)}
                        inputMode="decimal"
                        className={headerMeasurementClass}
                      />
                    )}
                  </label>
                  {uom === LM_RUNS_UOM ? (
                    <div className="min-w-0 space-y-3 sm:col-span-2 lg:col-span-3">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
                        <label className="block min-w-0 w-[10rem] shrink-0">
                          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                            Run width (m)
                          </span>
                          <input
                            value={runWidthStr}
                            onChange={(e) => setRunWidthStr(e.target.value)}
                            inputMode="decimal"
                            placeholder={String(DEFAULT_LM_RUNS_RUN_WIDTH)}
                            className={headerMeasurementClass}
                          />
                        </label>
                        <div className="min-w-0 flex-1 rounded-lg border border-sf-border bg-sf-page px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-900/80">
                          <div className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                            Carpet LM calculation → default measurement
                          </div>
                          {lmRunsDefaultBreakdown ? (
                            <ul className="mt-2 space-y-1.5 text-sm tabular-nums text-sf-text dark:text-zinc-200">
                              <li>
                                Assumed square room:{" "}
                                <span className="font-medium">
                                  √{lmRunsDefaultBreakdown.areaM2.toLocaleString("en-NZ")} ={" "}
                                  {lmRunsDefaultBreakdown.sideM.toLocaleString("en-NZ", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  m
                                </span>{" "}
                                width and length.
                              </li>
                              <li>
                                Runs across width:{" "}
                                <span className="font-medium">
                                  ceil(
                                  {lmRunsDefaultBreakdown.sideM.toLocaleString("en-NZ", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  ÷{" "}
                                  {lmRunsDefaultBreakdown.runWidthM.toLocaleString("en-NZ", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                  ) = {lmRunsDefaultBreakdown.runs}
                                </span>
                                .
                              </li>
                              <li>
                                Default measurement (LM):{" "}
                                <span className="font-medium">
                                  {lmRunsDefaultBreakdown.runs} ×{" "}
                                  {lmRunsDefaultBreakdown.sideM.toLocaleString("en-NZ", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  ={" "}
                                  {lmRunsDefaultBreakdown.linealMetres.toLocaleString("en-NZ", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  m
                                </span>
                                .
                              </li>
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
                              Enter default area (m²) above to see width ÷ run width → runs (rounded
                              up), then runs × length, and the default line LM that will be saved.
                            </p>
                          )}
                        </div>
                      </div>
                      <label className="block max-w-md">
                        <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                          Default measurement (LM)
                        </span>
                        <input
                          readOnly
                          value={measurementStr}
                          aria-readonly="true"
                          className={`${headerMeasurementClass} bg-sf-page dark:bg-zinc-900`}
                        />
                        <span className="mt-1 block text-[11px] text-sf-text-weak dark:text-zinc-400">
                          Filled from default area × run width when default m² is set; otherwise the
                          saved LM from this object (e.g. legacy rows).
                        </span>
                      </label>
                      <p className="text-xs text-sf-text-weak dark:text-zinc-400">
                        Roll width: if empty, {DEFAULT_LM_RUNS_RUN_WIDTH} m is used when calculating
                        quantities.
                      </p>
                    </div>
                  ) : null}
                </div>
                {SHOW_PRICE_LEVEL_PRICING_UI ? (
                  <p className="text-xs text-sf-text-weak dark:text-zinc-400">
                    {uom === LM_RUNS_UOM ? (
                      <>
                        For {LM_RUNS_UOM}, enter default area and run width so default measurement (LM)
                        updates live; price tiers use that LM × UOM price. On the checklist, checklist
                        area m² replaces default area in the same formula when set.
                      </>
                    ) : (
                      <>Set UOM and default measurement before price levels so tier totals can use meas ×
                      UOM price.</>
                    )}
                  </p>
                ) : uom === LM_RUNS_UOM ? (
                  <p className="text-xs text-sf-text-weak dark:text-zinc-400">
                    For {LM_RUNS_UOM}, enter default area and run width so default measurement (LM)
                    updates live. On the checklist, checklist area m² replaces default area in the same
                    formula when set.
                  </p>
                ) : null}

                <label className="block rounded-lg border border-sf-border px-3 py-3 dark:border-zinc-600">
                  <span className="mb-1 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Inherit m² on checklist
                  </span>
                  <select
                    value={inheritM2Source}
                    disabled={!uomSupportsInheritM2(uom)}
                    onChange={(e) =>
                      setInheritM2Source(e.target.value as QuoteObjectInheritM2Source)
                    }
                    className={headerFieldClass}
                  >
                    {QUOTE_OBJECT_INHERIT_M2_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {QUOTE_OBJECT_INHERIT_M2_LABELS[src]}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
                    For UOM M2 (or LM-Runs): new checklist lines use project or room m² as the
                    measure instead of default measurement — e.g. paint → apartment m², bathroom
                    tile → area m². Updates when project or area m² changes until the user
                    overrides the measure on the line.
                  </span>
                </label>

                {SHOW_PRICE_LEVEL_PRICING_UI ? (
                <div className="w-full">
                  <h3 className="mb-2 text-sm font-semibold text-sf-text dark:text-zinc-100">
                    Pricing &amp; specs by price level
                  </h3>
                  {sortedPriceLevels.length === 0 ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      Add price levels under System → Price Levels first. Until then, you cannot set
                      tiered prices here.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-sf-text-weak dark:text-zinc-400">
                        Default Measurement (above) × this tier&apos;s UOM price fills total when you
                        focus an empty total field.
                        {uom === LM_RUNS_UOM ? (
                          <>
                            {" "}
                            ({LM_RUNS_UOM}: uses default measurement (LM) from default area × run width;
                            on the checklist, area m² replaces default area in the same formula when
                            set.)
                          </>
                        ) : null}
                      </p>
                      {sortedPriceLevels.map((pl) => {
                        const pk =
                          pl.pricelevelid != null ? String(pl.pricelevelid) : "";
                        if (!pk) return null;
                        const d = levelDrafts[pk] ?? emptyLevelDraft();
                        const m =
                          (uom === "M2" || uom === LM_RUNS_UOM) && inheritM2Source !== "none"
                            ? Number.NaN
                            : Number(measurementStr);
                        const up = Number(d.uompriceStr);
                        const tierCalc =
                          Number.isFinite(m) && Number.isFinite(up) ? m * up : null;
                        const isInvestorTier = pk === investorPriceLevelKey;
                        const canRecalcTotal =
                          !((uom === "M2" || uom === LM_RUNS_UOM) && inheritM2Source !== "none") &&
                          Number.isFinite(m) &&
                          Number.isFinite(up);
                        return (
                          <div
                            key={pl.id}
                            className="rounded-xl border border-sf-border p-3 dark:border-zinc-700"
                          >
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <div className="min-w-0 font-medium text-sf-text dark:text-zinc-100">
                                {pl.pricelevel}
                                <span className="ml-2 font-mono text-xs font-normal text-sf-text-weak">
                                  #{pl.pricelevelid}
                                </span>
                              </div>
                              {isInvestorTier ? (
                                <InvestorTierOverflowMenu
                                  disabled={
                                    sortedPriceLevels.filter((x) => x.pricelevelid != null)
                                      .length < 2
                                  }
                                  onSendToAllPls={sendInvestorTierToAllPriceLevels}
                                />
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-1.5 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                                    UOM price
                                  </span>
                                  <div className={moneyFieldShell}>
                                    <span
                                      className="shrink-0 pl-3 text-base tabular-nums text-sf-text-weak dark:text-zinc-400"
                                      aria-hidden
                                    >
                                      $
                                    </span>
                                    <input
                                      value={d.uompriceStr}
                                      onChange={(e) =>
                                        setLevelDrafts((prev) => ({
                                          ...prev,
                                          [pk]: { ...d, uompriceStr: e.target.value },
                                        }))
                                      }
                                      inputMode="decimal"
                                      className={moneyFieldInput}
                                    />
                                  </div>
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                                    Total price
                                  </span>
                                  <div className={moneyFieldShell}>
                                    <span
                                      className="shrink-0 pl-3 text-base tabular-nums text-sf-text-weak dark:text-zinc-400"
                                      aria-hidden
                                    >
                                      $
                                    </span>
                                    <input
                                      value={d.totalpriceStr}
                                      onChange={(e) =>
                                        setLevelDrafts((prev) => ({
                                          ...prev,
                                          [pk]: { ...d, totalpriceStr: e.target.value },
                                        }))
                                      }
                                      onFocus={() => {
                                        setLevelDrafts((prev) => {
                                          const cur = prev[pk] ?? emptyLevelDraft();
                                          if (cur.totalpriceStr.trim() !== "") return prev;
                                          if ((uom === "M2" || uom === LM_RUNS_UOM) && inheritM2Source !== "none") return prev;
                                          const m = Number(measurementStr);
                                          const up = Number(cur.uompriceStr);
                                          const tc =
                                            Number.isFinite(m) && Number.isFinite(up)
                                              ? m * up
                                              : null;
                                          if (tc === null) return prev;
                                          return {
                                            ...prev,
                                            [pk]: { ...cur, totalpriceStr: String(tc) },
                                          };
                                        });
                                      }}
                                      inputMode="decimal"
                                      className={moneyFieldInput}
                                    />
                                  </div>
                                  <div className="mt-1 flex justify-end">
                                    <button
                                      type="button"
                                      className="rounded-md border border-sf-border bg-sf-page px-2.5 py-1 text-xs font-medium text-sf-text shadow-sm hover:bg-sf-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                      disabled={!canRecalcTotal}
                                      title={
                                        (uom === "M2" || uom === LM_RUNS_UOM) && inheritM2Source !== "none"
                                          ? "Not available when inheriting M2 (measurement is resolved from the selected source)."
                                          : !Number.isFinite(Number(measurementStr)) ||
                                              !Number.isFinite(Number(d.uompriceStr))
                                            ? "Enter default measurement and UOM price to recalculate total."
                                            : "Set total to default measurement × UOM price"
                                      }
                                      onClick={() => recalcTierTotalFromMeasurement(pk)}
                                    >
                                      Recalc
                                    </button>
                                  </div>
                                  {tierCalc !== null ? (
                                    <span className="mt-1 block text-right text-xs text-sf-text-weak tabular-nums">
                                      meas × UOM price = {formatNzDollars(tierCalc)}
                                    </span>
                                  ) : (uom === "M2" || uom === LM_RUNS_UOM) && inheritM2Source !== "none" && Number.isFinite(up) ? (
                                    <span className="mt-1 block text-right text-xs text-sf-text-weak">
                                      Inherited M2 × UOM price (filled per selected source)
                                    </span>
                                  ) : null}
                                </label>
                              </div>
                              <label className="block w-full">
                                <span className="mb-1.5 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                                  Spec 1
                                </span>
                                <textarea
                                  value={d.spec1}
                                  onChange={(e) =>
                                    setLevelDrafts((prev) => ({
                                      ...prev,
                                      [pk]: { ...d, spec1: e.target.value },
                                    }))
                                  }
                                  rows={2}
                                  className={`${inputClass} min-h-[4rem] w-full resize-y`}
                                />
                              </label>
                              <label className="block w-full">
                                <span className="mb-1.5 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                                  Spec 2
                                </span>
                                <textarea
                                  value={d.spec2}
                                  onChange={(e) =>
                                    setLevelDrafts((prev) => ({
                                      ...prev,
                                      [pk]: { ...d, spec2: e.target.value },
                                    }))
                                  }
                                  rows={2}
                                  className={`${inputClass} min-h-[4rem] w-full resize-y`}
                                />
                              </label>
                              <label className="block w-full">
                                <span className="mb-1.5 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                                  Spec 3
                                </span>
                                <textarea
                                  value={d.spec3}
                                  onChange={(e) =>
                                    setLevelDrafts((prev) => ({
                                      ...prev,
                                      [pk]: { ...d, spec3: e.target.value },
                                    }))
                                  }
                                  rows={2}
                                  className={`${inputClass} min-h-[4rem] w-full resize-y`}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                ) : null}

                <label className="block w-full">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Tool tip
                  </span>
                  <textarea
                    value={tooltip}
                    onChange={(e) => setTooltip(e.target.value)}
                    rows={2}
                    placeholder="e.g. Enter bench length in lineal metres"
                    className={`${inputClass} min-h-[4rem] resize-y`}
                  />
                  <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
                    Shown on Check List and Workbench for lines that use this quote object.
                  </span>
                </label>
                <label className="block w-full">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Notes 1
                  </span>
                  <textarea
                    value={notes1}
                    onChange={(e) => setNotes1(e.target.value)}
                    rows={2}
                    className={`${inputClass} min-h-[4rem] resize-y`}
                  />
                </label>
                <label className="block w-full">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Notes 2
                  </span>
                  <textarea
                    value={notes2}
                    onChange={(e) => setNotes2(e.target.value)}
                    rows={2}
                    className={`${inputClass} min-h-[4rem] resize-y`}
                  />
                </label>
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createScopeOpen ? (
        <ModalFrame
          title="Create scope"
          description={
            areaTagIds[0]
              ? `Uses the first area tag on this object: ${
                  areaById.get(areaTagIds[0])?.areaname?.trim() || areaTagIds[0]
                }. One “Yes” answer will include this quote object for every price tier (Investor, etc.).`
              : "Tag at least one area on this quote object first."
          }
          onClose={() => {
            if (creatingScope) return;
            setCreateScopeOpen(false);
            setCreateScopeDialogError(null);
          }}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  if (creatingScope) return;
                  setCreateScopeOpen(false);
                  setCreateScopeDialogError(null);
                }}
                disabled={creatingScope}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium disabled:opacity-50 dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCreateScope()}
                disabled={creatingScope || !areaTagIds[0]}
                className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {creatingScope ? "Creating…" : "Create scope"}
              </button>
            </>
          }
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
              Scope question
            </span>
            <textarea
              value={createScopeQuestion}
              onChange={(e) => {
                setCreateScopeQuestion(e.target.value);
                setCreateScopeDialogError(null);
              }}
              rows={3}
              maxLength={200}
              className={`${inputClass} min-h-[5rem] w-full resize-y`}
              placeholder="e.g. Include dishwasher?"
              disabled={creatingScope}
              autoFocus
            />
          </label>
          {createScopeDialogError ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {createScopeDialogError}
            </p>
          ) : null}
        </ModalFrame>
      ) : null}

      <CreateScopesFromDataObjectsModal
        open={bulkCreateScopesOpen}
        selectionRows={selectionRowsForScopes}
        quoteObjects={rows}
        areas={areas}
        onClose={() => setBulkCreateScopesOpen(false)}
        onCreated={onBulkScopesCreated}
      />

      {editScopeDocId ? (
        <ScopeFormModal
          key={editScopeDocId}
          open
          scopeDocId={editScopeDocId}
          mode="edit"
          areas={areas}
          quoteObjects={rows}
          scopes={scopes}
          onClose={() => setEditScopeDocId(null)}
          onSaved={async () => {
            await refreshScopes();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDeleteIds?.length)}
        title={
          (pendingDeleteIds?.length ?? 0) > 1
            ? `Delete ${pendingDeleteIds!.length} quote objects?`
            : "Delete quote object?"
        }
        description={
          (pendingDeleteIds?.length ?? 0) > 1
            ? "This removes the selected quote object documents from Firestore. This cannot be undone."
            : "This removes the quote object document from Firestore. This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        pending={saving}
        onCancel={() => setPendingDeleteIds(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
