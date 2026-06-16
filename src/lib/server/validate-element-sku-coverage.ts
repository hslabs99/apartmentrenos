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
  skuProducts: string[];
  /** Element column SKU Name with no matching SKU `product` in catalog. */
  elementsMissingSku: string[];
  /** SKU `product` values (parent packages) with no element matrix — serious gap. */
  skuProductsMissingElement: string[];
  warnings: string[];
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function categoryMatches(kind: ElementSkuCoverageKind, category: string): boolean {
  const c = category.trim().toLowerCase();
  if (kind === "painting") return c.includes("paint");
  return c === "building";
}

/** Parent package SKUs — exclude material/component rows (e.g. Painting Material). */
function isParentPackageSku(category: string): boolean {
  const c = category.trim().toLowerCase();
  return !c.includes("material");
}

async function loadElementSkuNames(
  db: Firestore,
  kind: ElementSkuCoverageKind,
): Promise<string[]> {
  const collection =
    kind === "painting" ? DATA_PAINTING_ELEMENTS_COLLECTION : DATA_BUILDING_ELEMENTS_COLLECTION;
  const isMeta =
    kind === "painting" ? isDataPaintingElementsMetaDocument : isDataBuildingElementsMetaDocument;
  const snap = await db.collection(collection).get();
  const names: string[] = [];
  const seen = new Set<string>();
  for (const doc of snap.docs) {
    if (isMeta(doc.id)) continue;
    const skuName = String(doc.data().skuName ?? "").trim();
    if (!skuName) continue;
    const key = normalizeKey(skuName);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(skuName);
  }
  return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

async function loadSkuProductsForKind(
  db: Firestore,
  kind: ElementSkuCoverageKind,
): Promise<{ all: string[]; parentPackages: string[] }> {
  const snap = await db.collection(DATA_SKUS_COLLECTION).get();
  const all: string[] = [];
  const parentPackages: string[] = [];
  const seenAll = new Set<string>();
  const seenParent = new Set<string>();
  for (const doc of snap.docs) {
    if (isDataSkusMetaDocument(doc.id)) continue;
    const data = doc.data();
    if (data.isCurrent === false) continue;
    const category = String(data.category ?? "");
    if (!categoryMatches(kind, category)) continue;
    const product = String(data.product ?? "").trim();
    if (!product) continue;
    const key = normalizeKey(product);
    if (!seenAll.has(key)) {
      seenAll.add(key);
      all.push(product);
    }
    if (isParentPackageSku(category) && !seenParent.has(key)) {
      seenParent.add(key);
      parentPackages.push(product);
    }
  }
  const sort = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  return { all: all.sort(sort), parentPackages: parentPackages.sort(sort) };
}

/** Cross-check element skuNames vs SKU products for painting or building pipelines. */
export async function auditElementSkuCoverage(
  db: Firestore,
  kind: ElementSkuCoverageKind,
): Promise<ElementSkuCoverageResult> {
  const elementSkuNames = await loadElementSkuNames(db, kind);
  const { all: skuProducts, parentPackages } = await loadSkuProductsForKind(db, kind);

  const elementKeys = new Set(elementSkuNames.map(normalizeKey));
  const skuKeys = new Set(skuProducts.map(normalizeKey));

  const elementsMissingSku = elementSkuNames.filter((n) => !skuKeys.has(normalizeKey(n)));
  const skuProductsMissingElement = parentPackages.filter((p) => !elementKeys.has(normalizeKey(p)));

  const label = kind === "painting" ? "Painting" : "Building";
  const warnings: string[] = [];

  for (const name of elementsMissingSku) {
    warnings.push(
      `${label} element "${name}" has no matching SKU product in data_skus (${label} category).`,
    );
  }
  for (const product of skuProductsMissingElement) {
    warnings.push(
      `SKU product "${product}" (${label}) has no ${label.toLowerCase()} element matrix — workbench explosion will fail.`,
    );
  }

  return {
    kind,
    elementSkuNames,
    skuProducts,
    elementsMissingSku,
    skuProductsMissingElement,
    warnings,
  };
}
