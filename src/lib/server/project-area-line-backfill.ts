import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";

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
