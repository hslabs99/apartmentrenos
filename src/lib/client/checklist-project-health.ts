import { isBlindsSystemLine } from "@/lib/blinds/blinds-data-utils";
import { isLabourChecklistLine } from "@/lib/client/labour-checklist-line";
import { partitionAreaLines } from "@/lib/client/partition-area-lines";
import {
  projectLineObjectLabel,
  quoteObjectForScopeLine,
  isOrphanQuoteObjectLine,
} from "@/lib/client/project-line-quote-object";
import { scopeSkuFiltersForProjectArea } from "@/lib/client/scope-answer-force-availability";
import {
  expectedShowAllCatalogSkus,
  missingShowAllExpectedSkus,
  scopeObjectIsShowAll,
} from "@/lib/client/scope-show-all-expected";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import { projectLineHasOrphanSku } from "@/lib/health-check/orphan-refs";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import {
  clRedundantScopeAnchorId,
  leftoverHintsByScopeDocId,
  redundantScopeEntriesForProjectArea,
} from "@/lib/redundant-scopes-for-project-area";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import type { AreaPublic } from "@/types/area";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

export type ChecklistHealthIssueKind =
  | "orphan_sku"
  | "underpopulated"
  | "orphan_object"
  | "redundant_scope";

export type ChecklistHealthIssue = {
  id: string;
  kind: ChecklistHealthIssueKind;
  label: string;
  detail: string;
  areaName: string;
  lineId?: string;
  areaId?: string;
  /** Checklist DOM id for leftover scopes that have no visible line. */
  anchorId?: string;
};

function skuProductLabel(line: ProjectAreaObjectPublic): string {
  return line.skuProduct?.trim() || line.skuId?.trim() || "this line";
}

/**
 * Live checklist issues for one project (orphan SKUs/objects, incomplete Show All, leftover scopes).
 */
export function collectChecklistProjectHealthIssues(args: {
  projectAreas: readonly ProjectAreaPublic[];
  areas: readonly AreaPublic[];
  scopes: readonly ScopePublic[];
  objectsByProjectAreaDocId: Map<string, ProjectAreaObjectPublic[]>;
  quoteObjects: readonly QuoteObjectPublic[];
  catalogSkus: readonly DataSkuPublic[];
  currentSkuIds: ReadonlySet<string>;
  project: ProjectPublic | null;
  priceLevels: readonly PriceLevelPublic[];
  cascades: readonly CascadeRow[];
  colourLookupIndex: ColourLookupIndex | null;
}): ChecklistHealthIssue[] {
  const issues: ChecklistHealthIssue[] = [];
  const quoteObjects = [...args.quoteObjects];
  const catalogSkus = [...args.catalogSkus];
  const scopes = [...args.scopes];
  const areas = [...args.areas];
  const projectHints = leftoverHintsByScopeDocId(args.objectsByProjectAreaDocId);

  for (const pa of args.projectAreas) {
    const areaName = projectAreaHeading(pa, areas);
    const rows = args.objectsByProjectAreaDocId.get(pa.id) ?? [];
    const { topLevel } = partitionAreaLines(rows);
    const filters = scopeSkuFiltersForProjectArea(
      pa,
      args.project,
      [...args.priceLevels],
      [...args.cascades],
    );

    for (const entry of redundantScopeEntriesForProjectArea(
      pa,
      areas,
      scopes,
      rows,
      projectHints,
    )) {
      const gone = entry.scopeMissing
        ? "The question was deleted from Setup, so it does not appear in this area's list."
        : `The question is no longer on the ${areaName} template, so it does not appear in this area's list.`;
      const leftover = entry.leftoverLineSummaries.length
        ? ` Leftover lines still stored: ${entry.leftoverLineSummaries.slice(0, 8).join("; ")}.`
        : entry.lineCount > 0
          ? ` ${entry.lineCount} leftover line${entry.lineCount === 1 ? "" : "s"} are still stored.`
          : " No leftover lines — only a stored answer remains.";
      const answer = entry.answerLabel ? ` Answer was: ${entry.answerLabel}.` : "";
      issues.push({
        id: `redundant:${pa.id}:${entry.scopeDocId}:${entry.scopeInstanceId ?? ""}`,
        kind: "redundant_scope",
        label: entry.questionLabel,
        detail: `Included in ${areaName}. ${gone}${leftover}${answer} Open this item to remove it.`,
        areaName,
        areaId: pa.id,
        anchorId: clRedundantScopeAnchorId(pa.id, entry.scopeDocId),
      });
    }

    const byObject = new Map<string, ProjectAreaObjectPublic[]>();
    for (const line of topLevel) {
      if (isBlindsSystemLine(line) || isLabourChecklistLine(line, quoteObjects)) continue;
      const key = `${line.scopeDocId ?? ""}:${line.scopeInstanceId ?? ""}:${line.objectid}`;
      const list = byObject.get(key) ?? [];
      list.push(line);
      byObject.set(key, list);
    }

    for (const line of topLevel) {
      if (isBlindsSystemLine(line) || isLabourChecklistLine(line, quoteObjects)) continue;
      if (isOrphanQuoteObjectLine(line, quoteObjects)) {
        issues.push({
          id: `orphan-object:${line.id}`,
          kind: "orphan_object",
          label: projectLineObjectLabel(line, quoteObjects, catalogSkus),
          detail: "Quote object is no longer in Setup. Remove this line, then add a current object.",
          areaName,
          lineId: line.id,
          areaId: pa.id,
        });
      }
      if (projectLineHasOrphanSku(line, args.currentSkuIds)) {
        issues.push({
          id: `orphan-sku:${line.id}`,
          kind: "orphan_sku",
          label: `${projectLineObjectLabel(line, quoteObjects, catalogSkus)} · ${skuProductLabel(line)}`,
          detail: "SKU is not in the current catalog. Pick a replacement or Repopulate SKUs.",
          areaName,
          lineId: line.id,
          areaId: pa.id,
        });
      }
    }

    if (catalogSkus.length === 0) continue;

    for (const objectLines of byObject.values()) {
      const first = objectLines[0];
      if (!first || first.linesource !== "scope") continue;
      const scope = scopes.find((s) => s.id === first.scopeDocId);
      const qObj = quoteObjectForScopeLine(first, scope, quoteObjects);
      if (!scopeObjectIsShowAll(objectLines, qObj, scope)) continue;
      const expected = expectedShowAllCatalogSkus(
        objectLines,
        qObj,
        catalogSkus,
        filters,
        args.colourLookupIndex,
      );
      const missing = missingShowAllExpectedSkus(objectLines, expected, catalogSkus);
      const underPopulated = missing.length > 0 || expected.length > objectLines.length;
      if (!underPopulated) continue;
      const objectLabel = projectLineObjectLabel(first, quoteObjects, catalogSkus);
      issues.push({
        id: `underpop:${pa.id}:${first.scopeDocId ?? ""}:${first.scopeInstanceId ?? ""}:${first.objectid}`,
        kind: "underpopulated",
        label: objectLabel,
        detail: `Show All should list ${expected.length} catalog ${expected.length === 1 ? "line" : "lines"}; this object has ${objectLines.length}. Open ⋯ and choose Repopulate SKUs.`,
        areaName,
        lineId: first.id,
        areaId: pa.id,
      });
    }
  }

  return issues;
}
