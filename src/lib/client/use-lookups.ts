"use client";

import type { LookupPublic } from "@/types/lookup";
import { useEffect, useState } from "react";

let cache: LookupPublic[] | null = null;
let inflight: Promise<LookupPublic[]> | null = null;

async function loadLookups(): Promise<LookupPublic[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        // Ensure the collection exists; idempotent.
        await fetch("/api/lookups/init", { method: "POST" });
        const res = await fetch("/api/lookups");
        const data = (await res.json()) as { lookups?: LookupPublic[] };
        if (!res.ok) return [];
        const list = data.lookups ?? [];
        cache = list;
        return list;
      } catch {
        return [];
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Shared fetch for Setup lookups; dedupes in-flight requests across components. */
export function useLookups(): { lookups: LookupPublic[]; loading: boolean } {
  const [lookups, setLookups] = useState<LookupPublic[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;
    if (cache) return;
    void loadLookups().then((list) => {
      if (!cancelled) {
        setLookups(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { lookups, loading };
}

/** Call after bulk lookup import so the next `useLookups` fetch is fresh. */
export function clearLookupsCache(): void {
  cache = null;
  inflight = null;
}

