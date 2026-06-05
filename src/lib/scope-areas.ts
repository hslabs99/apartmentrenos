import type { AreaPublic } from "@/types/area";
import type { ScopePublic } from "@/types/scope";

/** Raw scope fields from Firestore or API (avoids importing firebase-admin in client bundles). */
export type ScopeAreaFirestoreLike = Record<string, unknown>;

/** Parse Firestore map `sortOrderByAreaDocId` to a plain record. */
export function sortOrderMapFromFirestore(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** Dedupe preserve order. */
export function dedupeAreaDocIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = String(id ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Canonical area tags + per-area sort from a scope document (supports legacy `areaid` / `sortOrder`).
 */
export function normalizedScopeAreaState(
  data: ScopeAreaFirestoreLike,
  docIdByAreaid: Map<number, string>,
): { areaDocIds: string[]; sortOrderByAreaDocId: Record<string, number> } {
  const rawIds = data.areaDocIds;
  if (Array.isArray(rawIds) && rawIds.length > 0) {
    const areaDocIds = dedupeAreaDocIds(rawIds.filter((x): x is string => typeof x === "string"));
    const sortOrderByAreaDocId = sortOrderMapFromFirestore(data.sortOrderByAreaDocId);
    return { areaDocIds, sortOrderByAreaDocId };
  }
  const aid = Number(data.areaid ?? NaN);
  if (!Number.isInteger(aid)) {
    return { areaDocIds: [], sortOrderByAreaDocId: {} };
  }
  const docId = docIdByAreaid.get(aid) ?? "";
  if (!docId) {
    return { areaDocIds: [], sortOrderByAreaDocId: {} };
  }
  const so = data.sortOrder;
  const ord = typeof so === "number" && Number.isFinite(so) ? so : 0;
  return {
    areaDocIds: [docId],
    sortOrderByAreaDocId: { [docId]: ord },
  };
}

export function scopeTagsIncludeAreaDocId(
  data: ScopeAreaFirestoreLike,
  areaDocId: string,
  docIdByAreaid: Map<number, string>,
): boolean {
  const { areaDocIds } = normalizedScopeAreaState(data, docIdByAreaid);
  return areaDocIds.includes(areaDocId);
}

/** Sort key: template area order (sortOrder, name), then per-area scope order within that area. */
export function compareScopesForGlobalList(a: ScopePublic, b: ScopePublic, areas: AreaPublic[]): number {
  const orderIndex = (areaDocId: string): number => {
    const ar = areas.find((x) => x.id === areaDocId);
    const so = ar?.sortOrder;
    if (typeof so === "number" && Number.isFinite(so)) return so;
    return 1e9;
  };
  const primary = (s: ScopePublic): { bucket: number; ord: number; id: string } => {
    const tags = s.areaDocIds ?? [];
    const map = s.sortOrderByAreaDocId ?? {};
    if (tags.length === 0) {
      return { bucket: 1e9, ord: s.sortOrder ?? 1e9, id: s.id };
    }
    let bestBucket = 1e9;
    let bestOrd = 1e9;
    for (const ad of tags) {
      const bi = orderIndex(ad);
      const ord = map[ad];
      const o = typeof ord === "number" && Number.isFinite(ord) ? ord : s.sortOrder ?? 1e9;
      if (bi < bestBucket || (bi === bestBucket && o < bestOrd)) {
        bestBucket = bi;
        bestOrd = o;
      }
    }
    return { bucket: bestBucket, ord: bestOrd, id: s.id };
  };
  const pa = primary(a);
  const pb = primary(b);
  if (pa.bucket !== pb.bucket) return pa.bucket - pb.bucket;
  if (pa.ord !== pb.ord) return pa.ord - pb.ord;
  return (a.scopeid ?? 0) - (b.scopeid ?? 0) || a.id.localeCompare(b.id);
}

export function sortOrderInArea(
  s: ScopePublic,
  contextAreaDocId: string,
): number {
  const map = s.sortOrderByAreaDocId ?? {};
  const v = map[contextAreaDocId];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const tags = s.areaDocIds ?? [];
  if (
    tags.length === 1 &&
    tags[0] === contextAreaDocId &&
    s.sortOrder != null &&
    Number.isFinite(s.sortOrder)
  ) {
    return s.sortOrder;
  }
  return 1e9;
}

export function scopeAppliesToProjectTemplate(
  s: ScopePublic,
  templateAreaDocId: string | null,
  templateAreaid: number,
): boolean {
  const tags = s.areaDocIds ?? [];
  if (templateAreaDocId && tags.includes(templateAreaDocId)) return true;
  if (Number.isInteger(templateAreaid) && s.areaid === templateAreaid) return true;
  if (templateAreaDocId && s.areaDocId === templateAreaDocId) return true;
  return false;
}

/** True when a setup scope is tagged for a template area (picker filter / display). */
export function scopeTaggedForSetupAreaDocId(
  s: ScopePublic,
  setupAreaDocId: string,
  templateArea?: Pick<AreaPublic, "id" | "areaid"> | null,
): boolean {
  const docId = setupAreaDocId.trim();
  if (!docId) return false;
  const tags = s.areaDocIds ?? [];
  if (tags.includes(docId)) return true;
  if (s.areaDocId === docId) return true;
  const aid = templateArea?.areaid;
  if (aid != null && Number.isInteger(Number(aid)) && Number(s.areaid) === Number(aid)) {
    return true;
  }
  return false;
}

export function compareSetupAreasDisplayOrder(a: AreaPublic, b: AreaPublic): number {
  const ao = a.sortOrder;
  const bo = b.sortOrder;
  const aHas = typeof ao === "number" && Number.isFinite(ao);
  const bHas = typeof bo === "number" && Number.isFinite(bo);
  if (aHas && bHas && ao !== bo) return ao - bo;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  return (a.areaname || "").localeCompare(b.areaname || "", undefined, {
    sensitivity: "base",
  });
}
