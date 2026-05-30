import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataObjectlabourratesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_OBJECTLABOURRATES_COLLECTION,
  isDataObjectlabourratesMetaDocument,
} from "@/lib/firestore/data-objectlabourrates-collection";
import { dataObjectLabourRateDocToPublic } from "@/lib/server/data-object-labour-rate-doc";
import { findObjectLabourRateByKey } from "@/lib/server/data-object-labour-rate-duplicate";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";

export const runtime = "nodejs";

const labourHoursSchema = z.coerce.number().finite().nonnegative();

const objectLabourRateBodySchema = z.object({
  category: z.string().min(1).max(120),
  productType: z.string().min(1).max(120),
  product: z.string().min(1).max(255),
  constructionAssistant: labourHoursSchema.optional().default(0),
  leadContractor: labourHoursSchema.optional().default(0),
  electrician: labourHoursSchema.optional().default(0),
  plumber: labourHoursSchema.optional().default(0),
  uom: z.string().max(40).optional().default(""),
  comments: z.string().max(2000).optional().default(""),
});

function sortObjectLabourRates(
  a: DataObjectLabourRatePublic,
  b: DataObjectLabourRatePublic,
): number {
  const c = a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
  if (c !== 0) return c;
  const t = a.productType.localeCompare(b.productType, undefined, { sensitivity: "base" });
  if (t !== 0) return t;
  return a.product.localeCompare(b.product, undefined, { sensitivity: "base" });
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataObjectlabourratesBootstrap(db);
    const snap = await db.collection(DATA_OBJECTLABOURRATES_COLLECTION).get();
    const items: DataObjectLabourRatePublic[] = snap.docs
      .filter((d) => !isDataObjectlabourratesMetaDocument(d.id))
      .map((d) => dataObjectLabourRateDocToPublic(d.id, d.data() as DocumentData))
      .sort(sortObjectLabourRates);
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list object labour rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = objectLabourRateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    await ensureDataObjectlabourratesBootstrap(db);

    const duplicateId = await findObjectLabourRateByKey(
      db,
      parsed.data.category,
      parsed.data.productType,
      parsed.data.product,
    );
    if (duplicateId) {
      return NextResponse.json(
        {
          error:
            "A row with this category, product type, and product already exists.",
        },
        { status: 409 },
      );
    }

    const ref = await db.collection(DATA_OBJECTLABOURRATES_COLLECTION).add({
      category: parsed.data.category.trim(),
      productType: parsed.data.productType.trim(),
      product: parsed.data.product.trim(),
      constructionAssistant: parsed.data.constructionAssistant,
      leadContractor: parsed.data.leadContractor,
      electrician: parsed.data.electrician,
      plumber: parsed.data.plumber,
      uom: parsed.data.uom.trim(),
      comments: parsed.data.comments.trim(),
      sheetRow: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create object labour rate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
