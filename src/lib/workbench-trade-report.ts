import { projectLineObjectLabel, quoteObjectForProjectLine } from "@/lib/client/project-line-quote-object";
import {
  formatLabourHours,
  type LabourSiloKey,
  WB_LABOUR_SILO_HEADERS,
} from "@/lib/labour-silo";
import { noteHasTradeTag, sortNotesNewestFirst } from "@/lib/project-note-filters";
import { DEFAULT_NOTE_TYPE } from "@/lib/project-note-types";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import type { AreaPublic } from "@/types/area";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectNotePublic } from "@/types/project-note";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

export const WB_TRADE_REPORTS = [
  {
    id: "plumbing",
    label: "Plumbing",
    noteTradeTag: "Plumbing",
    labourSiloKeys: ["plumberHours"] as const,
    tradeCategories: ["Plumbing"],
  },
  {
    id: "electrical",
    label: "Electrical",
    noteTradeTag: "Electrical",
    labourSiloKeys: ["electricianHours"] as const,
    tradeCategories: ["Electrical"],
  },
  {
    id: "demolition",
    label: "Demolition",
    noteTradeTag: "Demolition",
    labourSiloKeys: [] as const,
    tradeCategories: ["Demolition"],
  },
  {
    id: "contractor",
    label: "Contractor",
    /** Closest project-note trade tag for on-site contractor work. */
    noteTradeTag: "Building",
    labourSiloKeys: ["constructionAssistantHours"] as const,
    tradeCategories: ["Building"],
  },
  {
    id: "leadContractor",
    label: "Lead Contractor",
    noteTradeTag: "Lead Contractor",
    labourSiloKeys: ["leadContractorHours"] as const,
    tradeCategories: [] as const,
  },
  {
    id: "cleaning",
    label: "Cleaning",
    noteTradeTag: "Cleaning",
    labourSiloKeys: [] as const,
    tradeCategories: ["Cleaning"],
  },
] as const;

export type WbTradeReportId = (typeof WB_TRADE_REPORTS)[number]["id"];
export type WbTradeReportConfig = (typeof WB_TRADE_REPORTS)[number];

export type WbTradeReportLineMatchSource = "labour" | "category";

export type WbTradeReportLine = {
  id: string;
  description: string;
  skuProduct: string;
  measure: string;
  uom: string;
  labourSummary: string;
  lineNotes: string;
  bundled: boolean;
  /** Why this line is on the trade report (labour hours and/or trade category). */
  matchSources: WbTradeReportLineMatchSource[];
};

export type WbTradeReportObject = {
  objectid: number;
  label: string;
  lines: WbTradeReportLine[];
  notes: ProjectNotePublic[];
  /** Total trade labour hours across all lines on this object in the area. */
  tradeLabourSummary?: string;
  /** Scope answers tagged for the demolition report — do not remove these items. */
  demolitionReportLabels?: string[];
};

export type WbTradeReportArea = {
  areaid: number;
  label: string;
  notes: ProjectNotePublic[];
  objects: WbTradeReportObject[];
};

export type WbTradeReportData = {
  config: WbTradeReportConfig;
  projectName: string;
  projectNotes: ProjectNotePublic[];
  areas: WbTradeReportArea[];
  printedAt: Date;
};

function normalizeTradeCategory(value: string): string {
  return value.trim().toLowerCase();
}

/** Quote object category and matched SKU category / product type. */
function tradeCategoriesForLine(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
): string[] {
  const categories = new Set<string>();
  const q = quoteObjectForProjectLine(row, quoteObjects);
  const fromQuote = q?.category?.trim();
  if (fromQuote) categories.add(fromQuote);
  const skuId = row.skuId?.trim();
  if (skuId) {
    const sku = catalogSkus.find((s) => s.skuId === skuId);
    const fromSkuCategory = sku?.category?.trim();
    if (fromSkuCategory) categories.add(fromSkuCategory);
    const fromSkuProductType = sku?.productType?.trim();
    if (fromSkuProductType) categories.add(fromSkuProductType);
  }
  return [...categories];
}

function lineMatchesTradeCategories(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
  reportTradeCategories: readonly string[],
): boolean {
  if (reportTradeCategories.length === 0) return false;
  const targets = new Set(reportTradeCategories.map(normalizeTradeCategory));
  return tradeCategoriesForLine(row, quoteObjects, catalogSkus).some((t) =>
    targets.has(normalizeTradeCategory(t)),
  );
}

function lineMatchSourcesForReport(
  row: ProjectAreaObjectPublic,
  config: WbTradeReportConfig,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
): WbTradeReportLineMatchSource[] {
  const sources: WbTradeReportLineMatchSource[] = [];
  if (lineHasReportLabour(row, config.labourSiloKeys)) sources.push("labour");
  if (lineMatchesTradeCategories(row, quoteObjects, catalogSkus, config.tradeCategories)) {
    sources.push("category");
  }
  return sources;
}

