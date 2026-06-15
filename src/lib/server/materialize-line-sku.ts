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

export async function primarySupplierPriceExcGst(
  db: Firestore,
  skuId: string,
): Promise<number | null> {
  const snap = await db.collection(DATA_SKU_SUPPLIERS_COLLECTION).where("skuId", "==", skuId).get();
  const items = snap.docs
    .filter((d) => !isDataSkuSuppliersMetaDocument(d.id))
    .map((d) => dataSkuSupplierDocToPublic(d.id, d.data()));
  const primary = buildPrimarySupplierBySkuId(items)[skuId];
  return primary?.priceExcGst ?? null;
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
