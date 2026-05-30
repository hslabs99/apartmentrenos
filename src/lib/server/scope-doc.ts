import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { ScopeAnswerPublic, ScopePublic } from "@/types/scope";
import { normalizedScopeAreaState } from "@/lib/scope-areas";
import { readSystemScopeFromFirestore } from "@/lib/system-scope-types";

/** Minimal area row for ordering scope tags (matches Setup → Areas order). */
export type ScopeTemplateAreaRow = {
  id: string;
  areaname: string;
  sortOrder?: number | null;
  areaid?: number | null;
};

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function normalizeAttachedQuoteObjectIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeAttachedObjectNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const n = x.trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function normalizeAttachedCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const c = x.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function firestoreAnswersToPublic(raw: unknown): ScopeAnswerPublic[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopeAnswerPublic[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const answerid = String(rec.answerid ?? "");
    const label = String(rec.label ?? "");
    if (!answerid || !label) continue;
    out.push({
      answerid,
      label,
      attachedQuoteObjectIds: normalizeAttachedQuoteObjectIds(rec.attachedQuoteObjectIds),
      attachedObjectNames: normalizeAttachedObjectNames(rec.attachedObjectNames),
      attachedCategories: normalizeAttachedCategories(rec.attachedCategories),
    });
  }
  return out;
}

/** Legacy `byPriceLevel` rows still in Firestore (pre–category scopes). */
export type LegacyScopeAnswerPriceLevel = {
  pricelevelid: number;
  objectPickOrder: string[];
  areaObjectDocIds: string[];
  quoteObjectDocIds: string[];
};

export function firestoreLegacyByPriceLevel(raw: unknown): LegacyScopeAnswerPriceLevel[] {
  if (!Array.isArray(raw)) return [];
  const byLevel = new Map<
    number,
    { objectPickOrder: string[]; ao: string[]; qo: string[] }
  >();
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const pricelevelid = Number(r.pricelevelid);
    const opoRaw = r.objectPickOrder;
    const objectPickOrder = Array.isArray(opoRaw)
      ? opoRaw.filter(
          (x): x is string =>
            typeof x === "string" &&
            (x.startsWith("ao:") || x.startsWith("qo:")) &&
            x.length > 3,
        )
      : [];
    const idsRaw = r.areaObjectDocIds;
    const areaObjectDocIds = Array.isArray(idsRaw)
      ? idsRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    const qoRaw = r.quoteObjectDocIds;
    const quoteObjectDocIds = Array.isArray(qoRaw)
      ? qoRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    const fallbackOrder = [
      ...areaObjectDocIds.map((id) => `ao:${id}`),
      ...quoteObjectDocIds.map((id) => `qo:${id}`),
    ];
    const order = objectPickOrder.length > 0 ? objectPickOrder : fallbackOrder;
    if (!Number.isInteger(pricelevelid) || order.length === 0) continue;
    const ao: string[] = [];
    const qo: string[] = [];
    const seenA = new Set<string>();
    const seenQ = new Set<string>();
    for (const p of order) {
      if (p.startsWith("ao:")) {
        const id = p.slice(3);
        if (id && !seenA.has(id)) {
          seenA.add(id);
          ao.push(id);
        }
      } else if (p.startsWith("qo:")) {
        const id = p.slice(3);
        if (id && !seenQ.has(id)) {
          seenQ.add(id);
          qo.push(id);
        }
      }
    }
    byLevel.set(pricelevelid, { objectPickOrder: order, ao, qo });
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pricelevelid, { objectPickOrder, ao, qo }]) => ({
      pricelevelid,
      areaObjectDocIds: ao,
      quoteObjectDocIds: qo,
      objectPickOrder,
    }));
}

export function orderScopeAreaDocIdsByTemplate(
  orderedAreas: ScopeTemplateAreaRow[],
  ids: string[],
): string[] {
  return orderAreaDocIdsByTemplate(orderedAreas, ids);
}

