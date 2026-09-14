import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { isProjectAreaAnswersMetaDocument } from "@/lib/firestore/projectareaanswers-collection";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { isProjectNotesMetaDocument } from "@/lib/firestore/project-notes-collection";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import {
  ensureProjectAreaAnswersBootstrap,
  ensureProjectAreaObjectsBootstrap,
  ensureProjectAreasBootstrap,
  ensureProjectsBootstrap,
} from "@/lib/firestore/collection-bootstrap";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import { isProjectArchivedFlag } from "@/lib/project-archived";
import { isProjectTemplateFlag } from "@/lib/project-template";
import { deleteProjectOwnedChildDocs } from "@/lib/server/delete-project-owned-data";
import { ensureProjectNumericId } from "@/lib/server/resolve-ids";

const BATCH_MAX = 400;

export type CloneProjectOverlay = {
  projectdescription?: string;
  projectm2?: number | null;
  defaultpricelevelid?: number | null;
  projectfinish?: string;
  defaultstyle?: string;
  defaultcolour?: string;
};

export type CloneProjectInput = {
  sourceProjectDocId: string;
  projectname: string;
  /** When set, forces the destination flag. When omitted, copies the source. */
  template?: boolean;
  overlay?: CloneProjectOverlay;
};

export type CloneProjectResult = {
  id: string;
  projectid: number;
};

function remapId(value: unknown, map: Map<string, string>): unknown {
  if (typeof value !== "string") return value;
  const key = value.trim();
  if (!key) return value;
  return map.get(key) ?? value;
}

function omitUndefined(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function cloneDocData(data: DocumentData): Record<string, unknown> {
  return omitUndefined({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function commitSets(
  db: Firestore,
  writes: Array<{ ref: DocumentReference; data: Record<string, unknown> }>,
): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_MAX) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + BATCH_MAX)) {
      batch.set(w.ref, omitUndefined(w.data));
    }
    await batch.commit();
  }
}

async function rollbackClone(
  db: Firestore,
  destRef: DocumentReference,
  newProjectid: number,
): Promise<void> {
  await deleteProjectOwnedChildDocs(db, newProjectid);
  await destRef.delete();
}

/**
 * Full replica of a project (or template): header, areas, lines, area answers, and notes.
 * New `projectid` and Firestore ids; line/area cross-references are remapped.
 */
