import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataLabourratesBootstrap } from "@/lib/firestore/collection-bootstrap";

export const runtime = "nodejs";

/** Idempotent: ensures the `data_labourrates` collection exists in Firestore. */
export async function POST() {
  try {
    const db = getAdminFirestore();
    await ensureDataLabourratesBootstrap(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to initialize labour rates collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
