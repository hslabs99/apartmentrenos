import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataSupplierDiscountRangesBootstrap } from "@/lib/firestore/collection-bootstrap";

export const runtime = "nodejs";

/** Idempotent: ensures `data_supplier_discount_ranges` exists in Firestore. */
export async function POST() {
  try {
    const db = getAdminFirestore();
    await ensureDataSupplierDiscountRangesBootstrap(db);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to initialize supplier discount ranges";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
