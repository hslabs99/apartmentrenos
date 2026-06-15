import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";
import { dataSkuDocToPublic } from "@/lib/server/data-sku-doc";

export const runtime = "nodejs";

const updateSchema = z.object({
  calcM2: z.boolean().optional(),
  calculatedM2: z.union([z.coerce.number().finite().nonnegative(), z.null()]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isDataSkusMetaDocument(id)) {
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
    const ref = db.collection(DATA_SKUS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (parsed.data.calcM2 !== undefined) {
      update.calcM2 = parsed.data.calcM2;
    }
    if (parsed.data.calculatedM2 !== undefined) {
      update.calculatedM2 = parsed.data.calculatedM2;
    }

    await ref.update(update);
    const next = await ref.get();
    const item = dataSkuDocToPublic(id, next.data() as DocumentData);
    return NextResponse.json({
      skuId: id,
      calcM2: item.calcM2,
      calculatedM2: item.calculatedM2,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update data SKU";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
