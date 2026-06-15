"use client";

import {
  buildColourLookupIndex,
  type ColourLookupIndex,
} from "@/lib/sku/colour-lookup-index";
import type { LookupColourPublic } from "@/types/lookup-colour-public";
import { useEffect, useMemo, useState } from "react";

let cache: LookupColourPublic[] | null = null;
let inflight: Promise<LookupColourPublic[]> | null = null;

async function loadLookupsColours(): Promise<LookupColourPublic[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      try {
        await fetch("/api/lookups-colours/init", { method: "POST" });
        const res = await fetch("/api/lookups-colours");
        const data = (await res.json()) as { items?: LookupColourPublic[] };
        if (!res.ok) return [];
        const list = data.items ?? [];
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

/** Shared fetch for colour lookups; dedupes in-flight requests across components. */
export function useLookupsColours(): {
  colourLookups: LookupColourPublic[];
  colourLookupIndex: ColourLookupIndex;
  loading: boolean;
} {
  const [colourLookups, setColourLookups] = useState<LookupColourPublic[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let cancelled = false;
    if (cache) return;
    void loadLookupsColours().then((list) => {
      if (!cancelled) {
        setColourLookups(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const colourLookupIndex = useMemo(
    () =>
      buildColourLookupIndex(
        colourLookups.map((r) => ({
          colourClass: r.colourClass,
          descriptor: r.descriptor,
        })),
      ),
    [colourLookups],
  );

  return { colourLookups, colourLookupIndex, loading };
}

/** Call after Import Lists so the next fetch picks up new colour rows. */
export function clearLookupsColoursCache(): void {
  cache = null;
  inflight = null;
}