function tradeLabourSummaryForObject(
  rows: ProjectAreaObjectPublic[],
  keys: readonly LabourSiloKey[],
): string | undefined {
  const parts: string[] = [];
  for (const key of keys) {
    let keySum = 0;
    for (const row of rows) {
      const v = row[key];
      if (v != null && Number.isFinite(v) && v > 0) keySum += v;
    }
    if (keySum <= 0) continue;
    const header = WB_LABOUR_SILO_HEADERS.find((h) => h.key === key);
    parts.push(`${header?.label ?? key}: ${formatLabourHours(keySum)}h`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function lineHasReportLabour(row: ProjectAreaObjectPublic, keys: readonly LabourSiloKey[]): boolean {
  return keys.some((k) => {
    const v = row[k];
    return v != null && Number.isFinite(v) && v > 0;
  });
}

export function lineMatchesWorkbenchTradeReport(
  row: ProjectAreaObjectPublic,
  config: WbTradeReportConfig,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
): boolean {
  return lineMatchSourcesForReport(row, config, quoteObjects, catalogSkus).length > 0;
}

export function formatWbTradeReportLineMatchSources(
  sources: readonly WbTradeReportLineMatchSource[],
): string {
  const labels = sources.map((s) => (s === "labour" ? "Labour" : "Category"));
  return labels.length > 0 ? labels.join(" · ") : "—";
}

function labourSummaryForLine(
  row: ProjectAreaObjectPublic,
  config: WbTradeReportConfig,
): string {
  const parts: string[] = [];
  for (const key of config.labourSiloKeys) {
    const v = row[key];
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    const header = WB_LABOUR_SILO_HEADERS.find((h) => h.key === key);
    parts.push(`${header?.label ?? key}: ${formatLabourHours(v)}h`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function skuProductLabel(row: ProjectAreaObjectPublic, catalogSkus: DataSkuPublic[]): string {
  const fromLine = row.skuProduct?.trim();
  if (fromLine) return fromLine;
  const skuId = row.skuId?.trim();
  if (!skuId) return "—";
  const sku = catalogSkus.find((s) => s.skuId === skuId);
  return sku?.product?.trim() || skuId;
}

function lineNotesText(row: ProjectAreaObjectPublic): string {
  return [row.notes1, row.notes2].map((n) => n?.trim()).filter(Boolean).join("\n");
}

function measureLabel(row: ProjectAreaObjectPublic): string {
  if (row.custommeasure == null || !Number.isFinite(row.custommeasure)) return "—";
  return Number.isInteger(row.custommeasure)
    ? String(row.custommeasure)
    : String(row.custommeasure);
}

/** Demolition report: trade tag or note type "Demolition". Other trades: trade tag only. */
function noteMatchesTradeReport(note: ProjectNotePublic, config: WbTradeReportConfig): boolean {
  if (noteHasTradeTag(note, config.noteTradeTag)) return true;
  if (config.id !== "demolition") return false;
  const noteType = (note.notetype || DEFAULT_NOTE_TYPE).trim();
  return noteType.toLowerCase() === "demolition";
}

/** Attached objects from scope answers tagged `includeOnDemolitionReport`. */
function demolitionReportLabelsByObjectId(
  pa: ProjectAreaPublic,
  scopes: ScopePublic[],
  quoteObjects: QuoteObjectPublic[],
): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const quoteById = new Map(quoteObjects.map((q) => [q.id, q]));

  for (const entry of pa.scopeAnswers ?? []) {
    const scope = scopes.find((s) => s.id === entry.scopeDocId);
    const answer = scope?.answers.find((a) => a.answerid === entry.answerid);
    if (!answer?.includeOnDemolitionReport) continue;

    const label = answer.label.trim();
    const objectIds = new Set<number>();

    for (const qid of answer.attachedQuoteObjectIds ?? []) {
      const q = quoteById.get(qid.trim());
      if (q?.objectid != null && Number.isInteger(q.objectid)) objectIds.add(q.objectid);
    }
    for (const name of answer.attachedObjectNames ?? []) {
      const key = name.trim().toLowerCase();
      if (!key) continue;
      for (const q of quoteObjects) {
        if (q.objectname?.trim().toLowerCase() === key && q.objectid != null) {
          objectIds.add(q.objectid);
        }
      }
    }

    for (const objectid of objectIds) {
      const list = out.get(objectid) ?? [];
      if (!list.includes(label)) list.push(label);
      out.set(objectid, list);
    }
  }

  return out;
}

function projectLevelTradeNotes(
  notes: ProjectNotePublic[],
  projectid: number,
  config: WbTradeReportConfig,
): ProjectNotePublic[] {
  return sortNotesNewestFirst(
    notes.filter(
      (n) =>
        n.projectid === projectid &&
        n.areaid == null &&
        n.objectid == null &&
        noteMatchesTradeReport(n, config),
    ),
  );
}

function areaLevelTradeNotes(
  notes: ProjectNotePublic[],
  projectid: number,
  areaid: number,
  config: WbTradeReportConfig,
): ProjectNotePublic[] {
  return sortNotesNewestFirst(
    notes.filter(
      (n) =>
        n.projectid === projectid &&
        n.areaid === areaid &&
        n.objectid == null &&
        noteMatchesTradeReport(n, config),
    ),
  );
}

function objectLevelTradeNotes(
  notes: ProjectNotePublic[],
  projectid: number,
  areaid: number,
  objectid: number,
  config: WbTradeReportConfig,
): ProjectNotePublic[] {
  return sortNotesNewestFirst(
    notes.filter(
      (n) =>
        n.projectid === projectid &&
        n.areaid === areaid &&
        n.objectid === objectid &&
        noteMatchesTradeReport(n, config),
    ),
  );
}

export type BuildWorkbenchTradeReportArgs = {
  config: WbTradeReportConfig;
  project: ProjectPublic;
  projectid: number;
  projectAreas: ProjectAreaPublic[];
  areas: AreaPublic[];
  projectNotes: ProjectNotePublic[];
  quoteObjects: QuoteObjectPublic[];
  catalogSkus: DataSkuPublic[];
  scopes: ScopePublic[];
  objectsByProjectAreaDocId: Map<string, ProjectAreaObjectPublic[]>;
};

export function buildWorkbenchTradeReport(args: BuildWorkbenchTradeReportArgs): WbTradeReportData {
  const {
    config,
    project,
    projectid,
    projectAreas,
    areas,
    projectNotes,
    quoteObjects,
    catalogSkus,
    scopes,
    objectsByProjectAreaDocId,
  } = args;

  const projectNotesForTrade = projectLevelTradeNotes(projectNotes, projectid, config);

  const reportAreas: WbTradeReportArea[] = [];

  for (const pa of projectAreas) {
    const rows = objectsByProjectAreaDocId.get(pa.id) ?? [];
    const areaNotes = areaLevelTradeNotes(projectNotes, projectid, pa.areaid, config);
    const demolitionByObject =
      config.id === "demolition"
        ? demolitionReportLabelsByObjectId(pa, scopes, quoteObjects)
        : new Map<number, string[]>();

    const linesByObject = new Map<number, ProjectAreaObjectPublic[]>();
    for (const row of rows) {
      if (!lineMatchesWorkbenchTradeReport(row, config, quoteObjects, catalogSkus)) continue;
      const list = linesByObject.get(row.objectid) ?? [];
      list.push(row);
      linesByObject.set(row.objectid, list);
    }

    const objectIdsWithNotes = new Set<number>();
    for (const n of projectNotes) {
      if (n.projectid !== projectid || n.areaid !== pa.areaid || n.objectid == null) continue;
      if (noteMatchesTradeReport(n, config)) objectIdsWithNotes.add(n.objectid);
    }

    const objectIds = new Set([...linesByObject.keys(), ...objectIdsWithNotes]);
    for (const objectid of demolitionByObject.keys()) objectIds.add(objectid);
    const objects: WbTradeReportObject[] = [...objectIds]
      .sort((a, b) => a - b)
      .map((objectid) => {
        const objectRows = rows.filter((r) => r.objectid === objectid);
        const labelRow = objectRows[0];
        const label = labelRow
          ? projectLineObjectLabel(labelRow, quoteObjects, catalogSkus)
          : `Object ${objectid}`;
        const matchingLines = (linesByObject.get(objectid) ?? []).sort(
          (a, b) => a.objectid - b.objectid || a.id.localeCompare(b.id),
        );
        const tradeLabourSummary = tradeLabourSummaryForObject(objectRows, config.labourSiloKeys);
        return {
          objectid,
          label,
          lines: matchingLines.map((row) => ({
            id: row.id,
            description: projectLineObjectLabel(row, quoteObjects, catalogSkus),
            skuProduct: skuProductLabel(row, catalogSkus),
            measure: measureLabel(row),
            uom: row.customuom?.trim() || "—",
            labourSummary: labourSummaryForLine(row, config),
            lineNotes: lineNotesText(row),
            bundled: row.linesource === "bundled",
            matchSources: lineMatchSourcesForReport(row, config, quoteObjects, catalogSkus),
          })),
          notes: objectLevelTradeNotes(projectNotes, projectid, pa.areaid, objectid, config),
          tradeLabourSummary,
          demolitionReportLabels: demolitionByObject.get(objectid),
        };
      })
      .filter(
        (o) =>
          o.lines.length > 0 ||
          o.notes.length > 0 ||
          Boolean(o.tradeLabourSummary) ||
          (o.demolitionReportLabels?.length ?? 0) > 0,
      );

    if (areaNotes.length === 0 && objects.length === 0) continue;

    reportAreas.push({
      areaid: pa.areaid,
      label: projectAreaHeading(pa, areas),
      notes: areaNotes,
      objects,
    });
  }

  return {
    config,
    projectName: project.projectname?.trim() || "Project",
    projectNotes: projectNotesForTrade,
    areas: reportAreas,
    printedAt: new Date(),
  };
}

export function wbTradeReportHasContent(data: WbTradeReportData): boolean {
  if (data.projectNotes.length > 0) return true;
  return data.areas.some(
    (a) =>
      a.notes.length > 0 ||
      a.objects.some(
        (o) =>
          o.lines.length > 0 ||
          o.notes.length > 0 ||
          Boolean(o.tradeLabourSummary) ||
          (o.demolitionReportLabels?.length ?? 0) > 0,
      ),
  );
}
