"use client";

import {
  clRowIconGlyphClass,
  clScopeCollapseBtnClass,
} from "@/components/cl-checklist-layout";
import { IconChevronDown, IconChevronRight } from "@/components/icons/lightning-icons";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "apartmentrenos.clScopeBodyCollapsed.";

export function clScopeBodyExpandKey(
  projectAreaId: string,
  scopeId: string,
  scopeInstanceId: string | null | undefined,
): string {
  return `${projectAreaId}:${scopeId}:${scopeInstanceId ?? "primary"}`;
}

export function clScopeSkuBodyDomId(expandKey: string): string {
  return `cl-scope-sku-${expandKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function clScopeLineHasPositiveQuantity(
  line: Pick<ProjectAreaObjectPublic, "custommeasure">,
  effectiveMeasure?: number | null,
): boolean {
  const explicit = line.custommeasure;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit > 0;
  return typeof effectiveMeasure === "number" && Number.isFinite(effectiveMeasure) && effectiveMeasure > 0;
}

function readCollapsedKeys(projectDocId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + projectDocId);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeCollapsedKeys(projectDocId: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + projectDocId, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useClScopeBodyExpanded(projectDocId: string | null): {
  isExpanded: (key: string) => boolean;
  toggle: (key: string) => void;
} {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!projectDocId) {
      setCollapsedKeys(new Set());
      return;
    }
    setCollapsedKeys(readCollapsedKeys(projectDocId));
  }, [projectDocId]);

  const isExpanded = useCallback(
    (key: string) => !collapsedKeys.has(key),
    [collapsedKeys],
  );

  const toggle = useCallback(
    (key: string) => {
      setCollapsedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        if (projectDocId) writeCollapsedKeys(projectDocId, next);
        return next;
      });
    },
    [projectDocId],
  );

  return { isExpanded, toggle };
}

export function ClScopeCollapseButton({
  expanded,
  onToggle,
  controlsId,
  label,
}: {
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
  label: string;
}) {
  const toggleLabel = expanded ? "Compress" : "Show All";
  return (
    <button
      type="button"
      className={clScopeCollapseBtnClass}
      aria-expanded={expanded}
      aria-controls={controlsId}
      title={toggleLabel}
      aria-label={`${toggleLabel} for ${label}`}
      onClick={onToggle}
    >
      {expanded ? (
        <IconChevronDown className={clRowIconGlyphClass} />
      ) : (
        <IconChevronRight className={clRowIconGlyphClass} />
      )}
      {toggleLabel}
    </button>
  );
}
