import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataSupplierDiscountRangesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION,
  isDataSupplierDiscountRangesMetaDocument,
} from "@/lib/firestore/data-supplier-discount-ranges-collection";
import { dataSupplierDiscountRangeDocToPublic } from "@/lib/server/data-supplier-discount-range-doc";
import type { DataSupplierDiscountRangePublic } from "@/types/data-supplier-discount-range-public";

export const runtime = "nodejs";

const rangeBodySchema = z.object({
  rangeName: z.coerce.number().int().min(1).max(4),
  discount: z.coerce.number().finite().nonnegative(),
});

function sortRanges(
  a: DataSupplierDiscountRangePublic,
  b: DataSupplierDiscountRangePublic,
): number {
  return a.rangeName - b.rangeName;
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataSupplierDiscountRangesBootstrap(db);
    const snap = await db.collection(DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION).get();
    const items: DataSupplierDiscountRangePublic[] = snap.docs
      .filter((d) => !isDataSupplierDiscountRangesMetaDocument(d.id))
      .map((d) => dataSupplierDiscountRangeDocToPublic(d.id, d.data() as DocumentData))
      .sort(sortRanges);
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list supplier discount ranges";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = rangeBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    await ensureDataSupplierDiscountRangesBootstrap(db);

    const docId = String(parsed.data.rangeName);
    const ref = db.collection(DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION).doc(docId);
    const existing = await ref.get();
    if (existing.exists && !isDataSupplierDiscountRangesMetaDocument(docId)) {
      return NextResponse.json(
        { error: `Range ${parsed.data.rangeName} already exists.` },
        { status: 409 },
      );
    }

    await ref.set({
      rangeName: parsed.data.rangeName,
      discount: parsed.data.discount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: docId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create supplier discount range";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
