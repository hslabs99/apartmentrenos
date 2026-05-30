import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { AREAS_COLLECTION_META_ID } from "@/lib/firestore/areas-collection";

export const runtime = "nodejs";

/**
 * Idempotent: ensures the `areas` collection exists in Firestore.
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db.collection("areas").doc(AREAS_COLLECTION_META_ID);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        kind: "collection_bootstrap",
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ created: true });
    }
    return NextResponse.json({ created: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to initialize areas collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
