import type { Firestore } from "firebase-admin/firestore";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { numOrNull } from "@/lib/server/quote-object-doc";

/**
 * Area override (`projectareas.pricelevelid`) wins; else project default (`projects.defaultpricelevelid`).
 */
export async function resolveEffectivePriceLevelId(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
): Promise<number | null> {
  const paSnap = await db.collection("projectareas").doc(projectAreaDocId).get();
  const areaPl = numOrNull(paSnap.data()?.pricelevelid);
  if (areaPl != null && Number.isInteger(areaPl)) return areaPl;

  const projQ = await db.collection("projects").where("projectid", "==", projectid).limit(1).get();
  const pd = projQ.docs[0]?.data();
  const defPl = numOrNull(pd?.defaultpricelevelid);
  return defPl != null && Number.isInteger(defPl) ? defPl : null;
}

/**
 * When a line sets `pricelevelid`, that tier wins; otherwise the area’s effective tier is used.
 */
export function resolveLineEffectivePriceLevelId(
  areaEffectivePriceLevelId: number | null,
  linePriceLevelOverride: number | null | undefined,
): number | null {
  if (linePriceLevelOverride != null && Number.isInteger(linePriceLevelOverride)) {
    return linePriceLevelOverride;
  }
  return areaEffectivePriceLevelId;
}

/**
 * First project area doc for this project + template areaid. Ambiguous when the same template
 * is added more than once — prefer `projectareaobjects.projectAreaDocId` on the line when present.
 */
export async function findProjectAreaDocIdByKeys(
  db: Firestore,
  projectid: number,
  templateAreaid: number,
): Promise<string | null> {
  if (!Number.isInteger(projectid) || !Number.isInteger(templateAreaid)) return null;
  const snap = await db
    .collection("projectareas")
    .where("projectid", "==", projectid)
    .where("areaid", "==", templateAreaid)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc || isProjectAreasMetaDocument(doc.id)) return null;
  return doc.id;
}
