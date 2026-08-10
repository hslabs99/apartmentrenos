import type { Firestore } from "firebase-admin/firestore";
import {
  DATA_BUILDING_ELEMENTS_COLLECTION,
  isDataBuildingElementsMetaDocument,
} from "@/lib/firestore/data-building-elements-collection";
import {
  DATA_PAINTING_ELEMENTS_COLLECTION,
  isDataPaintingElementsMetaDocument,
} from "@/lib/firestore/data-painting-elements-collection";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";

export type ElementSkuCoverageKind = "painting" | "building";

export type ElementSkuCoverageResult = {
  kind: ElementSkuCoverageKind;
  elementSkuNames: string[];
  /** Current catalog `product` values used for existence checks. */
  skuProducts: string[];
  /** Element column SKU Name with no matching SKU `product` in catalog. */
  elementsMissingSku: string[];
  /**
   * Detail-line SKU products (under an element column) with no matching catalog product.
   * Format: `"ParentSkuName::DetailProduct"`.
   */
  elementDetailProductsMissingSku: string[];
  /**
   * @deprecated Always empty — coverage no longer requires every category SKU to own a matrix.
   * Kept so older clients reading this field do not break.
   */
  skuProductsMissingElement: string[];
  warnings: string[];
};

type ElementCoverageRow = {
  skuName: string;
  detailProducts: string[];
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

async function loadElementRows(
  db: Firestore,
  kind: ElementSkuCoverageKind,
): Promise<ElementCoverageRow[]> {
  const collection =
    kind === "painting" ? DATA_PAINTING_ELEMENTS_COLLECTION : DATA_BUILDING_ELEMENTS_COLLECTION;
  const isMeta =
    kind === "painting" ? isDataPaintingElementsMetaDocument : isDataBuildingElementsMetaDocument;
  const snap = await db.collection(collection).get();
  const rows: ElementCoverageRow[] = [];
  const seenParents = new Set<string>();

  for (const doc of snap.docs) {
    if (isMeta(doc.id)) continue;
    const data = doc.data();
    const skuName = String(data.skuName ?? "").trim();
    if (!skuName) continue;
    const parentKey = normalizeKey(skuName);
    if (seenParents.has(parentKey)) continue;
    seenParents.add(parentKey);

    const rawLines = Array.isArray(data.lines) ? data.lines : [];
    const detailProducts: string[] = [];
    const seenDetails = new Set<string>();
    for (const line of rawLines) {
      const row = line as Record<string, unknown>;
      const skuProduct = String(row.skuProduct ?? "").trim();
      if (!skuProduct) continue;
      const detailKey = normalizeKey(skuProduct);
      if (seenDetails.has(detailKey)) continue;
      seenDetails.add(detailKey);
      detailProducts.push(skuProduct);
    }

    rows.push({ skuName, detailProducts });
  }

  return rows.sort((a, b) =>
    a.skuName.localeCompare(b.skuName, undefined, { sensitivity: "base" }),
  );
}

/** All current catalog product names (any category) — elements only require existence. */
async function loadCurrentSkuProductNames(db: Firestore): Promise<string[]> {
  const snap = await db.collection(DATA_SKUS_COLLECTION).get();
  const names: string[] = [];
  const seen = new Set<string>();
  for (const doc of snap.docs) {
    if (isDataSkusMetaDocument(doc.id)) continue;
    const data = doc.data();
    if (data.isCurrent === false) continue;
    const product = String(data.product ?? "").trim();
    if (!product) continue;
    const key = normalizeKey(product);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(product);
  }
  return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Coverage for painting/building elements: each element column (and its detail lines)
 * must reference an existing `data_skus` product. Does not require catalog SKUs to own matrices.
 */
export async function auditElementSkuCoverage(
  db: Firestore,
  kind: ElementSkuCoverageKind,
): Promise<ElementSkuCoverageResult> {
  const elementRows = await loadElementRows(db, kind);
  const skuProducts = await loadCurrentSkuProductNames(db);
  const skuKeys = new Set(skuProducts.map(normalizeKey));

  const elementSkuNames = elementRows.map((r) => r.skuName);
  const elementsMissingSku = elementRows
    .filter((r) => !skuKeys.has(normalizeKey(r.skuName)))
    .map((r) => r.skuName);

  const elementDetailProductsMissingSku: string[] = [];
  for (const row of elementRows) {
    for (const detail of row.detailProducts) {
      if (skuKeys.has(normalizeKey(detail))) continue;
      elementDetailProductsMissingSku.push(`${row.skuName}::${detail}`);
    }
  }

  const label = kind === "painting" ? "Painting" : "Building";
  const warnings: string[] = [];

  for (const name of elementsMissingSku) {
    warnings.push(
      `${label} element "${name}" has no matching SKU product in data_skus.`,
    );
  }
  for (const ref of elementDetailProductsMissingSku) {
    const sep = ref.indexOf("::");
    const parent = sep >= 0 ? ref.slice(0, sep) : "";
    const detail = sep >= 0 ? ref.slice(sep + 2) : ref;
    warnings.push(
      `${label} element "${parent}" line "${detail}" has no matching SKU product in data_skus.`,
    );
  }

  return {
    kind,
    elementSkuNames,
    skuProducts,
    elementsMissingSku,
    elementDetailProductsMissingSku,
    skuProductsMissingElement: [],
    warnings,
  };
}
