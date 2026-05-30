import type { DocumentData } from "firebase-admin/firestore";

/** Read `product` with fallback to legacy Firestore `description`. */
export function parseProductFromDoc(data: DocumentData | Record<string, unknown>): string {
  const product = data.product;
  if (product != null && String(product).trim() !== "") {
    return String(product).trim();
  }
  return String(data.description ?? "").trim();
}
