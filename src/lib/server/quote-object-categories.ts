import type { Firestore } from "firebase-admin/firestore";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";

/** Case-insensitive match key for ObjectCategory lookup values and quote_objects.category. */
export function normalizeObjectCategoryValue(value: string): string {
  return value.trim().toLowerCase();
}

/** Distinct non-empty category labels from quote_objects (first-seen casing preserved). */
export async function collectQuoteObjectCategoryLabels(db: Firestore): Promise<string[]> {
  const snap = await db.collection("quote_objects").get();
  const byNorm = new Map<string, string>();
  for (const doc of snap.docs) {
    if (isQuoteObjectsMetaDocument(doc.id)) continue;
    const label = String(doc.data().category ?? "").trim();
    if (!label) continue;
    const norm = normalizeObjectCategoryValue(label);
    if (!byNorm.has(norm)) byNorm.set(norm, label);
  }
  return [...byNorm.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/** Normalized category keys currently used on quote_objects. */
export async function collectQuoteObjectCategoryNorms(db: Firestore): Promise<Set<string>> {
  const labels = await collectQuoteObjectCategoryLabels(db);
  return new Set(labels.map(normalizeObjectCategoryValue));
}
