"use client";

import { clActionBtnClass } from "@/components/cl-checklist-layout";
import { useEffect, useRef, useState } from "react";

type Props = {
  areaLabel: string;
  disabled?: boolean;
  removeDisabled?: boolean;
  onAddScope: () => void;
  onAddObject: () => void;
  onRemoveArea: () => void;
};

const menuItemClass =
  "block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800";

const menuItemDangerClass =
  "block w-full px-3 py-2 text-left text-sm font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-200 dark:hover:bg-red-950/40";

export function ClAreaHeaderMenu({
  areaLabel,
  disabled = false,
  removeDisabled = false,
  onAddScope,
  onAddObject,
  onRemoveArea,
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
        aria-label={`Area actions for ${areaLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clActionBtnClass}
        title="Area actions"
      >
        …
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              onAddScope();
            }}
          >
            Add scope…
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            className={menuItemClass}
            onClick={() => {
              setOpen(false);
              onAddObject();
            }}
          >
            Add object…
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={disabled || removeDisabled}
            className={menuItemDangerClass}
            onClick={() => {
              setOpen(false);
              onRemoveArea();
            }}
          >
            Remove area
          </button>
        </div>
      ) : null}
    </div>
  );
}
