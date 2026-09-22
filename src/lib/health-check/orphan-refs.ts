import { isSystemScopeObjectId } from "@/lib/system-scope-types";
import { buildProductIdentityKey } from "@/lib/sku/product-key";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";
import type {
  HealthCheckAnswerIssue,
  HealthCheckMissingObject,
  HealthCheckReport,
} from "@/types/health-check";
import type { ScopeAnswerPublic, ScopePublic } from "@/types/scope";

export type QuoteObjectCatalogIndex = {
  ids: ReadonlySet<string>;
  namesLower: ReadonlySet<string>;
  numericIds: ReadonlySet<number>;
  nameById: ReadonlyMap<string, string>;
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

type CatalogSkuIdentityRow = {
  product?: string | null;
  productType?: string | null;
  isCurrent?: boolean;
};

/** Current catalog Product Type + Product name keys (`isCurrent !== false`). */
export function currentCatalogSkuIdentityKeySet(
  rows: readonly CatalogSkuIdentityRow[],
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.isCurrent === false) continue;
    const key = buildProductIdentityKey(row.productType ?? "", row.product ?? "");
    if (key) keys.add(key);
  }
  return keys;
}

/** Current catalog product names (`isCurrent !== false`). */
export function currentCatalogSkuProductNameSet(
  rows: readonly CatalogSkuIdentityRow[],
): Set<string> {
  const names = new Set<string>();
  for (const row of rows) {
    if (row.isCurrent === false) continue;
    const name = normalizeSkuPart(row.product ?? "");
    if (name) names.add(name);
  }
  return names;
}

function lineMatchesCurrentCatalogProduct(
  line: { skuProduct?: string | null; objectname?: string | null },
  currentIdentities: ReadonlySet<string>,
  currentProductNames: ReadonlySet<string>,
): boolean {
  const product = typeof line.skuProduct === "string" ? line.skuProduct : "";
  if (!normalizeSkuPart(product)) return false;
  const objectname = typeof line.objectname === "string" ? line.objectname : "";
  const identity = buildProductIdentityKey(objectname, product);
  if (identity) return currentIdentities.has(identity);
  return currentProductNames.has(normalizeSkuPart(product));
}

/** Line stores a SKU that is missing from the current catalog. */
export function projectLineHasOrphanSku(
  line: {
    skuId?: string | null;
    skuProduct?: string | null;
    objectname?: string | null;
    systemObjectKind?: string | null;
    linesource?: string | null;
  },
  currentSkuIds: ReadonlySet<string>,
  currentIdentities: ReadonlySet<string> = EMPTY_IDENTITY_KEYS,
  currentProductNames: ReadonlySet<string> = EMPTY_PRODUCT_NAMES,
): boolean {
  if (shouldSkipProjectLineForHealthCheck(line)) return false;
  const skuId = typeof line.skuId === "string" ? line.skuId.trim() : "";
  if (!skuId) return false;
  if (currentSkuIds.has(skuId)) return false;
  return !lineMatchesCurrentCatalogProduct(line, currentIdentities, currentProductNames);
}

const EMPTY_IDENTITY_KEYS: ReadonlySet<string> = new Set();
const EMPTY_PRODUCT_NAMES: ReadonlySet<string> = new Set();

export function formatMissingQuoteObjectItem(item: HealthCheckMissingObject): string {
  return missingQuoteObjectTitle(item);
}

export function missingQuoteObjectTitle(item: HealthCheckMissingObject): string {
  const name = item.name?.trim();
  if (name) return name;
  return "Removed quote object";
}

export function missingQuoteObjectContext(item: HealthCheckMissingObject): string | null {
  const before = item.beforeName?.trim();
  const after = item.afterName?.trim();
  if (before && after) return `Previously listed between “${before}” and “${after}”`;
  if (before) return `Previously listed after “${before}”`;
  if (after) return `Previously listed before “${after}”`;
  return null;
}

type AnswerNameFields = Pick<
  ScopeAnswerPublic,
  "attachedQuoteObjectIds" | "attachedObjectNames" | "attachedObjectNameById"
>;

function consumeMatchingName(remaining: string[], name: string): void {
  const key = normalizeQuoteObjectName(name);
  if (!key) return;
  const idx = remaining.findIndex((n) => normalizeQuoteObjectName(n) === key);
  if (idx >= 0) remaining.splice(idx, 1);
}

