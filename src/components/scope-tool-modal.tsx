"use client";

import { ModalFrame } from "@/components/modal-frame";
import { clActionBtnClass } from "@/components/cl-checklist-layout";
import {
  cmRectToM2,
  cmWallToM2,
  formatScopeToolM2,
  resolveScopeLineMeasureTool,
  roundScopeToolM2,
  scopeToolTypeLabel,
  type ScopeToolType,
} from "@/lib/scope-tools";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import { useEffect, useMemo, useState } from "react";

const inputClass =
  "min-h-11 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2 text-base tabular-nums dark:border-zinc-600 dark:bg-zinc-950";

function parseCmInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function IconCalculator({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3h10.5A2.25 2.25 0 0119.5 5.25v13.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V5.25A2.25 2.25 0 016.75 3z"
      />
      <path strokeLinecap="round" d="M8.25 7.5h7.5M8.25 12h1.5M12 12h1.5M15.75 12h1.5M8.25 15.75h1.5M12 15.75h1.5M15.75 15.75h1.5" />
    </svg>
  );
}

function useBenchtopM2Result(lengthCm: string, widthCm: string): number | null {
  return useMemo(() => {
    const length = parseCmInput(lengthCm);
    const width = parseCmInput(widthCm);
    if (length == null || width == null) return null;
    const v = cmRectToM2(length, width);
    return Number.isFinite(v) ? v : null;
  }, [lengthCm, widthCm]);
}

function useWallM2Result(width1Cm: string, width2Cm: string, studHeightCm: string): number | null {
  return useMemo(() => {
    const w1 = parseCmInput(width1Cm);
    const w2 = parseCmInput(width2Cm);
    const h = parseCmInput(studHeightCm);
    if (w1 == null || w2 == null || h == null) return null;
    const v = cmWallToM2(w1, w2, h);
    return Number.isFinite(v) ? v : null;
  }, [width1Cm, width2Cm, studHeightCm]);
}

