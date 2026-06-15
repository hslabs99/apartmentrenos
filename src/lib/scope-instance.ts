/** Normalize scope instance id for comparison (primary instance = empty string). */
export function normalizeScopeInstanceId(id: string | null | undefined): string {
  return id?.trim() ?? "";
}

export function matchesScopeInstance(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeScopeInstanceId(a) === normalizeScopeInstanceId(b);
}

/** Unique scope instances on a project area for one Setup → Scopes doc id. Primary (null) is always first. */
export function collectScopeInstanceIds(
  scopeDocId: string,
  scopeAnswers: ReadonlyArray<{ scopeDocId: string; scopeInstanceId?: string | null }> | undefined,
  rows: ReadonlyArray<{ linesource?: string; scopeDocId?: string | null; scopeInstanceId?: string | null }>,
): (string | null)[] {
  const seen = new Set<string>();
  const order: (string | null)[] = [];

  const add = (id: string | null | undefined) => {
    const key = normalizeScopeInstanceId(id);
    if (seen.has(key)) return;
    seen.add(key);
    order.push(key ? key : null);
  };

  add(null);
  for (const entry of scopeAnswers ?? []) {
    if (entry.scopeDocId === scopeDocId) add(entry.scopeInstanceId);
  }
  for (const row of rows) {
    if (row.linesource === "scope" && row.scopeDocId === scopeDocId) {
      add(row.scopeInstanceId);
    }
  }
  return order;
}

export function scopeAnswerSavingKey(
  scopeDocId: string,
  scopeInstanceId?: string | null,
): string {
  const inst = normalizeScopeInstanceId(scopeInstanceId);
  return inst ? `${scopeDocId}:${inst}` : scopeDocId;
}