export async function cloneProject(
  db: Firestore,
  input: CloneProjectInput,
): Promise<CloneProjectResult> {
  const sourceId = input.sourceProjectDocId.trim();
  const projectname = input.projectname.trim();
  if (!sourceId || isProjectsMetaDocument(sourceId)) {
    throw new Error("Invalid source project");
  }
  if (!projectname) {
    throw new Error("Name is required");
  }

  await Promise.all([
    ensureProjectsBootstrap(db),
    ensureProjectAreasBootstrap(db),
    ensureProjectAreaObjectsBootstrap(db),
    ensureProjectAreaAnswersBootstrap(db),
  ]);

  const sourceRef = db.collection("projects").doc(sourceId);
  const sourceSnap = await sourceRef.get();
  if (!sourceSnap.exists) throw new Error("Project not found");

  const sourceData = sourceSnap.data() as DocumentData;
  if (isProjectArchivedFlag(sourceData.archived)) {
    throw new Error("Restore this project from Archives before cloning it");
  }
  const sourceProjectid = await ensureProjectNumericId(db, sourceId);
  const newProjectid = await allocateNextSequence(db, "projectid");

  const destRef = db.collection("projects").doc();
  const destData = cloneDocData(sourceData);
  destData.projectname = projectname;
  destData.projectid = newProjectid;
  destData.template =
    input.template !== undefined ? input.template : isProjectTemplateFlag(sourceData.template);
  destData.archived = false;

  const overlay = input.overlay;
  if (overlay) {
    if (overlay.projectdescription !== undefined) {
      destData.projectdescription = overlay.projectdescription;
    }
    if (overlay.projectm2 !== undefined) destData.projectm2 = overlay.projectm2;
    if (overlay.defaultpricelevelid !== undefined) {
      destData.defaultpricelevelid = overlay.defaultpricelevelid;
    }
    if (overlay.projectfinish !== undefined) destData.projectfinish = overlay.projectfinish;
    if (overlay.defaultstyle !== undefined) destData.defaultstyle = overlay.defaultstyle;
    if (overlay.defaultcolour !== undefined) destData.defaultcolour = overlay.defaultcolour;
  }

  const areaSnap = await db
    .collection("projectareas")
    .where("projectid", "==", sourceProjectid)
    .get();
  const areaDocs = areaSnap.docs.filter((d) => !isProjectAreasMetaDocument(d.id));
  const areaIdMap = new Map<string, string>();
  const areaWrites: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
  for (const doc of areaDocs) {
    const newRef = db.collection("projectareas").doc();
    areaIdMap.set(doc.id, newRef.id);
    const data = cloneDocData(doc.data());
    data.projectid = newProjectid;
    areaWrites.push({ ref: newRef, data });
  }

  const lineSnap = await db
    .collection("projectareaobjects")
    .where("projectid", "==", sourceProjectid)
    .get();
  const lineDocs = lineSnap.docs.filter((d) => !isProjectAreaObjectsMetaDocument(d.id));
  const lineIdMap = new Map<string, string>();
  for (const doc of lineDocs) {
    lineIdMap.set(doc.id, db.collection("projectareaobjects").doc().id);
  }
  const lineWrites: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
  for (const doc of lineDocs) {
    const newId = lineIdMap.get(doc.id)!;
    const data = cloneDocData(doc.data());
    data.projectid = newProjectid;
    if (typeof data.projectAreaDocId === "string" && data.projectAreaDocId.trim()) {
      data.projectAreaDocId = remapId(data.projectAreaDocId, areaIdMap);
    }
    if (typeof data.bundledFromLineId === "string" && data.bundledFromLineId.trim()) {
      data.bundledFromLineId = remapId(data.bundledFromLineId, lineIdMap);
    } else {
      delete data.bundledFromLineId;
    }
    if (typeof data.insertedAfterLineId === "string" && data.insertedAfterLineId.trim()) {
      data.insertedAfterLineId = remapId(data.insertedAfterLineId, lineIdMap);
    } else {
      delete data.insertedAfterLineId;
    }
    if (typeof data.dateadded !== "undefined") {
      data.dateadded = FieldValue.serverTimestamp();
    }
    lineWrites.push({
      ref: db.collection("projectareaobjects").doc(newId),
      data,
    });
  }

  const answerSnap = await db
    .collection("projectareaanswers")
    .where("projectid", "==", sourceProjectid)
    .get();
  const answerWrites: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
  for (const doc of answerSnap.docs.filter((d) => !isProjectAreaAnswersMetaDocument(d.id))) {
    const data = cloneDocData(doc.data());
    data.projectid = newProjectid;
    if (typeof data.projectAreaDocId === "string" && data.projectAreaDocId.trim()) {
      data.projectAreaDocId = remapId(data.projectAreaDocId, areaIdMap);
    }
    answerWrites.push({ ref: db.collection("projectareaanswers").doc(), data });
  }

  const notesSnap = await db
    .collection("project_notes")
    .where("projectid", "==", sourceProjectid)
    .get();
  const noteWrites: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
  for (const doc of notesSnap.docs.filter((d) => !isProjectNotesMetaDocument(d.id))) {
    const noteid = await allocateNextSequence(db, "noteid");
    const data = cloneDocData(doc.data());
    data.projectid = newProjectid;
    data.noteid = noteid;
    noteWrites.push({ ref: db.collection("project_notes").doc(), data });
  }

  try {
    await destRef.set(omitUndefined(destData));
    await commitSets(db, areaWrites);
    await commitSets(db, lineWrites);
    await commitSets(db, answerWrites);
    await commitSets(db, noteWrites);
  } catch (e) {
    await rollbackClone(db, destRef, newProjectid);
    throw e;
  }

  return { id: destRef.id, projectid: newProjectid };
}
