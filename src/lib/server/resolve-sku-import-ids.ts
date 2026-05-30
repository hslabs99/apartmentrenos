import {
  buildProductKey,
  formatSkuId,
  type ProductKeyFields,
} from "@/lib/sku/product-key";
import type { DataSku } from "@/types/data-sku";
import type { DataSkuSupplier } from "@/types/data-sku-supplier";

export function parseSkuIdSequence(skuId: string): number | null {
  const m = /^SK(\d+)$/i.exec(skuId.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function productKeyFromDataSku(product: DataSku): string {
  return buildProductKey({
    category: product.category,
    productType: product.productType,
    product: product.product,
    elevateLevel: product.elevateLevel,
    style: product.style,
    colourOptions: product.colourOptions,
  });
}

export type ResolveSkuImportIdsResult = {
  products: DataSku[];
  suppliers: DataSkuSupplier[];
  productsCreated: number;
  productsUpdated: number;
};

/**
 * Match parsed products to existing Firestore docs by product key; preserve skuId on update.
 * Re-maps supplier skuIds from parse-time placeholders to resolved ids.
 * `sourceSheetRows` on each product is already set from the import pass (last workbook row for that key).
 */
export function resolveSkuImportIds(
  products: DataSku[],
  suppliers: DataSkuSupplier[],
  existingByProductKey: Map<string, string>,
): ResolveSkuImportIdsResult {
  let maxSeq = 0;
  for (const skuId of existingByProductKey.values()) {
    const seq = parseSkuIdSequence(skuId);
    if (seq != null) maxSeq = Math.max(maxSeq, seq);
  }

  let nextSeq = maxSeq + 1;
  let productsCreated = 0;
  let productsUpdated = 0;
  const oldToResolvedSkuId = new Map<string, string>();
  const keyToResolvedSkuId = new Map(existingByProductKey);

  for (const product of products) {
    const key = productKeyFromDataSku(product);
    const parseTimeSkuId = product.skuId;
    const existingSkuId = keyToResolvedSkuId.get(key);

    if (existingSkuId) {
      product.skuId = existingSkuId;
      productsUpdated += 1;
    } else {
      const newSkuId = formatSkuId(nextSeq);
      nextSeq += 1;
      product.skuId = newSkuId;
      keyToResolvedSkuId.set(key, newSkuId);
      productsCreated += 1;
    }

    oldToResolvedSkuId.set(parseTimeSkuId, product.skuId);
  }

  for (const supplier of suppliers) {
    const resolved = oldToResolvedSkuId.get(supplier.skuId);
    if (resolved) supplier.skuId = resolved;
  }

  return {
    products,
    suppliers,
    productsCreated,
    productsUpdated,
  };
}

export function loadExistingProductKeyMap(
  docs: { id: string; data: ProductKeyFields }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { id, data } of docs) {
    const key = buildProductKey(data);
    if (!map.has(key)) {
      map.set(key, id);
    }
  }
  return map;
}