function orderAreaDocIdsByTemplate(orderedAreas: ScopeTemplateAreaRow[], ids: string[]): string[] {
  const index = new Map<string, number>();
  orderedAreas.forEach((a, i) => index.set(a.id, i));
  return [...ids].sort((x, y) => {
    const ix = index.get(x);
    const iy = index.get(y);
    const vx = ix !== undefined ? ix : 9999;
    const vy = iy !== undefined ? iy : 9999;
    if (vx !== vy) return vx - vy;
    return x.localeCompare(y);
  });
}

export function scopeDocToPublic(
  id: string,
  data: DocumentData,
  docIdByAreaid: Map<number, string>,
  nameByAreaid: Map<number, string>,
  areasOrdered: ScopeTemplateAreaRow[],
): ScopePublic {
  const rawKind = data.kind;
  const kind: ScopePublic["kind"] =
    rawKind === "header"
      ? "header"
      : rawKind === "footer"
        ? "footer"
        : "question";

  const { areaDocIds: rawTags, sortOrderByAreaDocId } = normalizedScopeAreaState(
    data as Record<string, unknown>,
    docIdByAreaid,
  );
  const areaDocIds = orderAreaDocIdsByTemplate(areasOrdered, rawTags);
  const legacySort = numOrNull(data.sortOrder) ?? null;

  const primaryDocId = areaDocIds[0] ?? "";
  const primaryRow = primaryDocId ? areasOrdered.find((a) => a.id === primaryDocId) : null;
  const primaryAreaid =
    primaryRow?.areaid != null && Number.isInteger(Number(primaryRow.areaid))
      ? Number(primaryRow.areaid)
      : primaryDocId
        ? ([...docIdByAreaid.entries()].find(([, d]) => d === primaryDocId)?.[0] ?? 0)
        : 0;
  const primaryName = primaryDocId
    ? (areasOrdered.find((a) => a.id === primaryDocId)?.areaname ??
      nameByAreaid.get(primaryAreaid) ??
      "")
    : "";

  const namesForDisplay: string[] = [];
  for (const ad of areaDocIds) {
    const ar = areasOrdered.find((a) => a.id === ad);
    if (ar?.areaname) namesForDisplay.push(String(ar.areaname));
    else {
      const aid = [...docIdByAreaid.entries()].find(([, d]) => d === ad)?.[0];
      if (aid !== undefined) namesForDisplay.push(nameByAreaid.get(aid) || `Area #${aid}`);
    }
  }

  const sortOrderForPrimary =
    primaryDocId && sortOrderByAreaDocId[primaryDocId] !== undefined
      ? sortOrderByAreaDocId[primaryDocId]
      : legacySort;

  const { systemScope, systemScopeType } = readSystemScopeFromFirestore(
    data as Record<string, unknown>,
  );

  return {
    id,
    scopeid: numOrNull(data.scopeid) ?? null,
    kind,
    areaDocIds,
    sortOrderByAreaDocId: { ...sortOrderByAreaDocId },
    sortOrder: sortOrderForPrimary,
    areaid: primaryAreaid,
    areaDocId: primaryDocId,
    areaname: primaryName,
    areaNamesDisplay: namesForDisplay.length ? namesForDisplay.join(", ") : primaryName,
    question: String(data.question ?? ""),
    answers: firestoreAnswersToPublic(data.answers),
    systemScope,
    systemScopeType,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

/** Build rows for `scopeDocToPublic` from Areas collection snapshots. */
export function buildScopeTemplateAreaRowsFromFirestore(
  areaDocs: { id: string; data: () => DocumentData }[],
): ScopeTemplateAreaRow[] {
  const rows: ScopeTemplateAreaRow[] = areaDocs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      areaname: String(x.areaname ?? ""),
      sortOrder: numOrNull(x.sortOrder) ?? null,
      areaid: numOrNull(x.areaid) ?? null,
    };
  });
  return [...rows].sort((a, b) => {
    const ao = a.sortOrder;
    const bo = b.sortOrder;
    const aHas = typeof ao === "number" && Number.isFinite(ao);
    const bHas = typeof bo === "number" && Number.isFinite(bo);
    if (aHas && bHas && ao !== bo) return ao - bo;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.areaname.localeCompare(b.areaname, undefined, { sensitivity: "base" });
  });
}
