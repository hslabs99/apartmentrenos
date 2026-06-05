import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataProductcontractorratesBootstrap } from "@/lib/firestore/collection-bootstrap";

export const runtime = "nodejs";

/** Idempotent: ensures the `data_productcontractorrates` collection exists in Firestore. */
export async function POST() {
  try {
    const db = getAdminFirestore();
    await ensureDataProductcontractorratesBootstrap(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : "Failed to initialize product contractor rates collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
