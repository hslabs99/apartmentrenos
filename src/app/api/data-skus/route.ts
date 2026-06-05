import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  DATA_SKU_SUPPLIERS_COLLECTION,
  isDataSkuSuppliersMetaDocument,
} from "@/lib/firestore/data-sku-suppliers-collection";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";
import { buildPrimarySupplierBySkuId } from "@/lib/client/primary-supplier-by-sku";
import { dataSkuDocToPublic } from "@/lib/server/data-sku-doc";
import { dataSkuSupplierDocToPublic } from "@/lib/server/data-sku-supplier-doc";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getAdminFirestore();
    const [skuSnap, supplierSnap] = await Promise.all([
      db.collection(DATA_SKUS_COLLECTION).get(),
      db.collection(DATA_SKU_SUPPLIERS_COLLECTION).get(),
    ]);

    const supplierCountBySkuId = new Map<string, number>();
    const supplierItems = [];
    for (const doc of supplierSnap.docs) {
      if (isDataSkuSuppliersMetaDocument(doc.id)) continue;
      const row = dataSkuSupplierDocToPublic(doc.id, doc.data());
      if (!isValidSupplierOption(row.supplierOption)) continue;
      supplierItems.push(row);
      const skuId = row.skuId.trim();
      if (!skuId) continue;
      supplierCountBySkuId.set(skuId, (supplierCountBySkuId.get(skuId) ?? 0) + 1);
    }
    const primarySupplierBySkuId = buildPrimarySupplierBySkuId(supplierItems);

    const items = skuSnap.docs
      .filter((d) => !isDataSkusMetaDocument(d.id))
      .map((d) => {
        const skuId = String(d.data().skuId ?? d.id).trim() || d.id;
        return dataSkuDocToPublic(
          d.id,
          d.data(),
          supplierCountBySkuId.get(skuId) ?? 0,
          primarySupplierBySkuId[skuId] ?? null,
        );
      })
      .sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));

    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load data_skus";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
