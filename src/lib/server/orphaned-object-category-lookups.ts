import type { Firestore } from "firebase-admin/firestore";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { LOOKUP_TYPE_OBJECT_CATEGORY } from "@/lib/lookup-types";
import { lookupDocToPublic } from "@/lib/server/lookup-doc";
import {
  collectQuoteObjectCategoryNorms,
  normalizeObjectCategoryValue,
} from "@/lib/server/quote-object-categories";
import type { LookupPublic } from "@/types/lookup";

const DELETE_BATCH_SIZE = 500;

export function orphanedObjectCategoryLookupIds(
  lookups: LookupPublic[],
  objectCategoryNorms: Set<string>,
): string[] {
  return lookups
    .filter(
      (l) =>
        l.lookuptype === LOOKUP_TYPE_OBJECT_CATEGORY &&
        !objectCategoryNorms.has(normalizeObjectCategoryValue(l.lookupvalue)),
    )
    .map((l) => l.id);
}

export async function deleteOrphanedObjectCategoryLookups(db: Firestore): Promise<{
  deleted: number;
  deletedValues: string[];
}> {
  const snap = await db.collection("lookups").get();
  const lookups: LookupPublic[] = snap.docs
    .filter((d) => !isLookupsMetaDocument(d.id))
    .map((d) => lookupDocToPublic(d.id, d.data()));
  const objectCategoryNorms = await collectQuoteObjectCategoryNorms(db);
  const ids = orphanedObjectCategoryLookupIds(lookups, objectCategoryNorms);
  const deletedValues = lookups
    .filter((l) => ids.includes(l.id))
    .map((l) => l.lookupvalue)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const chunk = ids.slice(i, i + DELETE_BATCH_SIZE);
    const batch = db.batch();
    for (const id of chunk) {
      batch.delete(db.collection("lookups").doc(id));
    }
    await batch.commit();
    deleted += chunk.length;
  }

  return { deleted, deletedValues };
}
