import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectAreaObjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { PROJECTAREAOBJECTS_COLLECTION_META_ID } from "@/lib/firestore/projectareaobjects-collection";

export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db
      .collection("projectareaobjects")
      .doc(PROJECTAREAOBJECTS_COLLECTION_META_ID);
    const before = await ref.get();
    await ensureProjectAreaObjectsBootstrap(db);
    return NextResponse.json({ created: !before.exists });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to initialize project area objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
