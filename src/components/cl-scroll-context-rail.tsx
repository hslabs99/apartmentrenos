"use client";

import {
  clScrollContextRailAccentBarClass,
  clScrollContextRailAreaLabelClass,
  clScrollContextRailAreaNameClass,
  clScrollContextRailClass,
  clScrollContextRailDividerClass,
  clScrollContextRailMoneyClass,
  clScrollContextRailSectionClass,
  clScrollContextRailSectionLabelClass,
} from "@/components/cl-checklist-layout";
import { useEffect, useState } from "react";

export type ClScrollContextArea = {
  id: string;
  name: string;
  totalLabel: string;
};

type Props = {
  areas: readonly ClScrollContextArea[];
  projectTotalLabel: string;
};

/**
 * Fixed rail for checklist: current area name + area total + project total.
 * Tracks which area section is under the reading line as the user scrolls (desktop + tablet).
 */
export function ClScrollContextRail({ areas, projectTotalLabel }: Props) {
  const [activeAreaId, setActiveAreaId] = useState<string | null>(areas[0]?.id ?? null);

  useEffect(() => {
    if (areas.length === 0) {
      setActiveAreaId(null);
      return;
    }

    const ids = new Set(areas.map((a) => a.id));
    setActiveAreaId((prev) => (prev && ids.has(prev) ? prev : areas[0]!.id));

    function resolveActiveArea() {
      const nodes = document.querySelectorAll<HTMLElement>("[data-cl-area-id]");
      if (nodes.length === 0) return;
      const marker = Math.min(160, Math.round(window.innerHeight * 0.22));
      let nextId = nodes[0]!.dataset.clAreaId ?? null;
      for (const el of nodes) {
        const id = el.dataset.clAreaId;
        if (!id || !ids.has(id)) continue;
        if (el.getBoundingClientRect().top <= marker) {
          nextId = id;
        }
      }
      if (nextId) setActiveAreaId(nextId);
    }

    resolveActiveArea();
    window.addEventListener("scroll", resolveActiveArea, { passive: true });
    window.addEventListener("resize", resolveActiveArea);
    return () => {
      window.removeEventListener("scroll", resolveActiveArea);
      window.removeEventListener("resize", resolveActiveArea);
    };
  }, [areas]);

  if (areas.length === 0) return null;

  const active =
    areas.find((a) => a.id === activeAreaId) ?? areas[0]!;

  return (
    <aside
      aria-label="Checklist scroll context"
      className={clScrollContextRailClass}
    >
      <div className={`${clScrollContextRailSectionClass} pb-2 pt-3`}>
        <span className={clScrollContextRailAreaLabelClass}>Area</span>
        <span className={clScrollContextRailAreaNameClass} title={active.name}>
          {active.name}
        </span>
        <span className={clScrollContextRailSectionLabelClass}>Area Total</span>
        <span className={clScrollContextRailMoneyClass}>{active.totalLabel}</span>
      </div>
      <div className={clScrollContextRailDividerClass} aria-hidden />
      <div className={`${clScrollContextRailSectionClass} pb-3 pt-2`}>
        <span className={clScrollContextRailAreaLabelClass}>Project Total</span>
        <span className="block text-base font-bold tabular-nums text-sf-brand dark:text-zinc-50">
          {projectTotalLabel}
        </span>
      </div>
      <div className={clScrollContextRailAccentBarClass} aria-hidden />
    </aside>
  );
}
