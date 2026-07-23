"use client";

import {
  clProjectHdrIconBtnClass,
  clProjectHdrIconGlyphClass,
} from "@/components/cl-checklist-layout";
import { IconDotsHorizontal } from "@/components/icons/lightning-icons";
import { useEffect, useRef, useState } from "react";

type Props = {
  projectLabel: string;
  disabled?: boolean;
  addAreaDisabled?: boolean;
  onAddArea: () => void;
};

const menuItemClass =
  "block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800";

/** Checklist project header ⋮ — Add area (and room for more actions later). */
export function ClProjectHeaderMenu({
  projectLabel,
  disabled = false,
  addAreaDisabled = false,
  onAddArea,
}: Props) {
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
        aria-label={`Project actions for ${projectLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clProjectHdrIconBtnClass}
        title="Project actions"
      >
        <IconDotsHorizontal className={clProjectHdrIconGlyphClass} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled || addAreaDisabled}
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              onAddArea();
            }}
          >
            Add area…
          </button>
        </div>
      ) : null}
    </div>
  );
}
