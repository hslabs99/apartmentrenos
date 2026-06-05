import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureDataProductcontractorratesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_PRODUCTCONTRACTORRATES_COLLECTION,
  isDataProductcontractorratesMetaDocument,
} from "@/lib/firestore/data-productcontractorrates-collection";
import { dataProductContractorRateDocToPublic } from "@/lib/server/data-product-contractor-rate-doc";
import type { DataProductContractorRatePublic } from "@/types/data-product-contractor-rate-public";

export const runtime = "nodejs";

function sortProductContractorRates(
  a: DataProductContractorRatePublic,
  b: DataProductContractorRatePublic,
): number {
  const t = a.productType.localeCompare(b.productType, undefined, { sensitivity: "base" });
  if (t !== 0) return t;
  return a.specification.localeCompare(b.specification, undefined, { sensitivity: "base" });
}

/** GET — list imported product contractor rates (read-only). */
export async function GET() {
  try {
    const db = getAdminFirestore();
    await ensureDataProductcontractorratesBootstrap(db);
    const snap = await db.collection(DATA_PRODUCTCONTRACTORRATES_COLLECTION).get();
    const items: DataProductContractorRatePublic[] = snap.docs
      .filter((d) => !isDataProductcontractorratesMetaDocument(d.id))
      .map((d) => dataProductContractorRateDocToPublic(d.id, d.data()))
      .sort(sortProductContractorRates);
    return NextResponse.json({ items, count: items.length });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to list product contractor rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
