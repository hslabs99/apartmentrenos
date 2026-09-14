import { isSystemScopeObjectId } from "@/lib/system-scope-types";
import type { HealthCheckAnswerIssue, HealthCheckReport } from "@/types/health-check";
import type { ScopeAnswerPublic, ScopePublic } from "@/types/scope";

export type QuoteObjectCatalogIndex = {
  ids: ReadonlySet<string>;
  namesLower: ReadonlySet<string>;
  numericIds: ReadonlySet<number>;
};

export function integerObjectId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return undefined;
}

export function normalizeQuoteObjectName(value: string): string {
  return value.trim().toLowerCase();
}

export function scopeHref(scopeDocId: string): string {
  return `/setup?tab=scopes&scopeId=${encodeURIComponent(scopeDocId)}`;
}

export function projectChecklistHref(projectDocId: string): string {
  return `/projects/project/checklist?id=${encodeURIComponent(projectDocId)}`;
}

export function projectChecklistLineHref(projectDocId: string, lineId: string): string {
  return `/projects/project/checklist?id=${encodeURIComponent(projectDocId)}&line=${encodeURIComponent(lineId)}`;
}

export function setupAreasHref(): string {
  return "/setup?tab=areas";
}

export function shouldSkipProjectLineForHealthCheck(line: {
  linesource?: string | null;
  systemObjectKind?: string | null;
}): boolean {
  if (line.systemObjectKind) return true;
  if (line.linesource === "bundled") return true;
  return false;
}

/** Current catalog SKU ids (`isCurrent !== false`). Includes doc id and `skuId`. */
export function currentCatalogSkuIdSet(
  rows: readonly { id?: string; skuId?: string | null; isCurrent?: boolean }[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.isCurrent === false) continue;
    const skuId = typeof row.skuId === "string" ? row.skuId.trim() : "";
    if (skuId) ids.add(skuId);
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (id) ids.add(id);
  }
  return ids;
}

/** Line stores a SKU that is missing from the current catalog. */
export function projectLineHasOrphanSku(
  line: {
    skuId?: string | null;
    systemObjectKind?: string | null;
    linesource?: string | null;
  },
  currentSkuIds: ReadonlySet<string>,
): boolean {
  if (shouldSkipProjectLineForHealthCheck(line)) return false;
  const skuId = typeof line.skuId === "string" ? line.skuId.trim() : "";
  if (!skuId) return false;
  return !currentSkuIds.has(skuId);
}

export function answerMissingQuoteObjects(
  answer: Pick<ScopeAnswerPublic, "attachedQuoteObjectIds" | "attachedObjectNames" | "answerid" | "label">,
  catalog: QuoteObjectCatalogIndex,
): HealthCheckAnswerIssue | null {
  const missingIds: string[] = [];
  const missingNames: string[] = [];
  const ids = (answer.attachedQuoteObjectIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length > 0) {
    for (const id of ids) {
      if (isSystemScopeObjectId(id)) continue;
      if (!catalog.ids.has(id)) missingIds.push(id);
    }
  } else {
    for (const name of answer.attachedObjectNames ?? []) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      if (!catalog.namesLower.has(normalizeQuoteObjectName(trimmed))) {
        missingNames.push(trimmed);
      }
    }
  }

  if (missingIds.length === 0 && missingNames.length === 0) return null;
  return {
    answerid: answer.answerid,
    answerLabel: answer.label,
    missingIds,
    missingNames,
  };
}

export function scopeMissingObjectFindings(
  scope: Pick<ScopePublic, "kind" | "answers">,
  catalog: QuoteObjectCatalogIndex,
): HealthCheckAnswerIssue[] {
  if (scope.kind === "header" || scope.kind === "footer") return [];
  const out: HealthCheckAnswerIssue[] = [];
  for (const answer of scope.answers ?? []) {
    const issue = answerMissingQuoteObjects(answer, catalog);
    if (issue) out.push(issue);
  }
  return out;
}

export function scopeHasMissingQuoteObjects(
  scope: Pick<ScopePublic, "kind" | "answers">,
  catalog: QuoteObjectCatalogIndex,
): boolean {
  return scopeMissingObjectFindings(scope, catalog).length > 0;
}

export function quoteObjectCatalogFromRows(
  rows: readonly { id: string; objectid?: number | null; objectname: string }[],
): QuoteObjectCatalogIndex {
  const ids = new Set<string>();
  const namesLower = new Set<string>();
  const numericIds = new Set<number>();
  for (const row of rows) {
    const id = row.id.trim();
    if (id) ids.add(id);
    const name = normalizeQuoteObjectName(row.objectname);
    if (name) namesLower.add(name);
    const oid = integerObjectId(row.objectid);
    if (oid !== undefined) numericIds.add(oid);
  }
  return { ids, namesLower, numericIds };
}

export function emptyHealthCheckReport(partial?: Partial<{
  deepScan: boolean;
  quoteObjectCount: number;
  skuCount: number;
  scopesScanned: number;
  areaObjectsScanned: number;
  projectsScanned: number;
  linesScanned: number;
}>): HealthCheckReport {
  return {
    generatedAt: new Date().toISOString(),
    deepScan: partial?.deepScan ?? false,
    quoteObjectCount: partial?.quoteObjectCount ?? 0,
    skuCount: partial?.skuCount ?? 0,
    scopesScanned: partial?.scopesScanned ?? 0,
    areaObjectsScanned: partial?.areaObjectsScanned ?? 0,
    projectsScanned: partial?.projectsScanned ?? 0,
    linesScanned: partial?.linesScanned ?? 0,
    scopes: [],
    areaObjects: [],
    projects: [],
  };
}

export function healthCheckIssueCount(report: {
  scopes: readonly unknown[];
  areaObjects: readonly unknown[];
  projects: readonly { missingObjects: readonly unknown[]; missingSkus: readonly unknown[] }[];
}): number {
  let n = report.scopes.length + report.areaObjects.length;
  for (const p of report.projects) {
    n += p.missingObjects.length + p.missingSkus.length;
  }
  return n;
}
