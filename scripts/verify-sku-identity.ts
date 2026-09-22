import { buildProductIdentityKey } from "../src/lib/sku/product-key";
import { loadExistingSkuImportIndexes, resolveSkuImportIds } from "../src/lib/server/resolve-sku-import-ids";
import {
  currentCatalogSkuIdentityKeySet,
  currentCatalogSkuIdSet,
  currentCatalogSkuProductNameSet,
  projectLineHasOrphanSku,
} from "../src/lib/health-check/orphan-refs";
import {
  activeScopeLineSkuPickValue,
  SCOPE_LINE_STORED_SKU_VALUE,
} from "../src/lib/client/scope-line-sku-match";
import type { DataSku } from "../src/types/data-sku";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sku(partial: Partial<DataSku> & Pick<DataSku, "skuId" | "product">): DataSku {
  return {
    category: "Building",
    productType: "Demolition",
    elevateLevel: "All",
    style: "All",
    colourOptions: "All",
    uom: "M2",
    append1Type: "",
    append1Spec: "",
    append2Type: "",
    append2Spec: "",
    append3Type: "",
    append3Spec: "",
    sheetWidth: "",
    stockAvailable: "",
    leadTime: "",
    location: "",
    comments: "",
    sourceSheetRows: [1],
    isCurrent: true,
    calcM2: false,
    calculatedM2: null,
    ...partial,
  };
}

const docs = [
  {
    id: "SK01980",
    data: {
      category: "Building",
      productType: "Demolition",
      product: "Demolition Other Floor",
      elevateLevel: "Investor",
      style: "All",
      colourOptions: "All",
    },
  },
];
const indexes = loadExistingSkuImportIndexes(docs);
const resolved = resolveSkuImportIds(
  [sku({ skuId: "SK00001", product: "Demolition Other Floor" })],
  [],
  indexes.byProductKey,
  indexes.byUniqueIdentity,
);
assert(resolved.products[0]?.skuId === "SK01980", `expected reuse SK01980, got ${resolved.products[0]?.skuId}`);
assert(resolved.productsUpdated === 1 && resolved.productsCreated === 0, "expected update not create");

const ambiguous = loadExistingSkuImportIndexes([
  docs[0]!,
  { id: "SK01999", data: { ...docs[0]!.data, elevateLevel: "Premium" } },
]);
assert(
  !ambiguous.byUniqueIdentity.has(buildProductIdentityKey("Demolition", "Demolition Other Floor")),
  "ambiguous identity must not merge",
);

const catalog = [
  {
    id: "SK02116",
    skuId: "SK02116",
    product: "Demolition Other Floor",
    productType: "Demolition",
    isCurrent: true,
  },
];
const ids = currentCatalogSkuIdSet(catalog);
const identities = currentCatalogSkuIdentityKeySet(catalog);
const names = currentCatalogSkuProductNameSet(catalog);
assert(
  !projectLineHasOrphanSku(
    { skuId: "SK01980", skuProduct: "Demolition Other Floor", objectname: "Demolition" },
    ids,
    identities,
    names,
  ),
  "stale id with live type+name should not be orphan",
);
assert(
  projectLineHasOrphanSku(
    { skuId: "SK01980", skuProduct: "Gone Product", objectname: "Demolition" },
    ids,
    identities,
    names,
  ),
  "stale id with gone name should be orphan",
);

const pickVal = activeScopeLineSkuPickValue(
  { skuId: "SK01980", supplierOption: 1, skuProduct: "Demolition Other Floor" },
  [
    {
      skuId: "SK02116",
      product: "Demolition Other Floor",
      uom: "M2",
      supplierOption: 1,
      supplier: "",
      model: "",
      supplierSku: "",
      link: "",
      priceExcGst: 14.25,
      discountPctApplied: null,
      appendSlots: [],
    },
  ],
);
assert(pickVal === SCOPE_LINE_STORED_SKU_VALUE, `picker must show stored name, not bind to ${pickVal}`);

const fullKeyStillWins = resolveSkuImportIds(
  [sku({ skuId: "SK00002", product: "Demolition Other Floor", elevateLevel: "Investor" })],
  [],
  indexes.byProductKey,
  indexes.byUniqueIdentity,
);
assert(fullKeyStillWins.products[0]?.skuId === "SK01980", "full key match still reuses id");

console.log("sku-identity checks ok");
