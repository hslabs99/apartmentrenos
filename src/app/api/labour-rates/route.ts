import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataLabourratesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_LABOURRATES_COLLECTION,
  isDataLabourratesMetaDocument,
} from "@/lib/firestore/data-labourrates-collection";
import { dataLabourRateDocToPublic } from "@/lib/server/data-labour-rate-doc";
import { findLabourRateByKey } from "@/lib/server/data-labour-rate-duplicate";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";

export const runtime = "nodejs";

const labourRateBodySchema = z.object({
  category: z.string().min(1).max(120),
  productType: z.string().min(1).max(120),
  product: z.string().min(1).max(255),
  priceExcGst: z.coerce.number().finite().nonnegative(),
  uom: z.string().min(1).max(40),
});

function sortLabourRates(a: DataLabourRatePublic, b: DataLabourRatePublic): number {
  const c = a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
  if (c !== 0) return c;
  const t = a.productType.localeCompare(b.productType, undefined, { sensitivity: "base" });
  if (t !== 0) return t;
  return a.product.localeCompare(b.product, undefined, { sensitivity: "base" });
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataLabourratesBootstrap(db);
    const snap = await db.collection(DATA_LABOURRATES_COLLECTION).get();
    const items: DataLabourRatePublic[] = snap.docs
      .filter((d) => !isDataLabourratesMetaDocument(d.id))
      .map((d) => dataLabourRateDocToPublic(d.id, d.data() as DocumentData))
      .sort(sortLabourRates);
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list labour rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = labourRateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    await ensureDataLabourratesBootstrap(db);

    const duplicateId = await findLabourRateByKey(
      db,
      parsed.data.category,
      parsed.data.productType,
      parsed.data.product,
    );
    if (duplicateId) {
      return NextResponse.json(
        {
          error:
            "A labour rate with this category, product type, and product already exists.",
        },
        { status: 409 },
      );
    }

    const ref = await db.collection(DATA_LABOURRATES_COLLECTION).add({
      category: parsed.data.category.trim(),
      productType: parsed.data.productType.trim(),
      product: parsed.data.product.trim(),
      priceExcGst: parsed.data.priceExcGst,
      uom: parsed.data.uom.trim(),
      sheetRow: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create labour rate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