function BenchtopM2CalculatorBody({ onResult }: { onResult: (n: number | null) => void }) {
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const result = useBenchtopM2Result(lengthCm, widthCm);

  useEffect(() => {
    onResult(result);
  }, [result, onResult]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
        Enter length and width in centimetres. Result is benchtop area in square metres.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Length (cm)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={lengthCm}
            onChange={(e) => setLengthCm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 240"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Width (cm)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={widthCm}
            onChange={(e) => setWidthCm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 60"
          />
        </label>
      </div>
      <div className="rounded-lg border border-sf-border bg-sf-page/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
        <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
          Area
        </span>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-sf-text dark:text-zinc-50">
          {result == null ? "—" : formatScopeToolM2(result)}
        </p>
      </div>
    </div>
  );
}

function WallM2CalculatorBody({ onResult }: { onResult: (n: number | null) => void }) {
  const [width1Cm, setWidth1Cm] = useState("");
  const [width2Cm, setWidth2Cm] = useState("");
  const [studHeightCm, setStudHeightCm] = useState("");
  const result = useWallM2Result(width1Cm, width2Cm, studHeightCm);

  useEffect(() => {
    onResult(result);
  }, [result, onResult]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
        Enter both wall widths and stud height in centimetres. Area = (width 1 + width 2) × stud
        height.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Width 1 (cm)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={width1Cm}
            onChange={(e) => setWidth1Cm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 300"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Width 2 (cm)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={width2Cm}
            onChange={(e) => setWidth2Cm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 120"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Stud height (cm)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={studHeightCm}
            onChange={(e) => setStudHeightCm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 240"
          />
        </label>
      </div>
      <div className="rounded-lg border border-sf-border bg-sf-page/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
        <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
          Wall area
        </span>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-sf-text dark:text-zinc-50">
          {result == null ? "—" : formatScopeToolM2(result)}
        </p>
      </div>
    </div>
  );
}

type ScopeToolModalProps = {
  toolType: ScopeToolType;
  onClose: () => void;
  /** When set, user can apply the calculated m² to the checklist measure field. */
  onApplyM2?: (m2: number) => void;
};

export function ScopeToolModal({ toolType, onClose, onApplyM2 }: ScopeToolModalProps) {
  const [resultM2, setResultM2] = useState<number | null>(null);
  const label = scopeToolTypeLabel(toolType);

  function handleApply() {
    if (resultM2 == null || !onApplyM2) return;
    onApplyM2(roundScopeToolM2(resultM2));
    onClose();
  }

  return (
    <ModalFrame
      title={label}
      description={
        onApplyM2
          ? "Enter measurements, then apply the result to this line’s measure field."
          : "Enter measurements manually — values are not saved to the checklist."
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
          >
            Close
          </button>
          {onApplyM2 ? (
            <button
              type="button"
              disabled={resultM2 == null}
              onClick={handleApply}
              className="rounded-lg bg-sf-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-[#0176d3]"
            >
              Apply to measure
            </button>
          ) : null}
        </>
      }
    >
      {toolType === "BenchtopM2" ? (
        <BenchtopM2CalculatorBody onResult={setResultM2} />
      ) : (
        <WallM2CalculatorBody onResult={setResultM2} />
      )}
    </ModalFrame>
  );
}

type ScopeToolLauncherProps = {
  toolType: ScopeToolType;
  ariaLabel: string;
  disabled?: boolean;
  onApplyM2?: (m2: number) => void;
  buttonClassName?: string;
};

export function ScopeToolLauncher({
  toolType,
  ariaLabel,
  disabled = false,
  onApplyM2,
  buttonClassName,
}: ScopeToolLauncherProps) {
  const [open, setOpen] = useState(false);
  const label = scopeToolTypeLabel(toolType);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        title={`Open ${label} calculator`}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          "inline-flex h-[2.125rem] shrink-0 items-center justify-center rounded-lg border border-sf-border-strong px-2 text-sf-text-secondary hover:bg-sf-page hover:text-sf-text disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        }
      >
        <IconCalculator className="size-5" />
      </button>
      {open ? (
        <ScopeToolModal
          toolType={toolType}
          onClose={() => setOpen(false)}
          onApplyM2={onApplyM2}
        />
      ) : null}
    </>
  );
}

type ScopeToolAfterAnswerProps = {
  scope: ScopePublic;
  answered: boolean;
  disabled?: boolean;
};

/** Checklist scope row — calculator icon after user selects an answer (scope-level tool). */
export function ScopeToolAfterAnswer({
  scope,
  answered,
  disabled = false,
}: ScopeToolAfterAnswerProps) {
  if (!answered || scope.exposeTool !== true || !scope.scopeToolType) return null;
  return (
    <ScopeToolLauncher
      toolType={scope.scopeToolType}
      ariaLabel={`Open ${scopeToolTypeLabel(scope.scopeToolType)} calculator for: ${scope.question}`}
      disabled={disabled}
    />
  );
}

type ScopeLineMeasureToolProps = {
  scope: ScopePublic;
  line: ProjectAreaObjectPublic;
  quoteObjects: QuoteObjectPublic[];
  objectLabel: string;
  disabled?: boolean;
  onApplyMeasure: (m2: number) => void;
};

/** Checklist SKU row — calculator to the right of Non Std; applies m² to measure. */
export function ScopeLineMeasureTool({
  scope,
  line,
  quoteObjects,
  objectLabel,
  disabled = false,
  onApplyMeasure,
}: ScopeLineMeasureToolProps) {
  const toolType = resolveScopeLineMeasureTool(scope, line, quoteObjects);
  if (!toolType) return null;

  return (
    <ScopeToolLauncher
      toolType={toolType}
      ariaLabel={`Open ${scopeToolTypeLabel(toolType)} calculator for ${objectLabel}`}
      disabled={disabled}
      onApplyM2={onApplyMeasure}
      buttonClassName={`${clActionBtnClass} inline-flex size-8 items-center justify-center p-0`}
    />
  );
}
