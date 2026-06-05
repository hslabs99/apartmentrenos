"use client";

import {
  checklistAutoPopulateMeasurePatch,
  checklistInheritedMeasureForRow,
  checklistMeasureFieldDisplayString,
  checklistMeasureFieldTooltip,
  isChecklistAutoPopulateMeasureApplicable,
  measuresClose,
} from "@/lib/checklist-effective-measure";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { useCallback, useEffect, useState } from "react";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  line: ProjectAreaObjectPublic;
  quoteObject: QuoteObjectPublic | undefined;
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  measureKey: string;
  inputClassName: string;
  disabled?: boolean;
  onPatch: (custommeasure: number | null) => void;
  onValidationError: (message: string) => void;
};

export function ChecklistMeasureInput({
  line,
  quoteObject,
  pa,
  project,
  measureKey,
  inputClassName,
  disabled = false,
  onPatch,
  onValidationError,
}: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const displayValue = checklistMeasureFieldDisplayString(line, quoteObject, pa, project);
  const measureTooltip = checklistMeasureFieldTooltip(line, quoteObject, pa, project);
  const canAutoPopulate = isChecklistAutoPopulateMeasureApplicable(quoteObject, pa, project);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const handleAutoPopulate = useCallback(() => {
    const patch = checklistAutoPopulateMeasurePatch(quoteObject, pa, project);
    if (!patch) return;
    onPatch(patch.custommeasure);
    setRefreshToken((t) => t + 1);
    setMenu(null);
  }, [quoteObject, pa, project, onPatch]);

  return (
    <>
      <input
        key={`${measureKey}-${refreshToken}`}
        type="text"
        inputMode="decimal"
        className={inputClassName}
        defaultValue={displayValue}
        disabled={disabled}
        title={measureTooltip}
        onContextMenu={(e) => {
          if (disabled || !canAutoPopulate) return;
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={(e) => {
          const el = e.target as HTMLInputElement;
          const raw = el.value.trim();
          if (raw !== "" && parseOptionalNumber(raw) === null) {
            onValidationError("Measure must be a valid number (or empty).");
            el.value = checklistMeasureFieldDisplayString(line, quoteObject, pa, project);
            return;
          }
          const next = parseOptionalNumber(raw);
          const stored = line.custommeasure ?? null;
          const inherited = checklistInheritedMeasureForRow(line, quoteObject, pa, project);
          if (raw === "" || next === null) {
            if (stored !== null) {
              onPatch(null);
            } else {
              el.value = checklistMeasureFieldDisplayString(line, quoteObject, pa, project);
            }
            return;
          }
          if (stored !== null) {
            if (next !== stored) onPatch(next);
            return;
          }
          if (inherited != null && measuresClose(next, inherited)) return;
          onPatch(next);
        }}
      />
      {menu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default border-0 bg-transparent p-0"
            aria-label="Close measure menu"
            onClick={() => setMenu(null)}
          />
          <div
            className="fixed z-50 min-w-[14rem] overflow-hidden rounded-md border border-sf-border-strong bg-sf-surface py-1 text-left shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-xs text-sf-text hover:bg-sf-page dark:text-zinc-100 dark:hover:bg-zinc-800"
              onClick={handleAutoPopulate}
            >
              Auto populate default measure
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
