"use client";

import type { PriceLevelPublic } from "@/types/price-level";
import { useEffect, useState } from "react";

let cache: PriceLevelPublic[] | null = null;
let inflight: Promise<PriceLevelPublic[]> | null = null;

async function loadPriceLevels(): Promise<PriceLevelPublic[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch("/api/price-levels");
        const data = (await res.json()) as { priceLevels?: PriceLevelPublic[] };
        if (!res.ok) return [];
        const list = data.priceLevels ?? [];
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

/** Shared fetch for System price levels; dedupes in-flight requests across components. */
export function usePriceLevels(): { levels: PriceLevelPublic[]; loading: boolean } {
  const [levels, setLevels] = useState<PriceLevelPublic[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;
    if (cache) {
      return;
    }
    void loadPriceLevels().then((list) => {
      if (!cancelled) {
        setLevels(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { levels, loading };
}
