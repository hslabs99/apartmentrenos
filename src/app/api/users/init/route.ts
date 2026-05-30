import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { USERS_COLLECTION_META_ID } from "@/lib/firestore/users-collection";

export const runtime = "nodejs";

/**
 * Idempotent: ensures the `users` collection exists in Firestore (first doc write).
 * Call once when opening the Users CRUD UI.
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db.collection("users").doc(USERS_COLLECTION_META_ID);
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
    const message = e instanceof Error ? e.message : "Failed to initialize users collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
