import type { Firestore } from "firebase-admin/firestore";
import { dataLabourRateKey } from "@/lib/data-labour-rate-key";
import {
  DATA_OBJECTLABOURRATES_COLLECTION,
  isDataObjectlabourratesMetaDocument,
} from "@/lib/firestore/data-objectlabourrates-collection";

export async function findObjectLabourRateByKey(
  db: Firestore,
  category: string,
  productType: string,
  product: string,
  excludeDocId?: string,
): Promise<string | null> {
  const key = dataLabourRateKey(category, productType, product);
  const snap = await db.collection(DATA_OBJECTLABOURRATES_COLLECTION).get();
  for (const doc of snap.docs) {
    if (isDataObjectlabourratesMetaDocument(doc.id)) continue;
    if (excludeDocId && doc.id === excludeDocId) continue;
    const data = doc.data();
    const docKey = dataLabourRateKey(
      String(data.category ?? ""),
      String(data.productType ?? ""),
      String(data.product ?? ""),
    );
    if (docKey === key) return doc.id;
  }
  return null;
}
