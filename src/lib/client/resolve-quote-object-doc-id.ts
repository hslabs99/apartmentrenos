import { quoteObjectDocIdsForDataObject } from "@/lib/client/scope-questions-for-data-object";
import type { DataObjectPublic } from "@/types/data-object-public";
import type { QuoteObjectPublic } from "@/types/quote-object";

/** Primary quote object Firestore doc id for a data object row. */
export function resolveQuoteObjectDocId(
  row: DataObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): string | null {
  const ids = quoteObjectDocIdsForDataObject(row, quoteObjects);
  const first = [...ids][0];
  return first?.trim() ? first.trim() : null;
}
