import type { Firestore } from "firebase-admin/firestore";
import { isPriceLevelsMetaDocument } from "@/lib/firestore/price-levels-collection";
import { numOrNull } from "@/lib/server/quote-object-doc";

let cachedById: Map<number, string> | null = null;

async function loadPriceLevelNameById(db: Firestore): Promise<Map<number, string>> {
  if (cachedById) return cachedById;
  const snap = await db.collection("price_levels").get();
  const map = new Map<number, string>();
  for (const doc of snap.docs) {
    if (isPriceLevelsMetaDocument(doc.id)) continue;
    const id = numOrNull(doc.data().pricelevelid);
    if (id == null || !Number.isInteger(id)) continue;
    map.set(id, String(doc.data().pricelevel ?? "").trim());
  }
  cachedById = map;
  return map;
}

/** SKU `elevateLevel` and cascade `level` use the Price Levels display name. */
export async function resolveElevateLevelFromPriceLevelId(
  db: Firestore,
  priceLevelId: number | null,
): Promise<string> {
  if (priceLevelId == null || !Number.isInteger(priceLevelId)) return "";
  const map = await loadPriceLevelNameById(db);
  return map.get(priceLevelId) ?? "";
}
