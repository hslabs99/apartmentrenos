import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import { buildDataObjectKey, type DataObjectKeyFields } from "@/lib/data-object-key";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";
import type { DataObjectPublic } from "@/types/data-object-public";

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export function canonicalDataObjectFields(fields: DataObjectKeyFields): DataObjectKeyFields {
  return {
    category: fields.category.trim(),
    productType: fields.productType.trim(),
    product: fields.product?.trim() ?? "",
  };
}

export function dataObjectKeyFromFields(fields: DataObjectKeyFields): string {
  return buildDataObjectKey(canonicalDataObjectFields(fields));
}

export function dataObjectDocToPublic(id: string, data: DocumentData): DataObjectPublic {
  const category = parseText(data.category);
  const productType = parseText(data.productType);
  const product = parseText(data.product);
  const objectKey = dataObjectKeyFromFields({ category, productType, product });
  return {
    id,
    category,
    productType,
    product,
    uom: mapSkuUomToQuoteUom(parseText(data.uom)),
    objectKey,
    quoteObjectDocId: parseText(data.quoteObjectDocId) || null,
    objectid: numOrNull(data.objectid),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}

export function dataObjectToFirestore(
  fields: DataObjectKeyFields,
  uom: string,
  extra?: { quoteObjectDocId?: string | null; objectid?: number | null },
): Record<string, unknown> {
  const canon = canonicalDataObjectFields(fields);
  return {
    category: canon.category,
    productType: canon.productType,
    product: canon.product ?? "",
    uom: mapSkuUomToQuoteUom(uom),
    objectKey: dataObjectKeyFromFields(canon),
    quoteObjectDocId: extra?.quoteObjectDocId ?? null,
    objectid: extra?.objectid ?? null,
  };
}
