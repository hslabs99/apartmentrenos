"use client";

import { IconChevronDown, IconChevronRight } from "@/components/icons/lightning-icons";
import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "apartmentrenos.wbCompressZeroMeasure.";

function readCompressed(projectDocId: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + projectDocId) === "1";
  } catch {
    return false;
  }
}

function writeCompressed(projectDocId: string, compressed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + projectDocId, compressed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

export function useWbCompressZeroMeasure(projectDocId: string | null): {
  compressed: boolean;
  toggle: () => void;
} {
  const [compressed, setCompressed] = useState(false);

  useEffect(() => {
    if (!projectDocId) {
      setCompressed(false);
      return;
    }
    setCompressed(readCompressed(projectDocId));
  }, [projectDocId]);

  const toggle = useCallback(() => {
    setCompressed((prev) => {
      const next = !prev;
      if (projectDocId) writeCompressed(projectDocId, next);
      return next;
    });
  }, [projectDocId]);

  return { compressed, toggle };
}

/** Project-level workbench toggle: hide measure-0 lines, or show every line. */
export function WbCompressToggle({
  compressed,
  onToggle,
}: {
  compressed: boolean;
  onToggle: () => void;
}) {
  const toggleLabel = compressed ? "Show All" : "Compress";
  return (
    <button
      type="button"
      aria-pressed={compressed}
      title={
        compressed
          ? "Show lines with measure 0"
          : "Hide lines with measure 0"
      }
      aria-label={
        compressed
          ? "Show all workbench lines"
          : "Compress workbench: hide lines with measure 0"
      }
      onClick={onToggle}
      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-sf-border bg-sf-surface px-3 py-1.5 text-xs font-medium text-sf-brand shadow-sm transition hover:border-sf-border-strong dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
    >
      {compressed ? (
        <IconChevronRight className="h-3.5 w-3.5" />
      ) : (
        <IconChevronDown className="h-3.5 w-3.5" />
      )}
      {toggleLabel}
    </button>
  );
}
