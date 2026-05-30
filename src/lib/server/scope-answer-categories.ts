import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { isSystemScopeObjectId } from "@/lib/system-scope-types";

function parseAreaTagIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function integerObjectId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export type ScopeCategoryLineSeed = {
  objectid: number;
  notes1: string;
  notes2: string;
};

type Cand = ScopeCategoryLineSeed & { sortOrder: number | null };

function quoteObjectMatchesAreaTags(
  data: DocumentData,
  templateAreaDocId: string,
): boolean {
  const areaTagIds = parseAreaTagIds(data.areaTagIds);
  if (areaTagIds.length === 0) return true;
  return Boolean(templateAreaDocId && areaTagIds.includes(templateAreaDocId));
}

function finalizeQuoteObjectCandidates(candidates: Cand[]): ScopeCategoryLineSeed[] {
  candidates.sort((a, b) => {
    const ao = a.sortOrder;
    const bo = b.sortOrder;
    const aHas = ao != null;
    const bHas = bo != null;
    if (aHas && bHas && ao !== bo) return ao - bo;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.objectid - b.objectid;
  });

  const seen = new Set<number>();
  const out: ScopeCategoryLineSeed[] = [];
  for (const c of candidates) {
    if (seen.has(c.objectid)) continue;
    seen.add(c.objectid);
    out.push({ objectid: c.objectid, notes1: c.notes1, notes2: c.notes2 });
  }
  return out;
}

/**
 * Quote objects whose `category` is in `categories`. When a template area doc id is known,
 * objects with area tags must include that area; untagged objects match any area.
 */
export async function resolveQuoteObjectLinesForCategories(
  db: Firestore,
  categories: string[],
  templateAreaDocId: string,
): Promise<ScopeCategoryLineSeed[]> {
  const catSet = new Set(categories.map((c) => c.trim()).filter(Boolean));
  if (catSet.size === 0) return [];

  const snap = await db.collection("quote_objects").get();
  const candidates: Cand[] = [];

  for (const doc of snap.docs) {
    if (isQuoteObjectsMetaDocument(doc.id)) continue;
    const data = doc.data() as DocumentData;
    const category = String(data.category ?? "").trim();
    if (!catSet.has(category)) continue;
    if (!quoteObjectMatchesAreaTags(data, templateAreaDocId)) continue;

    const objectid = integerObjectId(data.objectid);
    if (objectid === undefined) continue;

    candidates.push({
      objectid,
      notes1: String(data.notes1 ?? ""),
      notes2: String(data.notes2 ?? ""),
      sortOrder: numOrNull(data.sortOrder),
    });
  }

  return finalizeQuoteObjectCandidates(candidates);
}

/**
 * Quote objects whose `objectname` is in `objectNames` (case-insensitive).
 * Area tag rules match category-based resolution.
 */
export async function resolveQuoteObjectLinesForObjectNames(
  db: Firestore,
  objectNames: string[],
  templateAreaDocId: string,
): Promise<ScopeCategoryLineSeed[]> {
  const nameSet = new Set(
    objectNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  if (nameSet.size === 0) return [];

  const snap = await db.collection("quote_objects").get();
  const candidates: Cand[] = [];

  for (const doc of snap.docs) {
    if (isQuoteObjectsMetaDocument(doc.id)) continue;
    const data = doc.data() as DocumentData;
    const objectname = String(data.objectname ?? "").trim();
    if (!objectname || !nameSet.has(objectname.toLowerCase())) continue;
    if (!quoteObjectMatchesAreaTags(data, templateAreaDocId)) continue;

    const objectid = integerObjectId(data.objectid);
    if (objectid === undefined) continue;

    candidates.push({
      objectid,
      notes1: String(data.notes1 ?? ""),
      notes2: String(data.notes2 ?? ""),
      sortOrder: numOrNull(data.sortOrder),
    });
  }

  return finalizeQuoteObjectCandidates(candidates);
}

/** Explicit quote object rows selected on the scope answer. */
export async function resolveQuoteObjectLinesForDocIds(
  db: Firestore,
  quoteObjectDocIds: string[],
  templateAreaDocId: string,
): Promise<ScopeCategoryLineSeed[]> {
  const unique = [
    ...new Set(
      quoteObjectDocIds.map((id) => id.trim()).filter(Boolean).filter((id) => !isSystemScopeObjectId(id)),
    ),
  ];
  if (unique.length === 0) return [];

  const candidates: Cand[] = [];

  for (const docId of unique) {
    const snap = await db.collection("quote_objects").doc(docId).get();
    if (!snap.exists || isQuoteObjectsMetaDocument(snap.id)) continue;
    const data = snap.data() as DocumentData;
    if (!quoteObjectMatchesAreaTags(data, templateAreaDocId)) continue;
    const objectid = integerObjectId(data.objectid);
    if (objectid === undefined) continue;
    candidates.push({
      objectid,
      notes1: String(data.notes1 ?? ""),
      notes2: String(data.notes2 ?? ""),
      sortOrder: numOrNull(data.sortOrder),
    });
  }

  return finalizeQuoteObjectCandidates(candidates);
}
