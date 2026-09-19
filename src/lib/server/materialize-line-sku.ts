import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { buildPrimarySupplierBySkuId } from "@/lib/client/primary-supplier-by-sku";
import { DATA_SKU_SUPPLIERS_COLLECTION } from "@/lib/firestore/data-sku-suppliers-collection";
import { isDataSkuSuppliersMetaDocument } from "@/lib/firestore/data-sku-suppliers-collection";
import { dataSkuSupplierDocToPublic } from "@/lib/server/data-sku-supplier-doc";
import { resolveEffectiveStyleColour } from "@/lib/server/resolve-effective-style-colour";
import { resolveElevateLevelFromPriceLevelId } from "@/lib/server/resolve-elevate-level-from-price-level";
import { resolveSkuForQuoteObject } from "@/lib/server/resolve-sku-for-quote-object";

export type MaterializedLineSku = {
  skuId: string | null;
  skuProduct: string | null;
  uom: string | null;
  /** Primary supplier ex-GST when a SKU matched. */
  supplierPriceExcGst: number | null;
};

let primaryPriceBySkuId: Map<string, number | null> | null = null;

export function clearPrimarySupplierPriceCache(): void {
  primaryPriceBySkuId = null;
}

export function isPrimarySupplierPriceCacheWarm(): boolean {
  return primaryPriceBySkuId != null;
}

async function loadPrimaryPriceBySkuId(
  db: Firestore,
): Promise<Map<string, number | null>> {
  if (primaryPriceBySkuId) return primaryPriceBySkuId;
  const snap = await db.collection(DATA_SKU_SUPPLIERS_COLLECTION).get();
  const items = snap.docs
    .filter((d) => !isDataSkuSuppliersMetaDocument(d.id))
    .map((d) => dataSkuSupplierDocToPublic(d.id, d.data()));
  const primary = buildPrimarySupplierBySkuId(items);
  const map = new Map<string, number | null>();
  for (const [skuId, row] of Object.entries(primary)) {
    map.set(skuId, row?.priceExcGst ?? null);
  }
  primaryPriceBySkuId = map;
  return map;
}

export async function primePrimarySupplierPriceCache(db: Firestore): Promise<void> {
  await loadPrimaryPriceBySkuId(db);
}

export async function primarySupplierPriceExcGst(
  db: Firestore,
  skuId: string,
): Promise<number | null> {
  const id = skuId.trim();
  if (!id) return null;
  const map = await loadPrimaryPriceBySkuId(db);
  return map.get(id) ?? null;
}

/**
 * Resolves catalog SKU for a new project line using effective Elevate / style / colour
 * (area + project defaults, same as scope materialization).
 */
export async function materializeSkuForNewProjectLine(
  db: Firestore,
  quoteData: DocumentData | undefined,
  args: {
    projectAreaDocId: string;
    projectid: number;
    effectivePriceLevelId: number | null;
    lineStyle?: string | null;
    lineColour?: string | null;
  },
): Promise<MaterializedLineSku> {
  const { style: areaStyle, colour: areaColour } = await resolveEffectiveStyleColour(
    db,
    args.projectAreaDocId,
    args.projectid,
  );
  const style =
    (args.lineStyle != null && String(args.lineStyle).trim()
      ? String(args.lineStyle).trim()
      : areaStyle) || "";
  const colour =
    (args.lineColour != null && String(args.lineColour).trim()
      ? String(args.lineColour).trim()
      : areaColour) || "";
  const elevateLevel = await resolveElevateLevelFromPriceLevelId(
    db,
    args.effectivePriceLevelId,
  );

  const resolved = await resolveSkuForQuoteObject(db, quoteData, {
    elevateLevel,
    style,
    colour,
  });

  if (!resolved) {
    return { skuId: null, skuProduct: null, uom: null, supplierPriceExcGst: null };
  }

  const supplierPriceExcGst = await primarySupplierPriceExcGst(db, resolved.skuId);
  return {
    skuId: resolved.skuId,
    skuProduct: resolved.product,
    uom: resolved.uom || null,
    supplierPriceExcGst,
  };
}
