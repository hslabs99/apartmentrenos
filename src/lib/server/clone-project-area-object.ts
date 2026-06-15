import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";

function cloneLinePayload(data: DocumentData): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...data };
  delete clone.createdAt;
  delete clone.updatedAt;
  clone.dateadded = FieldValue.serverTimestamp();
  clone.createdAt = FieldValue.serverTimestamp();
  clone.updatedAt = FieldValue.serverTimestamp();
  return clone;
}

/** Duplicate a project area object line in the same area (new Firestore doc). */
export async function cloneProjectAreaObject(db: Firestore, lineDocId: string): Promise<string> {
  if (isProjectAreaObjectsMetaDocument(lineDocId)) {
    throw new Error("Cannot clone collection metadata");
  }

  const ref = db.collection("projectareaobjects").doc(lineDocId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Line not found");

  const newRef = await db.collection("projectareaobjects").add(cloneLinePayload(snap.data()!));
  return newRef.id;
}

export { cloneLinePayload };
