import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { PROJECTS_COLLECTION_META_ID } from "@/lib/firestore/projects-collection";

export const runtime = "nodejs";

/**
 * Idempotent: ensures the `projects` collection exists in Firestore (first doc write).
 * Prefer relying on GET/POST `/api/projects` (bootstrap runs there); this route remains for compatibility.
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db.collection("projects").doc(PROJECTS_COLLECTION_META_ID);
    const before = await ref.get();
    await ensureProjectsBootstrap(db);
    return NextResponse.json({ created: !before.exists });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to initialize projects collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
