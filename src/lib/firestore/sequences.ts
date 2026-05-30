import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export type SequenceName =
  | "projectid"
  | "areaid"
  | "objectid"
  | "questionId"
  | "lookupid"
  | "colourlookupid"
  | "pricelevelid"
  | "scopeid";

/**
 * Monotonic auto-increment per entity type (Firestore transaction).
 * Stored at `counters/{name}` as `{ next: number }`.
 */
export async function allocateNextSequence(
  db: Firestore,
  name: SequenceName,
): Promise<number> {
  const ref = db.collection("counters").doc(name);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists
      ? Number((snap.data() as { next?: unknown }).next ?? 0)
      : 0;
    const next = current + 1;
    tx.set(
      ref,
      { next, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return next;
  });
}
