"use client";

import { clActionBtnClass } from "@/components/cl-checklist-layout";
import { useEffect, useRef, useState } from "react";

const menuItemClass =
  "block w-full px-3 py-2 text-left text-sm font-medium text-sf-text hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800";

type Props = {
  scopeLabel: string;
  disabled?: boolean;
  onAddObject: () => void;
  onClone?: () => void;
};

export function ClScopeActionsMenu({
  scopeLabel,
  disabled = false,
  onAddObject,
  onClone,
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
        aria-label={`Scope actions for ${scopeLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={clActionBtnClass}
        title="Scope actions"
      >
        …
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
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
          {onClone ? (
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className={menuItemClass}
              onClick={() => {
                setOpen(false);
                onClone();
              }}
            >
              Clone
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
