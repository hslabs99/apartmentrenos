import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { DATA_SKUS_COLLECTION } from "@/lib/firestore/data-skus-collection";
import type { SkuCalcM2Fields } from "@/lib/sku/sku-calc-m2-measure";

function parseCalculatedM2(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function skuCalcM2FieldsFromDoc(data: DocumentData | undefined): SkuCalcM2Fields | null {
  if (!data) return null;
  return {
    calcM2: data.calcM2 === true,
    calculatedM2: parseCalculatedM2(data.calculatedM2),
  };
}

export async function loadSkuCalcM2Fields(
  db: Firestore,
  skuId: string | null | undefined,
): Promise<SkuCalcM2Fields | null> {
  const id = String(skuId ?? "").trim();
  if (!id) return null;
  const snap = await db.collection(DATA_SKUS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return skuCalcM2FieldsFromDoc(snap.data());
}
