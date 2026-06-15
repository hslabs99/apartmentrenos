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
};

export type ProjectRedundantScopeEntry = RedundantScopeEntry & {
  projectAreaDocId: string;
  areaLabel: string;
};

type ScopeLineLike = {
  linesource?: string;
  scopeDocId?: string | null;
  scopeInstanceId?: string | null;
};

function scopeQuestionLabel(scopeDocId: string, scopes: ScopePublic[]): string {
  const hit = scopes.find((s) => s.id === scopeDocId);
  const q = (hit?.question ?? "").trim();
  if (q) return q;
  if (hit?.scopeid != null) return `Scope ${hit.scopeid}`;
  return `Removed scope (${scopeDocId.slice(0, 8)}…)`;
}

function answerLabelForEntry(
  scopeDocId: string,
  answerid: string | null | undefined,
  scopes: ScopePublic[],
): string | null {
  if (!answerid) return null;
  const scope = scopes.find((s) => s.id === scopeDocId);
  const hit = scope?.answers.find((a) => a.answerid === answerid);
  return hit?.label?.trim() || answerid;
}

/** Scope answers/lines on a project area that no longer apply via template tags or extra scopes. */
export function redundantScopeEntriesForProjectArea(
  pa: ProjectAreaPublic,
  areas: AreaPublic[],
  scopes: ScopePublic[],
  rows: ReadonlyArray<ScopeLineLike>,
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
    out.push({
      scopeDocId,
      scopeInstanceId: null,
      questionLabel: scopeQuestionLabel(scopeDocId, scopes),
      answerLabel,
      lineCount,
      instanceCount: instanceIds.length,
      scopeMissing,
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
  const out: ProjectRedundantScopeEntry[] = [];
  for (const pa of projectAreas) {
    const rows = rowsByProjectAreaDocId.get(pa.id) ?? [];
    for (const entry of redundantScopeEntriesForProjectArea(pa, areas, scopes, rows)) {
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
