"use client";

import { AreasPanel } from "@/components/areas-panel";
import { PriceLevelsPanel } from "@/components/price-levels-panel";
import { QuoteObjectsPanel } from "@/components/quote-objects-panel";
import { ScopesPanel } from "@/components/scopes-panel";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type SetupTab = "quote-objects" | "areas" | "price-levels" | "scopes";

const SETUP_TABS: SetupTab[] = ["quote-objects", "areas", "price-levels", "scopes"];

function tabFromParam(value: string | null): SetupTab {
  if (value && SETUP_TABS.includes(value as SetupTab)) return value as SetupTab;
  return "quote-objects";
}

export function SetupPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopeIdParam = searchParams.get("scopeId")?.trim() || null;

  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<SetupTab>(() => tabFromParam(tabParam));

  useEffect(() => {
    setTab(tabFromParam(tabParam));
  }, [tabParam]);

  const clearScopeIdFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("scopeId");
    if (tab !== "scopes") params.set("tab", "scopes");
    const q = params.toString();
    router.replace(q ? `/setup?${q}` : "/setup");
  }, [router, searchParams, tab]);

  const initialScopeDocId = useMemo(
    () => (tab === "scopes" ? scopeIdParam : null),
    [tab, scopeIdParam],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
          Projects Setup
        </h1>
        <div
          className={sfTabStripClass}
          role="tablist"
          aria-label="Projects Setup sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "quote-objects"}
            onClick={() => setTab("quote-objects")}
            className={sfUnderlineTabClass(tab === "quote-objects")}
          >
            Quote Objects
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "areas"}
            onClick={() => setTab("areas")}
            className={sfUnderlineTabClass(tab === "areas")}
          >
            Areas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "price-levels"}
            onClick={() => setTab("price-levels")}
            className={sfUnderlineTabClass(tab === "price-levels")}
          >
            Price Levels
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "scopes"}
            onClick={() => setTab("scopes")}
            className={sfUnderlineTabClass(tab === "scopes")}
          >
            Scopes
          </button>
        </div>
      </div>

      {tab === "quote-objects" ? <QuoteObjectsPanel /> : null}
      {tab === "areas" ? <AreasPanel /> : null}
      {tab === "price-levels" ? <PriceLevelsPanel /> : null}
      {tab === "scopes" ? (
        <ScopesPanel
          initialScopeDocId={initialScopeDocId}
          onConsumedInitialScopeId={clearScopeIdFromUrl}
        />
      ) : null}
    </div>
  );
}
