import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { DATA_SKUS_COLLECTION } from "@/lib/firestore/data-skus-collection";
import { skuCalcM2FieldsFromCatalog } from "@/lib/server/resolve-sku-for-quote-object";
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
  return skuCalcM2FieldsFromCatalog(db, skuId);
}

/** Per-SKU docs only — does not scan the catalog (use on metric reprice). */
export async function loadSkuCalcM2FieldsBySkuIds(
  db: Firestore,
  skuIds: Iterable<string | null | undefined>,
): Promise<Map<string, SkuCalcM2Fields | null>> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of skuIds) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  const map = new Map<string, SkuCalcM2Fields | null>();
  if (unique.length === 0) return map;
  const snaps = await Promise.all(
    unique.map((id) => db.collection(DATA_SKUS_COLLECTION).doc(id).get()),
  );
  unique.forEach((id, i) => {
    const snap = snaps[i];
    map.set(id, snap?.exists ? skuCalcM2FieldsFromDoc(snap.data()) : null);
  });
  return map;
}
