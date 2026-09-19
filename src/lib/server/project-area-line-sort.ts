import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { backfillMissingProjectAreaDocIds } from "@/lib/server/project-area-line-backfill";
import {
  compareProjectAreaLineOrder,
  sortProjectAreaLines,
} from "@/lib/project-area-line-order";
import { matchesScopeInstance } from "@/lib/scope-instance";

type AreaLineRow = {
  id: string;
  objectid: number;
  lineSortOrder: number | null;
  dateadded: string | null;
  scopeDocId: string;
  scopeInstanceId: string | null;
};

function readLineSortOrder(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function readDateAddedIso(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "toDate" in raw) {
    const d = (raw as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

async function loadAreaLineRows(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
  opts?: { backfill?: boolean },
): Promise<AreaLineRow[]> {
  if (opts?.backfill !== false) {
    await backfillMissingProjectAreaDocIds(db, projectid);
  }

  const snap = await db
    .collection("projectareaobjects")
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();

  return snap.docs
    .filter((d) => !isProjectAreaObjectsMetaDocument(d.id))
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        objectid: Number(data.objectid) || 0,
        lineSortOrder: readLineSortOrder(data.lineSortOrder),
        dateadded: readDateAddedIso(data.dateadded),
        scopeDocId: String(data.scopeDocId ?? "").trim(),
        scopeInstanceId: (data.scopeInstanceId as string | null | undefined) ?? null,
      };
    });
}

export const PROJECT_AREA_LINE_SORT_STEP = 10;

async function writeLineSortOrderSequence(
  db: Firestore,
  merged: AreaLineRow[],
): Promise<void> {
  const BATCH_MAX = 400;
  for (let i = 0; i < merged.length; i += BATCH_MAX) {
    const batch = db.batch();
    const slice = merged.slice(i, i + BATCH_MAX);
    slice.forEach((row, sliceIndex) => {
      const index = i + sliceIndex;
      batch.update(db.collection("projectareaobjects").doc(row.id), {
        lineSortOrder: (index + 1) * PROJECT_AREA_LINE_SORT_STEP,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

/** Next `lineSortOrder` after the current max in the area (10, 20, 30, …). */
export async function nextProjectAreaLineSortOrder(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
): Promise<number> {
  const rows = await loadAreaLineRows(db, projectAreaDocId, projectid, {
    backfill: false,
  });
  let max = 0;
  for (const r of rows) {
    if (typeof r.lineSortOrder === "number" && r.lineSortOrder > max) {
      max = r.lineSortOrder;
    }
  }
  return max + PROJECT_AREA_LINE_SORT_STEP;
}

/**
 * Keep every line for `objectid` as one contiguous block in area order.
 * New docs are appended after the existing (kept) lines of that object, then the area is renumbered.
 */
export async function coalesceProjectAreaObjectLines(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
  objectid: number,
  newLineDocIds: string[],
  scope?: { scopeDocId: string; scopeInstanceId?: string | null },
): Promise<void> {
  if (newLineDocIds.length === 0) return;
  const rows = await loadAreaLineRows(db, projectAreaDocId, projectid);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const newSet = new Set(newLineDocIds);
  const sorted = sortProjectAreaLines(rows);
  const isTarget = (r: AreaLineRow) => {
    if (r.objectid !== objectid) return false;
    if (!scope) return true;
    if (r.scopeDocId !== scope.scopeDocId) return false;
    return matchesScopeInstance(r.scopeInstanceId, scope.scopeInstanceId);
  };

  const firstKeptIdx = sorted.findIndex((r) => isTarget(r) && !newSet.has(r.id));
  const objectKept = sorted.filter((r) => isTarget(r) && !newSet.has(r.id));
  const objectNew = newLineDocIds
    .map((id) => byId.get(id))
    .filter((r): r is AreaLineRow => r != null);
  const objectBlock = [...objectKept, ...objectNew];
  if (objectBlock.length === 0) return;

  const others = sorted.filter((r) => !isTarget(r));
  let insertAt = others.length;
  const anchorIdx = firstKeptIdx >= 0
    ? firstKeptIdx
    : sorted.findIndex((r) => newSet.has(r.id));
  if (anchorIdx >= 0) {
    insertAt = 0;
    for (let i = 0; i < anchorIdx; i++) {
      if (!isTarget(sorted[i]!)) insertAt += 1;
    }
  }

  const merged = [
    ...others.slice(0, insertAt),
    ...objectBlock,
    ...others.slice(insertAt),
  ];
  await writeLineSortOrderSequence(db, merged);
}

/**
 * Inserts `newLineDocId` directly after `insertAfterLineDocId` and renumbers
 * `lineSortOrder` for every line in the area (10, 20, 30, …).
 */
export async function insertProjectAreaLineAfter(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
  newLineDocId: string,
  insertAfterLineDocId: string,
): Promise<void> {
  const afterRef = db.collection("projectareaobjects").doc(insertAfterLineDocId);
  const afterSnap = await afterRef.get();
  if (!afterSnap.exists || isProjectAreaObjectsMetaDocument(insertAfterLineDocId)) {
    throw new Error("insertAfter line not found");
  }

  const rows = await loadAreaLineRows(db, projectAreaDocId, projectid);
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (!byId.has(newLineDocId)) {
    throw new Error("New line not found in this area");
  }
  if (!byId.has(insertAfterLineDocId)) {
    throw new Error("insertAfter line not found in this area");
  }

  const sorted = sortProjectAreaLines(rows);
  const withoutNew = sorted.filter((r) => r.id !== newLineDocId);
  const afterIdx = withoutNew.findIndex((r) => r.id === insertAfterLineDocId);
  if (afterIdx < 0) {
    throw new Error("insertAfter line not found in this area");
  }

  const merged = [
    ...withoutNew.slice(0, afterIdx + 1),
    byId.get(newLineDocId)!,
    ...withoutNew.slice(afterIdx + 1),
  ];

  await writeLineSortOrderSequence(db, merged);
}

export { compareProjectAreaLineOrder };
