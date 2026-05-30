import type { Firestore } from "firebase-admin/firestore";

import {

  DATA_SUPPLIER_DISCOUNTS_COLLECTION,

  isDataSupplierDiscountsMetaDocument,

} from "@/lib/firestore/data-supplier-discounts-collection";

import { dataSupplierDiscountKey } from "@/lib/server/data-supplier-discount-key";



export async function findSupplierDiscountBySupplier(

  db: Firestore,

  supplier: string,

  excludeDocId?: string,

): Promise<string | null> {

  const key = dataSupplierDiscountKey(supplier);

  const snap = await db.collection(DATA_SUPPLIER_DISCOUNTS_COLLECTION).get();

  for (const doc of snap.docs) {

    if (isDataSupplierDiscountsMetaDocument(doc.id)) continue;

    if (excludeDocId && doc.id === excludeDocId) continue;

    const docKey = dataSupplierDiscountKey(String(doc.data().supplier ?? ""));

    if (docKey === key) return doc.id;

  }

  return null;

}


