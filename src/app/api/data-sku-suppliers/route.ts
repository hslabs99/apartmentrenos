import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_SKU_SUPPLIERS_COLLECTION,
  isDataSkuSuppliersMetaDocument,
} from "@/lib/firestore/data-sku-suppliers-collection";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";
import { dataSkuSupplierDocToPublic } from "@/lib/server/data-sku-supplier-doc";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skuId = searchParams.get("skuId")?.trim();

    const db = getAdminFirestore();
    const col = db.collection(DATA_SKU_SUPPLIERS_COLLECTION);
    const snap = skuId ? await col.where("skuId", "==", skuId).get() : await col.get();
    const items = snap.docs
      .filter((d) => !isDataSkuSuppliersMetaDocument(d.id))
      .map((d) => dataSkuSupplierDocToPublic(d.id, d.data()))
      .filter((row) => isValidSupplierOption(row.supplierOption))
      .sort((a, b) => a.supplierOption - b.supplierOption);

    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load data_sku_suppliers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
