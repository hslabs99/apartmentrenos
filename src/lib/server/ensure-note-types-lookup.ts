import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isLookupsMetaDocument } from "@/lib/firestore/lookups-collection";
import { LOOKUP_TYPE_NOTE_TYPES } from "@/lib/lookup-types";
import { DEFAULT_NOTE_TYPES } from "@/lib/project-note-types";
import { allocateNextSequence } from "@/lib/firestore/sequences";

function normalizeNoteType(value: string): string {
  return value.trim().toLowerCase();
}

/** Ensure NoteTypes lookup rows exist (General, Style, Demolition, Other, Escalation). */
export async function ensureNoteTypesLookups(db: Firestore): Promise<void> {
  const snap = await db.collection("lookups").get();
  const existing = new Set<string>();
  for (const doc of snap.docs) {
    if (isLookupsMetaDocument(doc.id)) continue;
    const data = doc.data();
    if (String(data.lookuptype ?? "") !== LOOKUP_TYPE_NOTE_TYPES) continue;
    existing.add(normalizeNoteType(String(data.lookupvalue ?? "")));
  }

  for (const value of DEFAULT_NOTE_TYPES) {
    if (existing.has(normalizeNoteType(value))) continue;
    const lookupid = await allocateNextSequence(db, "lookupid");
    await db.collection("lookups").add({
      lookupid,
      lookuptype: LOOKUP_TYPE_NOTE_TYPES,
      lookupvalue: value,
      notes: "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
