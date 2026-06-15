import { randomUUID } from "crypto";
import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { matchesScopeInstance } from "@/lib/scope-instance";
import { cloneLinePayload } from "@/lib/server/clone-project-area-object";
import { parseScopeAnswersFromFirestore } from "@/lib/server/project-area-scope-answers";

export type CloneProjectAreaScopeResult = {
  scopeInstanceId: string;
  lineIds: string[];
};

/**
 * Duplicate a scope instance on a project area: copies the saved answer and all scope lines
 * (including bundled children) with the same settings and values.
 */
export async function cloneProjectAreaScope(
  db: Firestore,
  projectAreaDocId: string,
  scopeDocId: string,
  sourceScopeInstanceId?: string | null,
): Promise<CloneProjectAreaScopeResult> {
  const paRef = db.collection("projectareas").doc(projectAreaDocId);
  const paSnap = await paRef.get();
  if (!paSnap.exists) throw new Error("Project area not found");

  const paData = paSnap.data() as DocumentData;
  const projectid = Number(paData.projectid);
  if (!Number.isInteger(projectid)) throw new Error("Invalid project area data");

  const currentAnswers = parseScopeAnswersFromFirestore(paData.scopeAnswers);
  const sourceAnswer = currentAnswers.find(
    (e) =>
      e.scopeDocId === scopeDocId &&
      matchesScopeInstance(e.scopeInstanceId, sourceScopeInstanceId),
  );

  const linesSnap = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();

  const sourceScopeLineDocs = linesSnap.docs.filter((d) => {
    const x = d.data();
    return (
      x.linesource === "scope" &&
      String(x.scopeDocId ?? "") === scopeDocId &&
      matchesScopeInstance(x.scopeInstanceId as string | null | undefined, sourceScopeInstanceId)
    );
  });

  const newInstanceId = randomUUID();
  const nextAnswers = [...currentAnswers];

  if (!sourceAnswer && sourceScopeLineDocs.length === 0) {
    nextAnswers.push({
      scopeDocId,
      answerid: "",
      scopeInstanceId: newInstanceId,
    });
    await paRef.update({
      scopeAnswers: nextAnswers,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { scopeInstanceId: newInstanceId, lineIds: [] };
  }

  if (sourceAnswer) {
    nextAnswers.push({
      scopeDocId,
      answerid: sourceAnswer.answerid,
      scopeInstanceId: newInstanceId,
    });
  }

  await paRef.update({
    scopeAnswers: nextAnswers,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const idMap = new Map<string, string>();
  for (const doc of sourceScopeLineDocs) {
    const clone = cloneLinePayload(doc.data());
    clone.scopeInstanceId = newInstanceId;
    const newRef = await db.collection("projectareaobjects").add(clone);
    idMap.set(doc.id, newRef.id);
  }

  for (const doc of linesSnap.docs) {
    const x = doc.data();
    if (x.linesource !== "bundled") continue;
    const parentId = String(x.bundledFromLineId ?? "").trim();
    const newParentId = idMap.get(parentId);
    if (!newParentId) continue;
    const clone = cloneLinePayload(x);
    clone.bundledFromLineId = newParentId;
    await db.collection("projectareaobjects").add(clone);
  }

  return { scopeInstanceId: newInstanceId, lineIds: [...idMap.values()] };
}
