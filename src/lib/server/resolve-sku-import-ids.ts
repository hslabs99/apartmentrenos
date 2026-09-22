import {
  buildProductIdentityKey,
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

export type ExistingSkuImportIndexes = {
  byProductKey: Map<string, string>;
  byUniqueIdentity: Map<string, string>;
};

function nextSequenceAfterExisting(skuIds: Iterable<string>): number {
  let maxSeq = 0;
  for (const skuId of skuIds) {
    const seq = parseSkuIdSequence(skuId);
    if (seq != null) maxSeq = Math.max(maxSeq, seq);
  }
  return maxSeq + 1;
}

/**
 * Match parsed products to existing Firestore docs; preserve skuId on update.
 *
 * 1. Full 6-part product key (category through colour).
 * 2. Else unique Product Type + Product name (rebuilds that change elevate / style /
 *    colour / category keep the same SK#####). Ambiguous type+name pairs are skipped.
 * 3. Else mint a new skuId.
 *
 * Re-maps supplier skuIds from parse-time placeholders to resolved ids.
 * Does not change prices on project lines.
 */
export function resolveSkuImportIds(
  products: DataSku[],
  suppliers: DataSkuSupplier[],
  existingByProductKey: Map<string, string>,
  existingByUniqueIdentity: Map<string, string> = new Map(),
): ResolveSkuImportIdsResult {
  let nextSeq = nextSequenceAfterExisting(existingByProductKey.values());
  let productsCreated = 0;
  let productsUpdated = 0;
  const oldToResolvedSkuId = new Map<string, string>();
  const keyToResolvedSkuId = new Map(existingByProductKey);
  const claimedSkuIds = new Set<string>();

  for (const product of products) {
    const key = productKeyFromDataSku(product);
    const parseTimeSkuId = product.skuId;
    const identity = buildProductIdentityKey(product.productType, product.product);

    let existingSkuId = keyToResolvedSkuId.get(key);
    if (existingSkuId && claimedSkuIds.has(existingSkuId)) existingSkuId = undefined;
    if (!existingSkuId && identity) {
      const byIdentity = existingByUniqueIdentity.get(identity);
      if (byIdentity && !claimedSkuIds.has(byIdentity)) existingSkuId = byIdentity;
    }

    if (existingSkuId) {
      product.skuId = existingSkuId;
      claimedSkuIds.add(existingSkuId);
      keyToResolvedSkuId.set(key, existingSkuId);
      productsUpdated += 1;
    } else {
      const newSkuId = formatSkuId(nextSeq);
      nextSeq += 1;
      product.skuId = newSkuId;
      claimedSkuIds.add(newSkuId);
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

/** Type + product → skuId only when exactly one existing row has that pair. */
export function loadExistingUniqueProductIdentityMap(
  docs: { id: string; data: Pick<ProductKeyFields, "productType" | "product"> }[],
): Map<string, string> {
  const grouped = new Map<string, string[]>();
  for (const { id, data } of docs) {
    const key = buildProductIdentityKey(data.productType, data.product);
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(id);
    grouped.set(key, list);
  }
  const unique = new Map<string, string>();
  for (const [key, ids] of grouped) {
    if (ids.length === 1 && ids[0]) unique.set(key, ids[0]);
  }
  return unique;
}

export function loadExistingSkuImportIndexes(
  docs: { id: string; data: ProductKeyFields }[],
): ExistingSkuImportIndexes {
  return {
    byProductKey: loadExistingProductKeyMap(docs),
    byUniqueIdentity: loadExistingUniqueProductIdentityMap(docs),
  };
}
