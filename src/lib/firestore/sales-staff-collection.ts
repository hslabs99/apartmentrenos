/**
 * Firestore has no separate "create collection" API — the `sales_staff`
 * collection appears once this document exists. Hidden from CRUD lists.
 */
export const SALES_STAFF_COLLECTION_META_ID = "_collection_meta";

export function isSalesStaffMetaDocument(docId: string): boolean {
  return docId === SALES_STAFF_COLLECTION_META_ID;
}
