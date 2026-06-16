import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataPaintingElementsBootstrap } from "@/lib/firestore/collection-bootstrap";

export const runtime = "nodejs";

/** Idempotent: ensures the `data_painting_elements` collection exists in Firestore. */
export async function POST() {
  try {
    const db = getAdminFirestore();
    await ensureDataPaintingElementsBootstrap(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to initialize painting elements collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
