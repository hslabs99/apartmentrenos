import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataSupplierDiscountsBootstrap } from "@/lib/firestore/collection-bootstrap";
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

const supplierDiscountBodySchema = z.object({
  supplier: z.string().min(1).max(120),
  default: z.coerce.number().finite().min(0).max(100),
  range1: optionalPctSchema,
  range2: optionalPctSchema,
  range3: optionalPctSchema,
  range4: optionalPctSchema,
  comment: z.string().max(500).optional(),
});

function sortSupplierDiscounts(
  a: DataSupplierDiscountPublic,
  b: DataSupplierDiscountPublic,
): number {
  return a.supplier.localeCompare(b.supplier, undefined, { sensitivity: "base" });
}

function normalizeOptionalPct(v: number | null | undefined): number | null {
  if (v == null) return null;
  return v;
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataSupplierDiscountsBootstrap(db);
    const snap = await db.collection(DATA_SUPPLIER_DISCOUNTS_COLLECTION).get();
    const items: DataSupplierDiscountPublic[] = snap.docs
      .filter((d) => !isDataSupplierDiscountsMetaDocument(d.id))
      .map((d) => dataSupplierDiscountDocToPublic(d.id, d.data() as DocumentData))
      .sort(sortSupplierDiscounts);
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list supplier discounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = supplierDiscountBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    await ensureDataSupplierDiscountsBootstrap(db);

    const supplier = parsed.data.supplier.trim();
    const duplicateId = await findSupplierDiscountBySupplier(db, supplier);
    if (duplicateId) {
      return NextResponse.json(
        { error: "A supplier discount for this supplier already exists." },
        { status: 409 },
      );
    }

    const comment = parsed.data.comment?.trim();
    const ref = await db.collection(DATA_SUPPLIER_DISCOUNTS_COLLECTION).add({
      supplier,
      default: parsed.data.default,
      range1: normalizeOptionalPct(parsed.data.range1),
      range2: normalizeOptionalPct(parsed.data.range2),
      range3: normalizeOptionalPct(parsed.data.range3),
      range4: normalizeOptionalPct(parsed.data.range4),
      ...(comment ? { comment } : {}),
      sheetRow: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create supplier discount";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
