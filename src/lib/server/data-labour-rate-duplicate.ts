import type { Firestore } from "firebase-admin/firestore";
import {
  DATA_LABOURRATES_COLLECTION,
  isDataLabourratesMetaDocument,
} from "@/lib/firestore/data-labourrates-collection";
import { dataLabourRateKey } from "@/lib/data-labour-rate-key";

export async function findLabourRateByKey(
  db: Firestore,
  category: string,
  productType: string,
  product: string,
  excludeDocId?: string,
): Promise<string | null> {
  const key = dataLabourRateKey(category, productType, product);
  const snap = await db.collection(DATA_LABOURRATES_COLLECTION).get();
  for (const doc of snap.docs) {
    if (isDataLabourratesMetaDocument(doc.id)) continue;
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
