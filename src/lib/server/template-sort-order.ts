import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";

/** Compare two template docs: finite sortOrder first (asc), then missing (by secondary), tie-break id. */
export function compareTemplateDocs(
  a: QueryDocumentSnapshot,
  b: QueryDocumentSnapshot,
  secondaryLabel: (data: DocumentData, id: string) => string,
): number {
  const ad = a.data();
  const bd = b.data();
  const af = ad.sortOrder;
  const bf = bd.sortOrder;
  const aHas = typeof af === "number" && Number.isFinite(af);
  const bHas = typeof bf === "number" && Number.isFinite(bf);
  if (aHas && bHas && af !== bf) return af - bf;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  const s = secondaryLabel(ad, a.id).localeCompare(secondaryLabel(bd, b.id), undefined, {
    sensitivity: "base",
  });
  if (s !== 0) return s;
  return a.id.localeCompare(b.id);
}

export async function reorderNeighborAndRenumber(
  db: Firestore,
  collectionName: string,
  isMeta: (id: string) => boolean,
  id: string,
  direction: "up" | "down",
  secondaryLabel: (data: DocumentData, docId: string) => string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const snap = await db.collection(collectionName).get();
  const docs = snap.docs.filter((d) => !isMeta(d.id));
  const sorted = [...docs].sort((da, db_) => compareTemplateDocs(da, db_, secondaryLabel));
  const idx = sorted.findIndex((d) => d.id === id);
  if (idx < 0) return { ok: false, error: "Not found", status: 404 };
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (j < 0 || j >= sorted.length) return { ok: true };
  const next = [...sorted];
  [next[idx], next[j]] = [next[j], next[idx]];
  await commitSortOrderBatch(db, next);
  return { ok: true };
}

