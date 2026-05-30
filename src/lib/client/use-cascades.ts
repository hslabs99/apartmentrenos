"use client";

import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import { useEffect, useState } from "react";

let cache: CascadeRow[] | null = null;
let inflight: Promise<CascadeRow[]> | null = null;

async function loadCascades(): Promise<CascadeRow[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch("/api/cascades");
        const data = (await res.json()) as {
          items?: { level: string; style: string; colour: string }[];
        };
        if (!res.ok) return [];
        const list = (data.items ?? []).map((r) => ({
          level: r.level,
          style: r.style,
          colour: r.colour,
        }));
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

/** Shared fetch for cascade restrictions; dedupes in-flight requests across components. */
export function useCascades(): { cascades: CascadeRow[]; loading: boolean } {
  const [cascades, setCascades] = useState<CascadeRow[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;
    if (cache) {
      return;
    }
    void loadCascades().then((list) => {
      if (!cancelled) {
        setCascades(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { cascades, loading };
}
