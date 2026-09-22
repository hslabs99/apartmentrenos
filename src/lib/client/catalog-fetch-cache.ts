import { CHECKLIST_FAST_BOOT } from "@/lib/client/checklist-fast-boot";

export type CatalogJsonGetResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

type CacheEntry = CatalogJsonGetResult<unknown>;

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function catalogEditorPath(pathname: string): boolean {
  return (
    pathname === "/setup" ||
    pathname.startsWith("/setup/") ||
    pathname === "/import-master-prices" ||
    pathname.startsWith("/import-master-prices/") ||
    pathname === "/system" ||
    pathname.startsWith("/system/") ||
    pathname === "/templates" ||
    pathname.startsWith("/templates/")
  );
}

/** Drop in-memory catalog payloads so the next Check List / workbench boot refetches. */
export function clearCatalogCache(): void {
  cache.clear();
  inflight.clear();
}

/**
 * After leaving Setup / Import / System / Templates, drop the catalog cache so
 * checklist does not keep stale SKUs, quote objects, or rates.
 */
export function clearCatalogCacheAfterLeavingEditor(pathname: string): () => void {
  if (!catalogEditorPath(pathname)) return () => {};
  return () => {
    clearCatalogCache();
  };
}

/**
 * GET + JSON with optional session cache (see `CHECKLIST_FAST_BOOT`).
 * Failed responses are never cached.
 * Pass `signal` when the caller may unmount (e.g. leaving Check List); abortable
 * requests skip the shared in-flight map so one page leaving does not cancel another.
 */
export async function catalogJsonGet<T>(
  url: string,
  init?: { signal?: AbortSignal },
): Promise<CatalogJsonGetResult<T>> {
  if (CHECKLIST_FAST_BOOT) {
    const hit = cache.get(url);
    if (hit) return hit as CatalogJsonGetResult<T>;
  }

  const signal = init?.signal;
  if (signal) {
    const res = await fetch(url, { signal });
    const data = (await res.json()) as T;
    const entry: CacheEntry = { ok: res.ok, status: res.status, data };
    if (CHECKLIST_FAST_BOOT && res.ok) cache.set(url, entry);
    return entry as CatalogJsonGetResult<T>;
  }

  let pending = inflight.get(url);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(url);
      const data = (await res.json()) as T;
      const entry: CacheEntry = { ok: res.ok, status: res.status, data };
      if (CHECKLIST_FAST_BOOT && res.ok) cache.set(url, entry);
      return entry;
    })().finally(() => {
      inflight.delete(url);
    });
    inflight.set(url, pending);
  }

  return (await pending) as CatalogJsonGetResult<T>;
}
