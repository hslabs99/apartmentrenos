/** Normalized pair for `data_objects` / quote object matching (category + productType). */

export type DataObjectKeyFields = {
  category: string;
  productType: string;
  /** Legacy field — not part of the object key; kept for API shape only. */
  product?: string;
};

export function normalizeDataObjectPart(value: string): string {
  return value.trim().toLowerCase();
}

export function buildDataObjectKey(fields: DataObjectKeyFields): string {
  return [
    normalizeDataObjectPart(fields.category),
    normalizeDataObjectPart(fields.productType),
  ].join("\x1e");
}

export function isDataObjectKeyUsable(fields: DataObjectKeyFields): boolean {
  return fields.category.trim() !== "" && fields.productType.trim() !== "";
}
