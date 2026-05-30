import type { AreaPublic } from "@/types/area";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ScopePublic } from "@/types/scope";
import { scopeAppliesToProjectTemplate, sortOrderInArea } from "@/lib/scope-areas";

function sortTemplateScopesForArea(
  rows: ScopePublic[],
  templateDocId: string | null,
): ScopePublic[] {
  return [...rows].sort((a, b) => {
    if (!templateDocId) {
      const ao = a.sortOrder;
      const bo = b.sortOrder;
      const aHas = typeof ao === "number" && Number.isFinite(ao);
      const bHas = typeof bo === "number" && Number.isFinite(bo);
      if (aHas && bHas && ao !== bo) return ao - bo;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return (a.scopeid ?? 0) - (b.scopeid ?? 0);
    }
    const ao = sortOrderInArea(a, templateDocId);
    const bo = sortOrderInArea(b, templateDocId);
    if (ao !== bo) return ao - bo;
    return (a.scopeid ?? 0) - (b.scopeid ?? 0) || a.id.localeCompare(b.id);
  });
}

/**
 * Scopes for a project area: template-tagged scopes (ordered) plus optional `extraScopeDocIds`
 * attached only on this project area (checklist “Add scope”).
 */
export function scopesForProjectArea(
  pa: ProjectAreaPublic,
  areas: AreaPublic[],
  scopes: ScopePublic[],
): ScopePublic[] {
  const aid = Number(pa.areaid);
  if (!Number.isInteger(aid)) return [];

  const templateArea = areas.find((a) => a.areaid != null && Number(a.areaid) === aid);
  const templateDocId = templateArea?.id ?? null;

  const base = scopes.filter((s) => scopeAppliesToProjectTemplate(s, templateDocId, aid));
  const sortedBase = sortTemplateScopesForArea(base, templateDocId);
  const baseIds = new Set(sortedBase.map((s) => s.id));

  const extraIds = pa.extraScopeDocIds ?? [];
  const byId = new Map(scopes.map((s) => [s.id, s]));
  const extras: ScopePublic[] = [];
  for (const id of extraIds) {
    const s = byId.get(id);
    if (!s || s.kind !== "question" || baseIds.has(id)) continue;
    extras.push(s);
  }

  return [...sortedBase, ...extras];
}
