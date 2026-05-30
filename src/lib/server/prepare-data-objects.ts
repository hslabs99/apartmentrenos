import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureDataObjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_OBJECTS_COLLECTION,
  isDataObjectsMetaDocument,
} from "@/lib/firestore/data-objects-collection";
import {
  DATA_SKUS_COLLECTION,
  isDataSkusMetaDocument,
} from "@/lib/firestore/data-skus-collection";
import {
  buildDataObjectKey,
  isDataObjectKeyUsable,
  type DataObjectKeyFields,
} from "@/lib/data-object-key";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";
import {
  canonicalDataObjectFields,
  dataObjectKeyFromFields,
  dataObjectToFirestore,
} from "@/lib/server/data-object-doc";

export type PrepareDataObjectsResult = {
  distinctFromSkus: number;
  created: number;
  skippedExisting: number;
  skippedIncomplete: number;
};

type DistinctRow = DataObjectKeyFields & { uom: string };

export async function runPrepareDataObjects(
  db: Firestore,
): Promise<PrepareDataObjectsResult> {
  await ensureDataObjectsBootstrap(db);

  const skuSnap = await db.collection(DATA_SKUS_COLLECTION).get();
  const distinctByKey = new Map<string, DistinctRow>();

  for (const doc of skuSnap.docs) {
    if (isDataSkusMetaDocument(doc.id)) continue;
    const data = doc.data();
    const fields: DataObjectKeyFields = {
      category: String(data.category ?? ""),
      productType: String(data.productType ?? ""),
    };
    if (!isDataObjectKeyUsable(fields)) continue;
    const canon = canonicalDataObjectFields(fields);
    const key = buildDataObjectKey(canon);
    if (distinctByKey.has(key)) continue;
    distinctByKey.set(key, {
      ...canon,
      uom: mapSkuUomToQuoteUom(String(data.uom ?? "")),
    });
  }

  const existingSnap = await db.collection(DATA_OBJECTS_COLLECTION).get();
  const existingKeys = new Set<string>();
  for (const doc of existingSnap.docs) {
    if (isDataObjectsMetaDocument(doc.id)) continue;
    const data = doc.data();
    const key = dataObjectKeyFromFields({
      category: String(data.category ?? ""),
      productType: String(data.productType ?? ""),
    });
    if (key) existingKeys.add(key);
  }

  let created = 0;
  let skippedExisting = 0;
  let unusableCount = 0;
  for (const doc of skuSnap.docs) {
    if (isDataSkusMetaDocument(doc.id)) continue;
    const data = doc.data();
    const fields: DataObjectKeyFields = {
      category: String(data.category ?? ""),
      productType: String(data.productType ?? ""),
    };
    if (!isDataObjectKeyUsable(fields)) unusableCount++;
  }

  for (const row of distinctByKey.values()) {
    const key = buildDataObjectKey(row);
    if (existingKeys.has(key)) {
      skippedExisting++;
      continue;
    }
    const ref = db.collection(DATA_OBJECTS_COLLECTION).doc();
    await ref.set({
      ...dataObjectToFirestore(row, row.uom),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    existingKeys.add(key);
    created++;
  }

  return {
    distinctFromSkus: distinctByKey.size,
    created,
    skippedExisting,
    skippedIncomplete: unusableCount,
  };
}
