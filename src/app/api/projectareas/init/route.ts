import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectAreasBootstrap } from "@/lib/firestore/collection-bootstrap";
import { PROJECTAREAS_COLLECTION_META_ID } from "@/lib/firestore/projectareas-collection";

export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db.collection("projectareas").doc(PROJECTAREAS_COLLECTION_META_ID);
    const before = await ref.get();
    await ensureProjectAreasBootstrap(db);
    return NextResponse.json({ created: !before.exists });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to initialize project areas collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
