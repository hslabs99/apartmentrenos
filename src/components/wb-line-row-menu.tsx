"use client";

import { IconDotsHorizontal } from "@/components/icons/lightning-icons";
import { useEffect, useRef, useState } from "react";

type Props = {
  lineLabel: string;
  disabled?: boolean;
  onClone: () => void;
  onDelete: () => void;
};

export function WbLineRowMenu({ lineLabel, disabled = false, onClone, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-label={`Actions for ${lineLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-sf-border-strong bg-sf-surface text-sf-text-secondary shadow-sm transition hover:bg-sf-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sf-brand disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        title="Line actions"
      >
        <IconDotsHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[9rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => {
              setOpen(false);
              onClone();
            }}
          >
            Clone
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-sf-destructive hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
