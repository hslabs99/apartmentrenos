import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PROJECT_NOTES_COLLECTION_META_ID } from "@/lib/firestore/project-notes-collection";
import { ensureNoteTypesLookups } from "@/lib/server/ensure-note-types-lookup";

export const runtime = "nodejs";

/**
 * Idempotent: ensures the `project_notes` collection exists and NoteTypes lookups are seeded.
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db.collection("project_notes").doc(PROJECT_NOTES_COLLECTION_META_ID);
    const snap = await ref.get();
    let created = false;
    if (!snap.exists) {
      await ref.set({
        kind: "collection_bootstrap",
        createdAt: FieldValue.serverTimestamp(),
      });
      created = true;
    }
    await ensureNoteTypesLookups(db);
    return NextResponse.json({ created });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to initialize project_notes collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
