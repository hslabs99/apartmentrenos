import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { SALES_STAFF_COLLECTION_META_ID } from "@/lib/firestore/sales-staff-collection";

export const runtime = "nodejs";

/**
 * Idempotent: ensures the `sales_staff` collection exists in Firestore.
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db.collection("sales_staff").doc(SALES_STAFF_COLLECTION_META_ID);
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
    const message =
      e instanceof Error ? e.message : "Failed to initialize sales staff collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
