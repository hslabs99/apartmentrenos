import { projectLineObjectLabel, quoteObjectForProjectLine } from "@/lib/client/project-line-quote-object";
import { resolveScopeLineSupplier } from "@/lib/client/scope-line-sku-match";
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
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
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
  /** Quote object name (what is being installed). */
  objectType: string;
  skuProduct: string;
  supplier: string;
  /** Supplier’s own SKU/code. */
  supplierSku: string;
  /** Supplier model / description. */
  model: string;
  /** Product URL from the supplier row. */
  link: string;
  quantity: number | null;
  uom: string;
  labourSummary: string;
  /** Workbench line notes — install comments, not trade notes. */
  lineNotes: string;
  bundled: boolean;
  /** Why this line is on the trade report (labour hours and/or trade category). */
  matchSources: WbTradeReportLineMatchSource[];
};

export type WbTradeReportNoteItem = {
  id: string;
  /** Object name when the note is attached to a quote object; otherwise empty. */
  objectLabel: string;
  notetype: string;
  author: string;
  notedatetime: string | null;
  text: string;
};

export type WbTradeReportRetainItem = {
  objectLabel: string;
  labels: string[];
};

export type WbTradeReportArea = {
  areaid: number;
  label: string;
  installs: WbTradeReportLine[];
  notes: WbTradeReportNoteItem[];
  retainItems: WbTradeReportRetainItem[];
};

export type WbTradeReportData = {
  config: WbTradeReportConfig;
  projectName: string;
  projectNotes: WbTradeReportNoteItem[];
  areas: WbTradeReportArea[];
  installCount: number;
  noteCount: number;
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

function finiteOrNull(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) ? n : null;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function supplierInfo(
  line: Pick<
    ProjectAreaObjectPublic,
    "skuId" | "supplierOption" | "manualSupplier" | "manualSupplierSku"
  >,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): { supplier: string; supplierSku: string; model: string; link: string } {
  const row = resolveScopeLineSupplier(line, suppliersBySkuId);
  if (row) {
    return {
      supplier: row.supplier.trim(),
      supplierSku: line.manualSupplierSku?.trim() || row.supplierSku.trim(),
      model: row.model.trim(),
      link: row.link.trim(),
    };
  }
  const manual = line.manualSupplier?.trim();
  if (manual) {
    return {
      supplier: manual,
      supplierSku: line.manualSupplierSku?.trim() ?? "",
      model: "",
      link: "",
    };
  }
  return { supplier: "", supplierSku: "", model: "", link: "" };
}

function toNoteItem(
  note: ProjectNotePublic,
  objectLabel = "",
): WbTradeReportNoteItem {
  return {
    id: note.id,
    objectLabel,
    notetype: note.notetype || "Note",
    author: note.author?.trim() ?? "",
    notedatetime: note.notedatetime,
    text: note.note.trim(),
  };
}

function objectLabelForId(
  objectid: number,
  rows: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
): string {
  const labelRow = rows.find((r) => r.objectid === objectid);
  if (labelRow) return projectLineObjectLabel(labelRow, quoteObjects, catalogSkus);
  const q = quoteObjects.find((o) => o.objectid === objectid);
  return q?.objectname?.trim() || `Object ${objectid}`;
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
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
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
    suppliersBySkuId,
    scopes,
    objectsByProjectAreaDocId,
  } = args;

  const projectNotesForTrade = projectLevelTradeNotes(projectNotes, projectid, config).map((n) =>
    toNoteItem(n),
  );

  const reportAreas: WbTradeReportArea[] = [];

  for (const pa of projectAreas) {
    const rows = objectsByProjectAreaDocId.get(pa.id) ?? [];
    const areaNotes = areaLevelTradeNotes(projectNotes, projectid, pa.areaid, config).map((n) =>
      toNoteItem(n),
    );
    const demolitionByObject =
      config.id === "demolition"
        ? demolitionReportLabelsByObjectId(pa, scopes, quoteObjects)
        : new Map<number, string[]>();

    const matchingRows = rows.filter((row) =>
      lineMatchesWorkbenchTradeReport(row, config, quoteObjects, catalogSkus),
    );

    const installs: WbTradeReportLine[] = matchingRows
      .map((row) => {
        const supplier = supplierInfo(row, suppliersBySkuId);
        return {
          id: row.id,
          objectType: projectLineObjectLabel(row, quoteObjects, catalogSkus),
          skuProduct: skuProductLabel(row, catalogSkus),
          supplier: supplier.supplier,
          supplierSku: supplier.supplierSku,
          model: supplier.model,
          link: supplier.link,
          quantity: finiteOrNull(row.custommeasure),
          uom: row.customuom?.trim() ?? "",
          labourSummary: labourSummaryForLine(row, config),
          lineNotes: lineNotesText(row),
          bundled: row.linesource === "bundled",
          matchSources: lineMatchSourcesForReport(row, config, quoteObjects, catalogSkus),
        };
      })
      .sort((a, b) => {
        const objectCmp = compareStrings(a.objectType, b.objectType);
        if (objectCmp !== 0) return objectCmp;
        const skuCmp = compareStrings(a.supplierSku, b.supplierSku);
        if (skuCmp !== 0) return skuCmp;
        return compareStrings(a.model || a.skuProduct, b.model || b.skuProduct);
      });

    const objectIdsWithNotes = new Set<number>();
    for (const n of projectNotes) {
      if (n.projectid !== projectid || n.areaid !== pa.areaid || n.objectid == null) continue;
      if (noteMatchesTradeReport(n, config)) objectIdsWithNotes.add(n.objectid);
    }

    const objectNotes: WbTradeReportNoteItem[] = [];
    for (const objectid of [...objectIdsWithNotes].sort((a, b) => a - b)) {
      const label = objectLabelForId(objectid, rows, quoteObjects, catalogSkus);
      for (const note of objectLevelTradeNotes(
        projectNotes,
        projectid,
        pa.areaid,
        objectid,
        config,
      )) {
        objectNotes.push(toNoteItem(note, label));
      }
    }

    const notes = [...areaNotes, ...objectNotes];

    const retainItems: WbTradeReportRetainItem[] = [...demolitionByObject.entries()]
      .sort(([a], [b]) => a - b)
      .map(([objectid, labels]) => ({
        objectLabel: objectLabelForId(objectid, rows, quoteObjects, catalogSkus),
        labels,
      }))
      .filter((item) => item.labels.length > 0);

    if (installs.length === 0 && notes.length === 0 && retainItems.length === 0) continue;

    reportAreas.push({
      areaid: pa.areaid,
      label: projectAreaHeading(pa, areas),
      installs,
      notes,
      retainItems,
    });
  }

  const installCount = reportAreas.reduce((sum, a) => sum + a.installs.length, 0);
  const noteCount =
    projectNotesForTrade.length + reportAreas.reduce((sum, a) => sum + a.notes.length, 0);

  return {
    config,
    projectName: project.projectname?.trim() || "Project",
    projectNotes: projectNotesForTrade,
    areas: reportAreas,
    installCount,
    noteCount,
    printedAt: new Date(),
  };
}

export function wbTradeReportHasContent(data: WbTradeReportData): boolean {
  if (data.projectNotes.length > 0) return true;
  return data.areas.some(
    (a) => a.installs.length > 0 || a.notes.length > 0 || a.retainItems.length > 0,
  );
}
