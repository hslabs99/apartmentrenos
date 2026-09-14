import { collectScopeInstanceIds } from "@/lib/scope-instance";
import { scopesForProjectArea } from "@/lib/scopes-for-project-area";
import type { AreaPublic } from "@/types/area";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ScopePublic } from "@/types/scope";

export type RedundantScopeEntry = {
  scopeDocId: string;
  scopeInstanceId: string | null;
  questionLabel: string;
  answerLabel: string | null;
  lineCount: number;
  instanceCount: number;
  scopeMissing: boolean;
  leftoverObjectNames: string[];
  leftoverLineSummaries: string[];
  hasLeftoverAnswer: boolean;
};

export type ProjectRedundantScopeEntry = RedundantScopeEntry & {
  projectAreaDocId: string;
  areaLabel: string;
};

/** Checklist DOM id for a leftover scope card (health-check jump target). */
export function clRedundantScopeAnchorId(
  projectAreaDocId: string,
  scopeDocId: string,
): string {
  return `cl-redundant-${projectAreaDocId}-${scopeDocId}`;
}

export type RedundantScopeHint = {
  objectNames: string[];
  lineSummaries: string[];
  scopeid: number | null;
};

type ScopeLineLike = {
  linesource?: string;
  scopeDocId?: string | null;
  scopeInstanceId?: string | null;
  objectname?: string | null;
  skuProduct?: string | null;
  scopeid?: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for Firestore / UUID tokens that should never be shown as a question or answer. */
export function looksLikeOpaqueSystemId(value: string): boolean {
  const s = value.trim();
  if (!s) return true;
  if (UUID_RE.test(s)) return true;
  if (/\s/.test(s)) return false;
  return /^[A-Za-z0-9_-]{16,}$/.test(s);
}

function uniqueLabels(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const name = raw.trim();
    if (!name || looksLikeOpaqueSystemId(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function formatList(names: string[], limit = 5): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, limit);
  const extra = names.length > limit ? ` and ${names.length - limit} more` : "";
  return `${shown.join(", ")}${extra}`;
}

function leftoverObjectNamesForScope(
  scopeDocId: string,
  rows: ReadonlyArray<ScopeLineLike>,
): string[] {
  return uniqueLabels(
    rows.flatMap((row) => {
      if (row.linesource !== "scope" || row.scopeDocId !== scopeDocId) return [];
      return [(row.objectname ?? "").trim() || (row.skuProduct ?? "").trim()];
    }),
  );
}

function leftoverLineSummariesForScope(
  scopeDocId: string,
  rows: ReadonlyArray<ScopeLineLike>,
): string[] {
  return uniqueLabels(
    rows.flatMap((row) => {
      if (row.linesource !== "scope" || row.scopeDocId !== scopeDocId) return [];
      const obj = (row.objectname ?? "").trim();
      const sku = (row.skuProduct ?? "").trim();
      if (obj && sku && sku.toLowerCase() !== obj.toLowerCase()) {
        return [`${obj} — ${sku}`];
      }
      return [obj || sku];
    }),
  );
}

function numericScopeIdFromLines(
  scopeDocId: string,
  rows: ReadonlyArray<ScopeLineLike>,
): number | null {
  for (const row of rows) {
    if (row.scopeDocId !== scopeDocId) continue;
    const n = row.scopeid;
    if (typeof n === "number" && Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

function mergeHints(a: RedundantScopeHint, b: RedundantScopeHint): RedundantScopeHint {
  return {
    objectNames: uniqueLabels([...a.objectNames, ...b.objectNames]),
    lineSummaries: uniqueLabels([...a.lineSummaries, ...b.lineSummaries]),
    scopeid: a.scopeid ?? b.scopeid,
  };
}

function hintFromRows(
  scopeDocId: string,
  rows: ReadonlyArray<ScopeLineLike>,
): RedundantScopeHint {
  return {
    objectNames: leftoverObjectNamesForScope(scopeDocId, rows),
    lineSummaries: leftoverLineSummariesForScope(scopeDocId, rows),
    scopeid: numericScopeIdFromLines(scopeDocId, rows),
  };
}

/** Leftover objects / SKUs for deleted scopes, keyed by Setup scope document id. */
export function leftoverHintsByScopeDocId(
  rowsByProjectAreaDocId: ReadonlyMap<string, ReadonlyArray<ScopeLineLike>>,
): Map<string, RedundantScopeHint> {
  const out = new Map<string, RedundantScopeHint>();
  for (const rows of rowsByProjectAreaDocId.values()) {
    for (const row of rows) {
      if (row.linesource !== "scope" || !row.scopeDocId) continue;
      const next = hintFromRows(row.scopeDocId, rows);
      const prev = out.get(row.scopeDocId);
      out.set(row.scopeDocId, prev ? mergeHints(prev, next) : next);
    }
  }
  return out;
}

function scopeQuestionLabel(
  scopeDocId: string,
  scopes: ScopePublic[],
  localHint: RedundantScopeHint,
  projectHint: RedundantScopeHint | undefined,
): string {
  const hit = scopes.find((s) => s.id === scopeDocId);
  const q = (hit?.question ?? "").trim();
  if (q) return q;
  if (hit?.scopeid != null) return `Scope ${hit.scopeid}`;

  const objects = uniqueLabels([
    ...localHint.objectNames,
    ...(projectHint?.objectNames ?? []),
  ]);
  const summaries = uniqueLabels([
    ...localHint.lineSummaries,
    ...(projectHint?.lineSummaries ?? []),
  ]);
  const scopeid = localHint.scopeid ?? projectHint?.scopeid ?? null;
  const objectText = formatList(objects);
  if (objectText) return objectText;
  const summaryText = formatList(summaries);
  if (summaryText) return summaryText;
  if (scopeid != null) return `Deleted question (scope ${scopeid})`;
  return "Deleted question — leftover answer only";
}

function answerLabelForEntry(
  scopeDocId: string,
  answerid: string | null | undefined,
  scopes: ScopePublic[],
): string | null {
  if (!answerid) return null;
  const scope = scopes.find((s) => s.id === scopeDocId);
  const hit = scope?.answers.find((a) => a.answerid === answerid);
  const label = hit?.label?.trim() || "";
  if (!label || looksLikeOpaqueSystemId(label)) return null;
  return label;
}

/** Scope answers/lines on a project area that no longer apply via template tags or extra scopes. */
export function redundantScopeEntriesForProjectArea(
  pa: ProjectAreaPublic,
  areas: AreaPublic[],
  scopes: ScopePublic[],
  rows: ReadonlyArray<ScopeLineLike>,
  projectHints?: ReadonlyMap<string, RedundantScopeHint>,
): RedundantScopeEntry[] {
  const activeIds = new Set(scopesForProjectArea(pa, areas, scopes).map((s) => s.id));
  const redundantDocIds = new Set<string>();

  for (const entry of pa.scopeAnswers ?? []) {
    if (entry.scopeDocId && !activeIds.has(entry.scopeDocId)) {
      redundantDocIds.add(entry.scopeDocId);
    }
  }
  for (const row of rows) {
    if (row.linesource === "scope" && row.scopeDocId && !activeIds.has(row.scopeDocId)) {
      redundantDocIds.add(row.scopeDocId);
    }
  }
  for (const id of pa.extraScopeDocIds ?? []) {
    if (id && !activeIds.has(id)) redundantDocIds.add(id);
  }
  for (const mv of pa.scopeMetricValues ?? []) {
    if (mv.scopeDocId && !activeIds.has(mv.scopeDocId)) redundantDocIds.add(mv.scopeDocId);
  }

  const out: RedundantScopeEntry[] = [];
  for (const scopeDocId of redundantDocIds) {
    const scopeMissing = !scopes.some((s) => s.id === scopeDocId);
    const instanceIds = collectScopeInstanceIds(scopeDocId, pa.scopeAnswers, rows);
    let lineCount = 0;
    let answerLabel: string | null = null;
    let hasLeftoverAnswer = false;
    let hasData = false;
    for (const scopeInstanceId of instanceIds) {
      const saved = pa.scopeAnswers?.find(
        (e) =>
          e.scopeDocId === scopeDocId &&
          (e.scopeInstanceId?.trim() || null) === scopeInstanceId,
      );
      lineCount += rows.filter(
        (r) =>
          r.linesource === "scope" &&
          r.scopeDocId === scopeDocId &&
          (r.scopeInstanceId?.trim() || null) === scopeInstanceId,
      ).length;
      if (saved?.answerid) {
        hasData = true;
        hasLeftoverAnswer = true;
        answerLabel =
          answerLabelForEntry(scopeDocId, saved.answerid, scopes) ?? answerLabel;
      }
      if (lineCount > 0) hasData = true;
    }
    if (!hasData) {
      const hasExtraOnly = (pa.extraScopeDocIds ?? []).includes(scopeDocId);
      const hasMetricOnly = (pa.scopeMetricValues ?? []).some(
        (v) => v.scopeDocId === scopeDocId,
      );
      if (!hasExtraOnly && !hasMetricOnly) continue;
    }
    const localHint = hintFromRows(scopeDocId, rows);
    out.push({
      scopeDocId,
      scopeInstanceId: null,
      questionLabel: scopeQuestionLabel(
        scopeDocId,
        scopes,
        localHint,
        projectHints?.get(scopeDocId),
      ),
      answerLabel,
      lineCount,
      instanceCount: instanceIds.length,
      scopeMissing,
      leftoverObjectNames: localHint.objectNames,
      leftoverLineSummaries: localHint.lineSummaries,
      hasLeftoverAnswer,
    });
  }
  return out.sort((a, b) => a.questionLabel.localeCompare(b.questionLabel));
}

/** Redundant scope question data anywhere on a project (one row per area + scope). */
export function redundantScopeEntriesForProject(
  projectAreas: ReadonlyArray<ProjectAreaPublic>,
  areas: AreaPublic[],
  scopes: ScopePublic[],
  rowsByProjectAreaDocId: ReadonlyMap<string, ReadonlyArray<ScopeLineLike>>,
  areaLabel: (pa: ProjectAreaPublic) => string,
): ProjectRedundantScopeEntry[] {
  const projectHints = leftoverHintsByScopeDocId(rowsByProjectAreaDocId);
  const out: ProjectRedundantScopeEntry[] = [];
  for (const pa of projectAreas) {
    const rows = rowsByProjectAreaDocId.get(pa.id) ?? [];
    for (const entry of redundantScopeEntriesForProjectArea(
      pa,
      areas,
      scopes,
      rows,
      projectHints,
    )) {
      out.push({
        ...entry,
        projectAreaDocId: pa.id,
        areaLabel: areaLabel(pa),
      });
    }
  }
  return out.sort(
    (a, b) =>
      a.areaLabel.localeCompare(b.areaLabel, undefined, { sensitivity: "base" }) ||
      a.questionLabel.localeCompare(b.questionLabel, undefined, { sensitivity: "base" }),
  );
}
