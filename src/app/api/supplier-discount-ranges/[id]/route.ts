import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION,
  isDataSupplierDiscountRangesMetaDocument,
} from "@/lib/firestore/data-supplier-discount-ranges-collection";
import { dataSupplierDiscountRangeDocToPublic } from "@/lib/server/data-supplier-discount-range-doc";
import type { DataSupplierDiscountRangePublic } from "@/types/data-supplier-discount-range-public";

export const runtime = "nodejs";

const updateSchema = z.object({
  rangeName: z.coerce.number().int().min(1).max(4).optional(),
  discount: z.coerce.number().finite().nonnegative().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataSupplierDiscountRangesMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const snap = await db.collection(DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const item = dataSupplierDiscountRangeDocToPublic(id, snap.data() as DocumentData);
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load range";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataSupplierDiscountRangesMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection(DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.rangeName !== undefined) update.rangeName = parsed.data.rangeName;
    if (parsed.data.discount !== undefined) update.discount = parsed.data.discount;

    await ref.update(update);
    const next = await ref.get();
    const item: DataSupplierDiscountRangePublic = dataSupplierDiscountRangeDocToPublic(
      id,
      next.data() as DocumentData,
    );
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update range";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataSupplierDiscountRangesMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection(DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete range";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