async function commitSortOrderBatch(
  db: Firestore,
  ordered: QueryDocumentSnapshot[],
): Promise<void> {
  const CHUNK = 400;
  for (let offset = 0; offset < ordered.length; offset += CHUNK) {
    const slice = ordered.slice(offset, offset + CHUNK);
    const batch = db.batch();
    for (let i = 0; i < slice.length; i++) {
      const globalIndex = offset + i;
      batch.update(slice[i].ref, {
        sortOrder: globalIndex,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** After POST: renumber all existing 0..n-1, return index for the new document (n). */
export async function renumberAllAndNextIndex(
  db: Firestore,
  collectionName: string,
  isMeta: (id: string) => boolean,
  secondaryLabel: (data: DocumentData, docId: string) => string,
): Promise<number> {
  const snap = await db.collection(collectionName).get();
  const docs = snap.docs.filter((d) => !isMeta(d.id));
  const sorted = [...docs].sort((da, db_) => compareTemplateDocs(da, db_, secondaryLabel));
  await commitSortOrderBatch(db, sorted);
  return sorted.length;
}

export async function reorderAreaObjectNeighbor(
  db: Firestore,
  areaid: number,
  id: string,
  direction: "up" | "down",
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const snap = await db.collection("areaobjects").where("areaid", "==", areaid).get();
  const docs = snap.docs.filter((d) => !isAreaObjectsMetaDocument(d.id));
  const secondary = (data: DocumentData, docId: string) =>
    `${String(data.objectid ?? "")}\u0000${docId}`;
  const sorted = [...docs].sort((da, db_) => compareTemplateDocs(da, db_, secondary));
  const idx = sorted.findIndex((d) => d.id === id);
  if (idx < 0) return { ok: false, error: "Not found", status: 404 };
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (j < 0 || j >= sorted.length) return { ok: true };
  const next = [...sorted];
  [next[idx], next[j]] = [next[j], next[idx]];
  await commitSortOrderBatch(db, next);
  return { ok: true };
}

export async function renumberAreaObjectsForArea(
  db: Firestore,
  areaid: number,
): Promise<number> {
  const snap = await db.collection("areaobjects").where("areaid", "==", areaid).get();
  const docs = snap.docs.filter((d) => !isAreaObjectsMetaDocument(d.id));
  const secondary = (data: DocumentData, docId: string) =>
    `${String(data.objectid ?? "")}\u0000${docId}`;
  const sorted = [...docs].sort((da, db_) => compareTemplateDocs(da, db_, secondary));
  await commitSortOrderBatch(db, sorted);
  return sorted.length;
}

/** One-time style migration: every legacy scope row gets `areaDocIds` + `sortOrderByAreaDocId`. */
export async function migrateAllLegacyScopeDocs(
  db: Firestore,
  docIdByAreaid: Map<number, string>,
): Promise<void> {
  const snap = await db.collection("scopes").get();
  const ops: Array<{ ref: DocumentReference; payload: Record<string, unknown> }> = [];
  for (const d of snap.docs) {
    if (isScopesMetaDocument(d.id)) continue;
    const data = d.data();
    if (Array.isArray(data.areaDocIds) && data.areaDocIds.length > 0) continue;
    const aid = Number(data.areaid ?? NaN);
    if (!Number.isInteger(aid)) continue;
    const ad = docIdByAreaid.get(aid);
    if (!ad) continue;
    const so = data.sortOrder;
    const ord = typeof so === "number" && Number.isFinite(so) ? so : 0;
    ops.push({
      ref: d.ref,
      payload: {
        areaDocIds: [ad],
        sortOrderByAreaDocId: { [ad]: ord },
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + CHUNK)) {
      batch.update(op.ref, op.payload);
    }
    await batch.commit();
  }
}

function scopeSortKeyInArea(data: DocumentData, areaDocId: string): number {
  const raw = data.sortOrderByAreaDocId;
  if (raw && typeof raw === "object" && areaDocId in raw) {
    const v = (raw as Record<string, unknown>)[areaDocId];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  const legacy = data.sortOrder;
  const ids = data.areaDocIds;
  if (
    typeof legacy === "number" &&
    Number.isFinite(legacy) &&
    Array.isArray(ids) &&
    ids.length === 1 &&
    ids[0] === areaDocId
  ) {
    return legacy;
  }
  if (typeof legacy === "number" && Number.isFinite(legacy) && (!Array.isArray(ids) || ids.length === 0)) {
    return legacy;
  }
  return 1e12;
}

function compareScopesInArea(
  da: QueryDocumentSnapshot,
  db_: QueryDocumentSnapshot,
  areaDocId: string,
): number {
  const ao = scopeSortKeyInArea(da.data(), areaDocId);
  const bo = scopeSortKeyInArea(db_.data(), areaDocId);
  if (ao !== bo) return ao - bo;
  const asid = da.data().scopeid;
  const bsid = db_.data().scopeid;
  const an = typeof asid === "number" && Number.isInteger(asid) ? asid : 0;
  const bn = typeof bsid === "number" && Number.isInteger(bsid) ? bsid : 0;
  if (an !== bn) return an - bn;
  return da.id.localeCompare(db_.id);
}

/** Migrate legacy single-`areaid` rows to `areaDocIds` + `sortOrderByAreaDocId` for one numeric template area. */
export async function ensureLegacyScopesMigratedForNumericArea(
  db: Firestore,
  areaNumericId: number,
  docIdByAreaid: Map<number, string>,
): Promise<void> {
  const areaDocId = docIdByAreaid.get(areaNumericId);
  if (!areaDocId) return;
  const legacy = await db.collection("scopes").where("areaid", "==", areaNumericId).get();
  const ops: Array<{ ref: DocumentReference; payload: Record<string, unknown> }> = [];
  for (const d of legacy.docs) {
    if (isScopesMetaDocument(d.id)) continue;
    const data = d.data();
    if (Array.isArray(data.areaDocIds) && data.areaDocIds.length > 0) continue;
    const so = data.sortOrder;
    const ord = typeof so === "number" && Number.isFinite(so) ? so : 0;
    ops.push({
      ref: d.ref,
      payload: {
        areaDocIds: [areaDocId],
        sortOrderByAreaDocId: { [areaDocId]: ord },
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + CHUNK)) {
      batch.update(op.ref, op.payload);
    }
    await batch.commit();
  }
}

async function scopesDocsForTemplateArea(
  db: Firestore,
  areaDocId: string,
  areaNumericId: number,
  docIdByAreaid: Map<number, string>,
): Promise<QueryDocumentSnapshot[]> {
  await ensureLegacyScopesMigratedForNumericArea(db, areaNumericId, docIdByAreaid);
  const snap = await db.collection("scopes").where("areaDocIds", "array-contains", areaDocId).get();
  return snap.docs.filter((d) => !isScopesMetaDocument(d.id));
}

async function commitScopeAreaSortBatch(
  db: Firestore,
  areaDocId: string,
  ordered: QueryDocumentSnapshot[],
): Promise<void> {
  const CHUNK = 400;
  for (let offset = 0; offset < ordered.length; offset += CHUNK) {
    const slice = ordered.slice(offset, offset + CHUNK);
    const batch = db.batch();
    for (let i = 0; i < slice.length; i++) {
      const d = slice[i];
      const idx = offset + i;
      const data = d.data();
      const prevRaw = data.sortOrderByAreaDocId;
      const prev: Record<string, number> = {};
      if (prevRaw && typeof prevRaw === "object") {
        for (const [k, v] of Object.entries(prevRaw as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isFinite(v)) prev[k] = v;
        }
      }
      prev[areaDocId] = idx;
      batch.update(d.ref, {
        sortOrderByAreaDocId: prev,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Renumber per-area sort indices 0..n-1 for every scope tagged with this template area. */
export async function renumberScopesForAreaDocId(
  db: Firestore,
  areaDocId: string,
  areaNumericId: number,
  docIdByAreaid: Map<number, string>,
): Promise<void> {
  const docs = await scopesDocsForTemplateArea(db, areaDocId, areaNumericId, docIdByAreaid);
  const sorted = [...docs].sort((a, b) => compareScopesInArea(a, b, areaDocId));
  await commitScopeAreaSortBatch(db, areaDocId, sorted);
}

/**
 * Places `newDocIdsInOrder` contiguously after `insertAfterDocId` within a template area (or at the end when null).
 * Updates `sortOrderByAreaDocId` for that area on every scope in the area.
 */
export async function insertScopesAfterDoc(
  db: Firestore,
  areaDocId: string,
  areaNumericId: number,
  docIdByAreaid: Map<number, string>,
  insertAfterDocId: string | null,
  newDocIdsInOrder: string[],
): Promise<void> {
  if (newDocIdsInOrder.length === 0) return;
  const sorted = await scopesDocsForTemplateArea(db, areaDocId, areaNumericId, docIdByAreaid);
  const ordered = [...sorted].sort((a, b) => compareScopesInArea(a, b, areaDocId));
  const newSet = new Set(newDocIdsInOrder);
  const byId = new Map(ordered.map((d) => [d.id, d]));
  for (const id of newDocIdsInOrder) {
    if (!byId.has(id)) {
      throw new Error("New scope document is missing or not in this area");
    }
  }
  const withoutNew = ordered.filter((d) => !newSet.has(d.id));

  let insertAt: number;
  if (insertAfterDocId == null || insertAfterDocId === "") {
    insertAt = withoutNew.length;
  } else {
    const idx = withoutNew.findIndex((d) => d.id === insertAfterDocId);
    if (idx < 0) {
      throw new Error("insertAfter scope not found in this area");
    }
    insertAt = idx + 1;
  }

  const merged: QueryDocumentSnapshot[] = [
    ...withoutNew.slice(0, insertAt),
    ...newDocIdsInOrder.map((id) => byId.get(id)!),
    ...withoutNew.slice(insertAt),
  ];
  await commitScopeAreaSortBatch(db, areaDocId, merged);
}

export async function reorderScopeNeighbor(
  db: Firestore,
  areaDocId: string,
  areaNumericId: number,
  docIdByAreaid: Map<number, string>,
  id: string,
  direction: "up" | "down",
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const docs = await scopesDocsForTemplateArea(db, areaDocId, areaNumericId, docIdByAreaid);
  const sorted = [...docs].sort((a, b) => compareScopesInArea(a, b, areaDocId));
  const idx = sorted.findIndex((d) => d.id === id);
  if (idx < 0) return { ok: false, error: "Not found", status: 404 };
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (j < 0 || j >= sorted.length) return { ok: true };
  const next = [...sorted];
  [next[idx], next[j]] = [next[j], next[idx]];
  await commitScopeAreaSortBatch(db, areaDocId, next);
  return { ok: true };
}
