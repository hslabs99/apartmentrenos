import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { isProjectAreaAnswersMetaDocument } from "@/lib/firestore/projectareaanswers-collection";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { isProjectNotesMetaDocument } from "@/lib/firestore/project-notes-collection";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { isProjectArchivedFlag } from "@/lib/project-archived";

const BATCH_MAX = 400;

/**
 * The only collections that store instance data for one project.
 * Catalog, setup, users, and other projects are never in this list.
 */
export const PROJECT_OWNED_CHILD_COLLECTIONS = [
  "project_notes",
  "projectareaanswers",
  "projectareaobjects",
  "projectareas",
] as const;

export type ProjectOwnedChildCollection =
  (typeof PROJECT_OWNED_CHILD_COLLECTIONS)[number];

function isOwnedChildMeta(
  collectionId: ProjectOwnedChildCollection,
  docId: string,
): boolean {
  switch (collectionId) {
    case "project_notes":
      return isProjectNotesMetaDocument(docId);
    case "projectareaanswers":
      return isProjectAreaAnswersMetaDocument(docId);
    case "projectareaobjects":
      return isProjectAreaObjectsMetaDocument(docId);
    case "projectareas":
      return isProjectAreasMetaDocument(docId);
  }
}

function isPositiveIntegerProjectId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Deletes child documents that belong to this numeric `projectid` only.
 * Uses an allowlist of collections, equality on `projectid`, and skips meta docs.
 */
export async function deleteProjectOwnedChildDocs(
  db: Firestore,
  projectid: number,
): Promise<void> {
  if (!isPositiveIntegerProjectId(projectid)) {
    throw new Error("Refusing child delete: projectid must be a positive integer");
  }

  for (const collectionId of PROJECT_OWNED_CHILD_COLLECTIONS) {
    const snap = await db
      .collection(collectionId)
      .where("projectid", "==", projectid)
      .get();
    const toDelete = snap.docs.filter((d) => {
      if (isOwnedChildMeta(collectionId, d.id)) return false;
      const pid = (d.data() as DocumentData).projectid;
      return pid === projectid;
    });
    for (let i = 0; i < toDelete.length; i += BATCH_MAX) {
      const batch = db.batch();
      for (const d of toDelete.slice(i, i + BATCH_MAX)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  }
}

/**
 * Permanently deletes one archived project document and its own child rows.
 * Refuses live/template rows that have not been archived, metadata docs, and
 * any collection outside `PROJECT_OWNED_CHILD_COLLECTIONS`.
 */
export async function hardDeleteArchivedProject(
  db: Firestore,
  projectDocId: string,
): Promise<void> {
  const id = projectDocId.trim();
  if (!id || isProjectsMetaDocument(id)) {
    throw new Error("Cannot delete collection metadata");
  }

  const ref = db.collection("projects").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Project not found");
  }
  const data = snap.data() as DocumentData;
  if (!isProjectArchivedFlag(data.archived)) {
    throw new Error("Archive this project first before permanently deleting it");
  }

  const projectid = data.projectid;
  if (isPositiveIntegerProjectId(projectid)) {
    await deleteProjectOwnedChildDocs(db, projectid);
  }

  const again = await ref.get();
  if (!again.exists) return;
  const againData = again.data() as DocumentData;
  if (!isProjectArchivedFlag(againData.archived)) {
    throw new Error("Project was restored during delete; aborting");
  }
  await ref.delete();
}
