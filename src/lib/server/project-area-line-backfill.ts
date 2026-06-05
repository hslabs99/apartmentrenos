import {
  FieldValue,
  type DocumentReference,
  type Firestore,
  type QuerySnapshot,
} from "firebase-admin/firestore";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";

const BATCH_MAX = 400;

function projectAreaDocIdOnLine(raw: unknown): string {
  return raw == null ? "" : String(raw).trim();
}

async function deleteDocsInBatches(db: Firestore, refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_MAX) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_MAX)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

function projectAreaDocIdsForAreaid(
  paSnap: QuerySnapshot,
  areaid: number,
  excludeProjectAreaDocId?: string,
): string[] {
  const out: string[] = [];
  for (const d of paSnap.docs) {
    if (isProjectAreasMetaDocument(d.id)) continue;
    if (excludeProjectAreaDocId && d.id === excludeProjectAreaDocId) continue;
    if (Number(d.data().areaid) === areaid) out.push(d.id);
  }
  return out;
}

/**
 * Before seeding default lines on a newly added project area: when this is the only
 * instance of the template area on the project, remove legacy/stale lines so a re-added
 * area (e.g. General) does not inherit objects from a previously removed instance.
 */
export async function purgeStaleAreaLinesBeforeSeed(
  db: Firestore,
  projectid: number,
  areaid: number,
  projectAreaDocId: string,
): Promise<void> {
  if (!Number.isInteger(projectid) || !Number.isInteger(areaid)) return;

  const paSnap = await db
    .collection("projectareas")
    .where("projectid", "==", projectid)
    .get();
  const instanceIds = projectAreaDocIdsForAreaid(paSnap, areaid);
  if (instanceIds.length !== 1 || instanceIds[0] !== projectAreaDocId) return;

  const validPadIds = new Set(
    paSnap.docs.filter((d) => !isProjectAreasMetaDocument(d.id)).map((d) => d.id),
  );

  const linesSnap = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("areaid", "==", areaid)
    .get();

  const refs: DocumentReference[] = [];
  for (const d of linesSnap.docs) {
    if (isProjectAreaObjectsMetaDocument(d.id)) continue;
    const pad = projectAreaDocIdOnLine(d.data().projectAreaDocId);
    if (pad === "") {
      refs.push(d.ref);
      continue;
    }
    if (!validPadIds.has(pad)) {
      refs.push(d.ref);
    }
  }

  await deleteDocsInBatches(db, refs);
}

/** Deletes line items and area-question rows for a removed project area instance. */
export async function deleteProjectAreaInstanceData(
  db: Firestore,
  args: { projectid: number; projectAreaDocId: string; areaid: number },
): Promise<void> {
  const { projectid, projectAreaDocId, areaid } = args;
  if (!Number.isInteger(projectid)) {
    await db.collection("projectareas").doc(projectAreaDocId).delete();
    return;
  }

  const paSnap = await db
    .collection("projectareas")
    .where("projectid", "==", projectid)
    .get();
  const soleAreaidInstance =
    Number.isInteger(areaid) &&
    projectAreaDocIdsForAreaid(paSnap, areaid, projectAreaDocId).length === 0;

  const refs: DocumentReference[] = [];

  const linkedLines = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();
  for (const d of linkedLines.docs) {
    if (isProjectAreaObjectsMetaDocument(d.id)) continue;
    refs.push(d.ref);
  }

  if (soleAreaidInstance) {
    const byAreaidLines = await db
      .collection("projectareaobjects")
      .where("projectid", "==", projectid)
      .where("areaid", "==", areaid)
      .get();
    for (const d of byAreaidLines.docs) {
      if (isProjectAreaObjectsMetaDocument(d.id)) continue;
      if (projectAreaDocIdOnLine(d.data().projectAreaDocId) !== "") continue;
      if (!refs.some((r) => r.path === d.ref.path)) refs.push(d.ref);
    }
  }

  const areaAnswers = await db
    .collection("projectareaanswers")
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();
  for (const d of areaAnswers.docs) refs.push(d.ref);

  await deleteDocsInBatches(db, refs);
  await db.collection("projectareas").doc(projectAreaDocId).delete();
}

/**
 * Ensures each checklist line points at exactly one project area row. Legacy rows only had
 * projectid + areaid; when a template area appears once on a project, claim those lines for
 * the sole matching projectareas document. Idempotent.
 */
export async function backfillMissingProjectAreaDocIds(
  db: Firestore,
  projectid: number,
): Promise<void> {
  if (!Number.isInteger(projectid)) return;

  const paSnap = await db
    .collection("projectareas")
    .where("projectid", "==", projectid)
    .get();

  const byAreaid = new Map<number, string[]>();
  for (const d of paSnap.docs) {
    if (isProjectAreasMetaDocument(d.id)) continue;
    const aid = Number(d.data().areaid);
    if (!Number.isInteger(aid)) continue;
    const list = byAreaid.get(aid) ?? [];
    list.push(d.id);
    byAreaid.set(aid, list);
  }

  const BATCH_MAX = 400;
  for (const [areaid, docIds] of byAreaid) {
    if (docIds.length !== 1) continue;
    const soleProjectAreaDocId = docIds[0];
    const linesSnap = await db
      .collection("projectareaobjects")
      .where("projectid", "==", projectid)
      .where("areaid", "==", areaid)
      .get();

    const toUpdate = linesSnap.docs.filter((lineDoc) => {
      if (isProjectAreaObjectsMetaDocument(lineDoc.id)) return false;
      const raw = lineDoc.data().projectAreaDocId;
      return raw == null || String(raw).trim() === "";
    });

    for (let i = 0; i < toUpdate.length; i += BATCH_MAX) {
      const slice = toUpdate.slice(i, i + BATCH_MAX);
      const batch = db.batch();
      for (const lineDoc of slice) {
        batch.update(lineDoc.ref, {
          projectAreaDocId: soleProjectAreaDocId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }
}
