import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_OBJECTLABOURRATES_COLLECTION,
  isDataObjectlabourratesMetaDocument,
} from "@/lib/firestore/data-objectlabourrates-collection";
import { dataObjectLabourRateDocToPublic } from "@/lib/server/data-object-labour-rate-doc";
import { findObjectLabourRateByKey } from "@/lib/server/data-object-labour-rate-duplicate";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";

export const runtime = "nodejs";

const labourHoursSchema = z.coerce.number().finite().nonnegative();

const updateSchema = z.object({
  category: z.string().min(1).max(120).optional(),
  productType: z.string().min(1).max(120).optional(),
  product: z.string().min(1).max(255).optional(),
  constructionAssistant: labourHoursSchema.optional(),
  leadContractor: labourHoursSchema.optional(),
  electrician: labourHoursSchema.optional(),
  plumber: labourHoursSchema.optional(),
  uom: z.string().max(40).optional(),
  comments: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataObjectlabourratesMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const snap = await db.collection(DATA_OBJECTLABOURRATES_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const item = dataObjectLabourRateDocToPublic(id, snap.data() as DocumentData);
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load object labour rate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataObjectlabourratesMetaDocument(id)) {
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
    const ref = db.collection(DATA_OBJECTLABOURRATES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const current = dataObjectLabourRateDocToPublic(id, snap.data() as DocumentData);
    const category = parsed.data.category?.trim() ?? current.category;
    const productType = parsed.data.productType?.trim() ?? current.productType;
    const product = parsed.data.product?.trim() ?? current.product;

    const duplicateId = await findObjectLabourRateByKey(db, category, productType, product, id);
    if (duplicateId) {
      return NextResponse.json(
        {
          error:
            "A row with this category, product type, and product already exists.",
        },
        { status: 409 },
      );
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.category !== undefined) update.category = category;
    if (parsed.data.productType !== undefined) update.productType = productType;
    if (parsed.data.product !== undefined) update.product = product;
    if (parsed.data.constructionAssistant !== undefined) {
      update.constructionAssistant = parsed.data.constructionAssistant;
    }
    if (parsed.data.leadContractor !== undefined) update.leadContractor = parsed.data.leadContractor;
    if (parsed.data.electrician !== undefined) update.electrician = parsed.data.electrician;
    if (parsed.data.plumber !== undefined) update.plumber = parsed.data.plumber;
    if (parsed.data.uom !== undefined) update.uom = parsed.data.uom.trim();
    if (parsed.data.comments !== undefined) update.comments = parsed.data.comments.trim();

    await ref.update(update);
    const next = await ref.get();
    const item: DataObjectLabourRatePublic = dataObjectLabourRateDocToPublic(
      id,
      next.data() as DocumentData,
    );
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update object labour rate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataObjectlabourratesMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection(DATA_OBJECTLABOURRATES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete object labour rate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
