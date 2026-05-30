import type { Firestore } from "firebase-admin/firestore";
import {
  DATA_OBJECTS_COLLECTION,
  isDataObjectsMetaDocument,
} from "@/lib/firestore/data-objects-collection";

const DELETE_BATCH_SIZE = 500;

export type DeleteDataObjectsResult = {
  requested: number;
  deleted: number;
  notFound: number;
};

/** Delete `data_objects` documents by id (skips meta and missing ids). */
export async function runDeleteDataObjects(
  db: Firestore,
  ids: string[],
): Promise<DeleteDataObjectsResult> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].filter(
    (id) => !isDataObjectsMetaDocument(id),
  );

  if (unique.length === 0) {
    return { requested: 0, deleted: 0, notFound: 0 };
  }

  let deleted = 0;
  let notFound = 0;

  for (let i = 0; i < unique.length; i += DELETE_BATCH_SIZE) {
    const chunk = unique.slice(i, i + DELETE_BATCH_SIZE);
    const refs = chunk.map((id) => db.collection(DATA_OBJECTS_COLLECTION).doc(id));
    const snaps = await db.getAll(...refs);
    const batch = db.batch();
    let chunkDeletes = 0;

    snaps.forEach((snap, idx) => {
      const id = chunk[idx]!;
      if (!snap.exists || isDataObjectsMetaDocument(id)) {
        notFound++;
        return;
      }
      batch.delete(snap.ref);
      chunkDeletes++;
    });

    if (chunkDeletes > 0) {
      await batch.commit();
      deleted += chunkDeletes;
    }
  }

  return { requested: unique.length, deleted, notFound };
}
