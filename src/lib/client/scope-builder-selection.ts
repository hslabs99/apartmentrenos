import { resolveQuoteObjectDocId } from "@/lib/client/resolve-quote-object-doc-id";
import type { DataObjectPublic } from "@/types/data-object-public";
import type { QuoteObjectPublic } from "@/types/quote-object";

/** One row selected for scope builder (from data_objects or quote_objects). */
export type ScopeBuilderRow = {
  selectionId: string;
  displayLabel: string;
  quoteObjectDocId: string;
  /** Scope question when mode is one scope per object (product type / object name). */
  perObjectQuestion: string;
};

export function scopeBuilderRowFromDataObject(
  row: DataObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): ScopeBuilderRow | null {
  const quoteObjectDocId = resolveQuoteObjectDocId(row, quoteObjects);
  if (!quoteObjectDocId) return null;
  const perObjectQuestion = row.productType.trim();
  return {
    selectionId: row.id,
    displayLabel: perObjectQuestion || row.category.trim() || row.id,
    quoteObjectDocId,
    perObjectQuestion,
  };
}

export function scopeBuilderRowFromQuoteObject(q: QuoteObjectPublic): ScopeBuilderRow {
  const perObjectQuestion = q.objectname.trim();
  return {
    selectionId: q.id,
    displayLabel: perObjectQuestion || q.category.trim() || q.id,
    quoteObjectDocId: q.id,
    perObjectQuestion,
  };
}

export function scopeBuilderRowsFromDataObjects(
  rows: DataObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
): ScopeBuilderRow[] {
  const out: ScopeBuilderRow[] = [];
  for (const row of rows) {
    const mapped = scopeBuilderRowFromDataObject(row, quoteObjects);
    if (mapped) out.push(mapped);
  }
  return out;
}

export function scopeBuilderRowsFromQuoteObjects(
  rows: QuoteObjectPublic[],
): ScopeBuilderRow[] {
  return rows.map(scopeBuilderRowFromQuoteObject);
}
