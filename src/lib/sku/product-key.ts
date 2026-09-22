/** Workbook columns A–F (all six required for a complete key). Column G (UOM) is not part of the key. */
const PRODUCT_KEY_FIELDS = [
  "category",
  "productType",
  "product",
  "elevateLevel",
  "style",
  "colourOptions",
] as const;

export type ProductKeyFields = {
  category: string;
  productType: string;
  product: string;
  elevateLevel: string;
  style: string;
  colourOptions: string;
};

export function normalizeProductKeyPart(value: string): string {
  return value.trim().toLowerCase();
}

export function buildProductKey(fields: ProductKeyFields): string {
  return PRODUCT_KEY_FIELDS.map((f) => normalizeProductKeyPart(fields[f])).join("\x1e");
}

/**
 * Stable identity for merge / health: Product Type + Product name.
 * Elevate / style / colour / category may change on rebuild without minting a new skuId
 * when this pair uniquely matches one existing row.
 */
export function buildProductIdentityKey(productType: string, product: string): string {
  const type = normalizeProductKeyPart(productType);
  const name = normalizeProductKeyPart(product);
  if (!type || !name) return "";
  return `${type}\x1f${name}`;
}

export function isProductKeyComplete(fields: ProductKeyFields): boolean {
  return PRODUCT_KEY_FIELDS.every((f) => fields[f].trim() !== "");
}

export function missingProductKeyLabels(fields: ProductKeyFields): string[] {
  const labels: Record<keyof ProductKeyFields, string> = {
    category: "Category",
    productType: "Product Type",
    product: "Product",
    elevateLevel: "Elevate Level",
    style: "Style",
    colourOptions: "Colour Options",
  };
  return PRODUCT_KEY_FIELDS.filter((f) => !fields[f].trim()).map((f) => labels[f]);
}

export function formatSkuId(sequence: number): string {
  return `SK${String(sequence).padStart(5, "0")}`;
}
