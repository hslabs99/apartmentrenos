import { FieldValue } from "firebase-admin/firestore";
import type {
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { allocateNextSequence, type SequenceName } from "@/lib/firestore/sequences";

export type BackfillSummary = {
  projects: { updated: number; maxId: number };
  areas: { updated: number; maxId: number };
  quote_objects: { updated: number; maxId: number };
  lookups: { updated: number; maxId: number };
};

async function seedCounterFloor(
  db: Firestore,
  seq: SequenceName,
  floor: number,
): Promise<void> {
  const ref = db.collection("counters").doc(seq);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const cur = s.exists ? Number((s.data() as { next?: unknown }).next ?? 0) : 0;
    tx.set(
      ref,
      {
        next: Math.max(cur, floor),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

async function backfillCollection(
  db: Firestore,
  collectionName: string,
  field: string,
  seq: SequenceName,
  isMeta: (docId: string) => boolean,
): Promise<{ updated: number; maxId: number }> {
  const snap = await db.collection(collectionName).get();
  let maxExisting = 0;
  const missing: QueryDocumentSnapshot[] = [];
  for (const d of snap.docs) {
    if (isMeta(d.id)) continue;
    const v = d.data()[field];
    if (typeof v === "number" && Number.isInteger(v)) {
      maxExisting = Math.max(maxExisting, v);
    } else {
      missing.push(d);
    }
  }
  missing.sort((a, b) => a.id.localeCompare(b.id));
  await seedCounterFloor(db, seq, maxExisting);
  let updated = 0;
  let maxId = maxExisting;
  for (const d of missing) {
    const next = await allocateNextSequence(db, seq);
    await d.ref.update({
      [field]: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated++;
    maxId = Math.max(maxId, next);
  }
  return { updated, maxId };
}

export async function backfillAllEntityIds(db: Firestore): Promise<BackfillSummary> {
  const projects = await backfillCollection(
    db,
    "projects",
    "projectid",
    "projectid",
    isProjectsMetaDocument,
  );
  const areas = await backfillCollection(
    db,
    "areas",
    "areaid",
    "areaid",
    isAreasMetaDocument,
  );
  const quote_objects = await backfillCollection(
    db,
    "quote_objects",
    "objectid",
    "objectid",
    isQuoteObjectsMetaDocument,
  );
  const lookups = await backfillCollection(
    db,
    "lookups",
    "lookupid",
    "lookupid",
    isLookupsMetaDocument,
  );
  return { projects, areas, quote_objects, lookups };
}
