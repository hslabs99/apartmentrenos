/** Normalized key fields for `data_objects` / quote object matching. */

export type DataObjectKeyFields = {
  category: string;
  productType: string;
  /** When set (legacy rows), key is category + productType + product. */
  product?: string;
};

export function normalizeDataObjectPart(value: string): string {
  return value.trim().toLowerCase();
}

export function buildDataObjectKey(fields: DataObjectKeyFields): string {
  const parts = [
    normalizeDataObjectPart(fields.category),
    normalizeDataObjectPart(fields.productType),
  ];
  const product = normalizeDataObjectPart(fields.product ?? "");
  if (product) parts.push(product);
  return parts.join("\x1e");
}

export function isDataObjectKeyUsable(fields: DataObjectKeyFields): boolean {
  if (fields.category.trim() === "") return false;
  if (fields.product?.trim()) {
    return fields.productType.trim() !== "" && fields.product.trim() !== "";
  }
  return fields.productType.trim() !== "";
}
