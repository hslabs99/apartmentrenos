/** Deep link to edit a scope in Setup → Scopes (`scopeId` = Firestore scopes doc id). */
export function setupScopeEditHref(scopeDocId: string): string {
  return `/setup?tab=scopes&scopeId=${encodeURIComponent(scopeDocId)}`;
}
