import type { Firestore } from "firebase-admin/firestore";
import { ensureDataObjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_OBJECTS_COLLECTION,
  isDataObjectsMetaDocument,
} from "@/lib/firestore/data-objects-collection";

const DELETE_BATCH_SIZE = 500;

export type ClearDataObjectsResult = {
  deleted: number;
};

/** Removes all `data_objects` rows except collection metadata (for key/schema rebuilds). */
export async function runClearDataObjects(db: Firestore): Promise<ClearDataObjectsResult> {
  await ensureDataObjectsBootstrap(db);

  const snap = await db.collection(DATA_OBJECTS_COLLECTION).get();
  const deleteRefs = snap.docs
    .filter((d) => !isDataObjectsMetaDocument(d.id))
    .map((d) => d.ref);

  let deleted = 0;
  for (let i = 0; i < deleteRefs.length; i += DELETE_BATCH_SIZE) {
    const chunk = deleteRefs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }

  return { deleted };
}
