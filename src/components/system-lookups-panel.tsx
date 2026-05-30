"use client";

import { LookupsColoursPanel } from "@/components/lookups-colours-panel";
import { LookupsPanel } from "@/components/lookups-panel";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { useState } from "react";

type LookupsSubTab = "general" | "colours";

export function SystemLookupsPanel() {
  const [subTab, setSubTab] = useState<LookupsSubTab>("general");

  return (
    <div className="space-y-4">
      <div
        className={sfTabStripClass}
        role="tablist"
        aria-label="System lookups sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "general"}
          className={sfUnderlineTabClass(subTab === "general")}
          onClick={() => setSubTab("general")}
        >
          General lookups
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "colours"}
          className={sfUnderlineTabClass(subTab === "colours")}
          onClick={() => setSubTab("colours")}
        >
          Colours lookups
        </button>
      </div>

      {subTab === "general" ? <LookupsPanel /> : null}
      {subTab === "colours" ? <LookupsColoursPanel /> : null}
    </div>
  );
}