/** Best-effort names for attached ids: live catalog, stored map, then leftover denormalized names. */
export function resolveAttachedObjectNames(
  answer: AnswerNameFields,
  catalog: QuoteObjectCatalogIndex,
): Record<string, string> {
  const ids = (answer.attachedQuoteObjectIds ?? []).map((id) => id.trim()).filter(Boolean);
  const stored = answer.attachedObjectNameById ?? {};
  const remaining = (answer.attachedObjectNames ?? []).map((n) => n.trim()).filter(Boolean);
  const out: Record<string, string> = {};

  for (const id of ids) {
    if (isSystemScopeObjectId(id)) {
      const storedName = stored[id]?.trim();
      if (storedName) out[id] = storedName;
      continue;
    }
    const live = catalog.nameById.get(id)?.trim();
    if (live) {
      out[id] = live;
      consumeMatchingName(remaining, live);
      continue;
    }
    const storedName = stored[id]?.trim();
    if (storedName) out[id] = storedName;
  }

  const unnamedMissing = ids.filter(
    (id) => !isSystemScopeObjectId(id) && !catalog.ids.has(id) && !out[id],
  );
  const canAssign =
    remaining.length > 0 &&
    (remaining.length === unnamedMissing.length ||
      (remaining.length === 1 && unnamedMissing.length === 1));
  if (canAssign) {
    const take = Math.min(remaining.length, unnamedMissing.length);
    for (let i = 0; i < take; i++) {
      const id = unnamedMissing[i]!;
      const name = remaining[i]!;
      if (id && name) out[id] = name;
    }
  }

  return out;
}

export function quoteObjectNameHintsFromAnswers(
  answers: readonly AnswerNameFields[],
  catalog: QuoteObjectCatalogIndex,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const answer of answers) {
    Object.assign(out, resolveAttachedObjectNames(answer, catalog));
  }
  return out;
}

function neighborResolvedName(
  ids: string[],
  index: number,
  resolved: Record<string, string>,
): string | undefined {
  const id = ids[index];
  if (!id) return undefined;
  const name = resolved[id]?.trim();
  return name || undefined;
}

export function answerMissingQuoteObjects(
  answer: Pick<
    ScopeAnswerPublic,
    | "attachedQuoteObjectIds"
    | "attachedObjectNames"
    | "attachedObjectNameById"
    | "answerid"
    | "label"
  >,
  catalog: QuoteObjectCatalogIndex,
): HealthCheckAnswerIssue | null {
  const missingIds: string[] = [];
  const missingNames: string[] = [];
  const missingItems: HealthCheckMissingObject[] = [];
  const ids = (answer.attachedQuoteObjectIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  const resolved = resolveAttachedObjectNames(answer, catalog);

  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      if (isSystemScopeObjectId(id)) continue;
      if (catalog.ids.has(id)) continue;
      missingIds.push(id);
      const name = resolved[id]?.trim() || undefined;
      missingItems.push({
        id,
        name,
        beforeName: neighborResolvedName(ids, i - 1, resolved),
        afterName: neighborResolvedName(ids, i + 1, resolved),
      });
    }
  } else {
    const names = (answer.attachedObjectNames ?? []).map((name) => name.trim());
    for (const name of names) {
      if (!name) continue;
      if (!catalog.namesLower.has(normalizeQuoteObjectName(name))) {
        missingNames.push(name);
        missingItems.push({ name });
      }
    }
  }

  if (missingItems.length === 0) return null;
  return {
    answerid: answer.answerid,
    answerLabel: answer.label,
    missingIds,
    missingNames,
    missingItems,
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
  const nameById = new Map<string, string>();
  for (const row of rows) {
    const id = row.id.trim();
    if (id) ids.add(id);
    const objectname = row.objectname.trim();
    if (id && objectname) nameById.set(id, objectname);
    const name = normalizeQuoteObjectName(row.objectname);
    if (name) namesLower.add(name);
    const oid = integerObjectId(row.objectid);
    if (oid !== undefined) numericIds.add(oid);
  }
  return { ids, namesLower, numericIds, nameById };
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
