import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { LOOKUPS_COLOURS_COLLECTION_META_ID } from "@/lib/firestore/lookups-colours-collection";

export const runtime = "nodejs";

export async function POST() {
  try {
    const db = getAdminFirestore();
    const ref = db.collection("lookups_colours").doc(LOOKUPS_COLOURS_COLLECTION_META_ID);
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
      e instanceof Error ? e.message : "Failed to initialize lookups_colours collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
