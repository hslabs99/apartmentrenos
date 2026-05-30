import type { DataObjectPublic } from "@/types/data-object-public";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

export type DataObjectScopeLink = {
  /** Firestore `scopes` document id (use in URLs — not `scopeid` or question text). */
  scopeDocId: string;
  question: string;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Quote object doc ids linked to this data object row. */
export function quoteObjectDocIdsForDataObject(
  row: DataObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): Set<string> {
  const ids = new Set<string>();
  const direct = row.quoteObjectDocId?.trim();
  if (direct) ids.add(direct);
  if (row.objectid != null) {
    const hit = quoteObjects.find((q) => q.objectid === row.objectid);
    if (hit?.id) ids.add(hit.id);
  }
  return ids;
}

function scopeLinksForRow(
  scopes: ScopePublic[],
  quoteIds: Set<string>,
  productTypeKey: string,
): DataObjectScopeLink[] {
  const out: DataObjectScopeLink[] = [];
  const seenDocIds = new Set<string>();

  for (const scope of scopes) {
    if (scope.kind === "header" || scope.kind === "footer") continue;
    const question = scope.question.trim();
    if (!question) continue;
    if (seenDocIds.has(scope.id)) continue;

    let linked = false;
    for (const answer of scope.answers) {
      if (quoteIds.size > 0) {
        for (const id of answer.attachedQuoteObjectIds ?? []) {
          if (quoteIds.has(id.trim())) {
            linked = true;
            break;
          }
        }
      }
      if (!linked && productTypeKey) {
        for (const name of answer.attachedObjectNames ?? []) {
          if (normalizeKey(name) === productTypeKey) {
            linked = true;
            break;
          }
        }
      }
      if (linked) break;
    }

    if (linked) {
      seenDocIds.add(scope.id);
      out.push({ scopeDocId: scope.id, question });
    }
  }

  return out.sort((a, b) => a.question.localeCompare(b.question, undefined, { sensitivity: "base" }));
}

/**
 * Scopes that reference this data object (any answer), with stable doc ids for navigation.
 */
export function scopeLinksForDataObject(
  scopes: ScopePublic[],
  quoteObjects: QuoteObjectPublic[],
  row: DataObjectPublic,
): DataObjectScopeLink[] {
  const quoteIds = quoteObjectDocIdsForDataObject(row, quoteObjects);
  const productTypeKey = normalizeKey(row.productType);
  return scopeLinksForRow(scopes, quoteIds, productTypeKey);
}

/** Scopes that reference this quote object (any answer). */
export function scopeLinksForQuoteObject(
  scopes: ScopePublic[],
  quoteObject: QuoteObjectPublic,
): DataObjectScopeLink[] {
  const quoteIds = new Set<string>([quoteObject.id.trim()]);
  const productTypeKey = normalizeKey(quoteObject.objectname);
  return scopeLinksForRow(scopes, quoteIds, productTypeKey);
}

/** @deprecated Use {@link scopeLinksForDataObject} for scope doc ids. */
export function scopeQuestionsForDataObject(
  scopes: ScopePublic[],
  quoteObjects: QuoteObjectPublic[],
  row: DataObjectPublic,
): string[] {
  return scopeLinksForDataObject(scopes, quoteObjects, row).map((l) => l.question);
}
