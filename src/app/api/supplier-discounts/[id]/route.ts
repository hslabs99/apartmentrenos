import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_SUPPLIER_DISCOUNTS_COLLECTION,
  isDataSupplierDiscountsMetaDocument,
} from "@/lib/firestore/data-supplier-discounts-collection";
import { dataSupplierDiscountDocToPublic } from "@/lib/server/data-supplier-discount-doc";
import { findSupplierDiscountBySupplier } from "@/lib/server/data-supplier-discount-duplicate";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";

export const runtime = "nodejs";

const optionalPctSchema = z
  .union([z.coerce.number().finite().min(0).max(100), z.null()])
  .optional();

const updateSchema = z.object({
  supplier: z.string().min(1).max(120).optional(),
  default: z.coerce.number().finite().min(0).max(100).optional(),
  range1: optionalPctSchema,
  range2: optionalPctSchema,
  range3: optionalPctSchema,
  range4: optionalPctSchema,
  comment: z.string().max(500).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataSupplierDiscountsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const snap = await db.collection(DATA_SUPPLIER_DISCOUNTS_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const item = dataSupplierDiscountDocToPublic(id, snap.data() as DocumentData);
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load supplier discount";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataSupplierDiscountsMetaDocument(id)) {
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
    const ref = db.collection(DATA_SUPPLIER_DISCOUNTS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const current = dataSupplierDiscountDocToPublic(id, snap.data() as DocumentData);
    const supplier = parsed.data.supplier?.trim() ?? current.supplier;

    const duplicateId = await findSupplierDiscountBySupplier(db, supplier, id);
    if (duplicateId) {
      return NextResponse.json(
        { error: "A supplier discount for this supplier already exists." },
        { status: 409 },
      );
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.supplier !== undefined) update.supplier = supplier;
    if (parsed.data.default !== undefined) update.default = parsed.data.default;
    if (parsed.data.range1 !== undefined) update.range1 = parsed.data.range1;
    if (parsed.data.range2 !== undefined) update.range2 = parsed.data.range2;
    if (parsed.data.range3 !== undefined) update.range3 = parsed.data.range3;
    if (parsed.data.range4 !== undefined) update.range4 = parsed.data.range4;
    if (parsed.data.comment !== undefined) {
      const comment = parsed.data.comment.trim();
      if (comment) update.comment = comment;
      else update.comment = FieldValue.delete();
    }

    await ref.update(update);
    const next = await ref.get();
    const item: DataSupplierDiscountPublic = dataSupplierDiscountDocToPublic(
      id,
      next.data() as DocumentData,
    );
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update supplier discount";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataSupplierDiscountsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection(DATA_SUPPLIER_DISCOUNTS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete supplier discount";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
