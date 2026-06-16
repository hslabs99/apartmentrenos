"use client";

import { ModalFrame } from "@/components/modal-frame";
import {
  clAreaCalculatorIconClass,
  clCalculatorIconBtnClass,
  clCalculatorIconClass,
} from "@/components/cl-checklist-layout";
import {
  benchSectionM2,
  benchSectionsTotalM2,
  formatBenchSectionDims,
  formatScopeToolM2,
  mmRectToM2,
  mmWallToM2,
  newBenchSectionId,
  resolveLineMeasureTool,
  roundScopeToolM2,
  scopeToolTypeLabel,
  type ScopeToolApplyPayload,
  type ScopeToolBenchSection,
  type ScopeToolType,
  type ScopeToolWallMm,
} from "@/lib/scope-tools";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import { useEffect, useMemo, useState } from "react";

const inputClass =
  "min-h-11 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2 text-base tabular-nums dark:border-zinc-600 dark:bg-zinc-950";

const compactInputClass =
  "min-h-9 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-2 py-1.5 text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-950";

function parseMmInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function IconCalculator({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? clCalculatorIconClass}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
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

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

type RectSectionsM2CalculatorBodyProps = {
  initialSections?: ScopeToolBenchSection[] | null;
  onResult: (n: number | null) => void;
  onSectionsChange: (sections: ScopeToolBenchSection[]) => void;
  intro?: string;
  totalLabel?: string;
};

export function RectSectionsM2CalculatorBody({
  initialSections,
  onResult,
  onSectionsChange,
  intro = "Add rectangular sections in millimetres (e.g. 2400 × 600). Total area is the sum of all sections.",
  totalLabel = "Total area",
}: RectSectionsM2CalculatorBodyProps) {
  const [sections, setSections] = useState<ScopeToolBenchSection[]>(
    () => initialSections ?? [],
  );
  const [draftLengthMm, setDraftLengthMm] = useState("");
  const [draftWidthMm, setDraftWidthMm] = useState("");

  const totalM2 = useMemo(() => benchSectionsTotalM2(sections), [sections]);

  useEffect(() => {
    onResult(totalM2);
  }, [totalM2, onResult]);

  useEffect(() => {
    onSectionsChange(sections);
  }, [sections, onSectionsChange]);

  function updateSection(id: string, patch: Partial<Pick<ScopeToolBenchSection, "lengthMm" | "widthMm">>) {
    setSections((prev) =>
      prev.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((section) => section.id !== id));
  }

  function addDraftSection() {
    const lengthMm = parseMmInput(draftLengthMm);
    const widthMm = parseMmInput(draftWidthMm);
    if (lengthMm == null || widthMm == null) return;
    setSections((prev) => [
      ...prev,
      { id: newBenchSectionId(), lengthMm, widthMm },
    ]);
    setDraftLengthMm("");
    setDraftWidthMm("");
  }

  const draftReady =
    parseMmInput(draftLengthMm) != null && parseMmInput(draftWidthMm) != null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-sf-text-secondary dark:text-zinc-400">{intro}</p>

      {sections.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
            <span>Length (mm)</span>
            <span>Width (mm)</span>
            <span className="text-right">Area</span>
            <span className="sr-only">Actions</span>
          </div>
          {sections.map((section, index) => {
            const sectionM2 = benchSectionM2(section);
            return (
              <div
                key={section.id}
                className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-lg border border-sf-border bg-sf-page/40 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-900/40"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(section.lengthMm)}
                  onChange={(e) => {
                    const next = parseMmInput(e.target.value);
                    if (next != null) updateSection(section.id, { lengthMm: next });
                  }}
                  className={compactInputClass}
                  aria-label={`Section ${index + 1} length in mm`}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(section.widthMm)}
                  onChange={(e) => {
                    const next = parseMmInput(e.target.value);
                    if (next != null) updateSection(section.id, { widthMm: next });
                  }}
                  className={compactInputClass}
                  aria-label={`Section ${index + 1} width in mm`}
                />
                <span
                  className="min-w-[4.5rem] text-right text-sm font-medium tabular-nums text-sf-text dark:text-zinc-100"
                  title={formatBenchSectionDims(section)}
                >
                  {Number.isFinite(sectionM2) ? formatScopeToolM2(sectionM2) : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => removeSection(section.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-sf-border-strong text-red-600 hover:bg-red-50 dark:border-zinc-600 dark:text-red-400 dark:hover:bg-red-950/40"
                  aria-label={`Delete section ${index + 1}: ${formatBenchSectionDims(section)}`}
                >
                  <IconTrash />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-sf-border px-4 py-3 text-sm text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400">
          No sections yet. Enter length and width below, then add a section.
        </p>
      )}

      <div className="rounded-lg border border-sf-border bg-sf-surface/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/30">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
          Add section
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
              Length (mm)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={draftLengthMm}
              onChange={(e) => setDraftLengthMm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftReady) addDraftSection();
              }}
              className={inputClass}
              placeholder="e.g. 2400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
              Width (mm)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={draftWidthMm}
              onChange={(e) => setDraftWidthMm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftReady) addDraftSection();
              }}
              className={inputClass}
              placeholder="e.g. 600"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!draftReady}
              onClick={addDraftSection}
              className="h-11 w-full rounded-lg border border-sf-border-strong bg-sf-page px-4 text-sm font-medium hover:bg-sf-surface disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Add section
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-sf-border bg-sf-page/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
        <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
          {totalLabel}
        </span>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-sf-text dark:text-zinc-50">
          {totalM2 == null ? "—" : formatScopeToolM2(totalM2)}
        </p>
        {sections.length > 0 ? (
          <p className="mt-1 text-xs text-sf-text-secondary dark:text-zinc-400">
            {sections.length} section{sections.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type WallM2CalculatorBodyProps = {
  initialWallMm?: ScopeToolWallMm | null;
  onResult: (n: number | null) => void;
  onWallMmChange: (wall: ScopeToolWallMm | null) => void;
};

function WallM2CalculatorBody({
  initialWallMm,
  onResult,
  onWallMmChange,
}: WallM2CalculatorBodyProps) {
  const [width1Mm, setWidth1Mm] = useState(
    initialWallMm ? String(initialWallMm.width1Mm) : "",
  );
  const [width2Mm, setWidth2Mm] = useState(
    initialWallMm ? String(initialWallMm.width2Mm) : "",
  );
  const [studHeightMm, setStudHeightMm] = useState(
    initialWallMm ? String(initialWallMm.studHeightMm) : "",
  );

  const result = useMemo(() => {
    const w1 = parseMmInput(width1Mm);
    const w2 = parseMmInput(width2Mm);
    const h = parseMmInput(studHeightMm);
    if (w1 == null || w2 == null || h == null) return null;
    const v = mmWallToM2(w1, w2, h);
    return Number.isFinite(v) ? v : null;
  }, [width1Mm, width2Mm, studHeightMm]);

  useEffect(() => {
    onResult(result);
  }, [result, onResult]);

  useEffect(() => {
    const w1 = parseMmInput(width1Mm);
    const w2 = parseMmInput(width2Mm);
    const h = parseMmInput(studHeightMm);
    if (w1 == null || w2 == null || h == null) {
      onWallMmChange(null);
      return;
    }
    onWallMmChange({ width1Mm: w1, width2Mm: w2, studHeightMm: h });
  }, [width1Mm, width2Mm, studHeightMm, onWallMmChange]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
        Enter both wall widths and stud height in millimetres. Area = (width 1 + width 2) × stud
        height.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Width 1 (mm)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={width1Mm}
            onChange={(e) => setWidth1Mm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 3000"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Width 2 (mm)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={width2Mm}
            onChange={(e) => setWidth2Mm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 1200"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Stud height (mm)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={studHeightMm}
            onChange={(e) => setStudHeightMm(e.target.value)}
            className={inputClass}
            placeholder="e.g. 2400"
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
  initialBenchSections?: ScopeToolBenchSection[] | null;
  initialWallMm?: ScopeToolWallMm | null;
  /** When set, user can apply the calculated m² (and saved measurements) to the line. */
  onApply?: (payload: ScopeToolApplyPayload) => void;
};

export function ScopeToolModal({
  toolType,
  onClose,
  initialBenchSections,
  initialWallMm,
  onApply,
}: ScopeToolModalProps) {
  const [resultM2, setResultM2] = useState<number | null>(null);
  const [benchSections, setBenchSections] = useState<ScopeToolBenchSection[]>(
    () => initialBenchSections ?? [],
  );
  const [wallMm, setWallMm] = useState<ScopeToolWallMm | null>(initialWallMm ?? null);
  const label = scopeToolTypeLabel(toolType);

  function handleApply() {
    if (resultM2 == null || !onApply) return;
    onApply({
      m2: roundScopeToolM2(resultM2),
      scopeToolBenchSections:
        toolType === "M2"
          ? benchSections.length > 0
            ? benchSections
            : null
          : undefined,
      scopeToolWallMm: toolType === "WallM2" ? wallMm : undefined,
    });
    onClose();
  }

  return (
    <ModalFrame
      title={label}
      description={
        onApply
          ? "Enter measurements in millimetres, then apply the total to this line’s measure field. Sections are saved on this line."
          : "Enter measurements in millimetres — values are not saved to the checklist."
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
          {onApply ? (
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
      {toolType === "M2" ? (
        <RectSectionsM2CalculatorBody
          initialSections={initialBenchSections}
          onResult={setResultM2}
          onSectionsChange={setBenchSections}
        />
      ) : (
        <WallM2CalculatorBody
          initialWallMm={initialWallMm}
          onResult={setResultM2}
          onWallMmChange={setWallMm}
        />
      )}
    </ModalFrame>
  );
}

type ScopeToolLauncherProps = {
  toolType: ScopeToolType;
  ariaLabel: string;
  disabled?: boolean;
  initialBenchSections?: ScopeToolBenchSection[] | null;
  initialWallMm?: ScopeToolWallMm | null;
  onApply?: (payload: ScopeToolApplyPayload) => void;
  buttonClassName?: string;
  iconClassName?: string;
};

export function ScopeToolLauncher({
  toolType,
  ariaLabel,
  disabled = false,
  initialBenchSections,
  initialWallMm,
  onApply,
  buttonClassName,
  iconClassName,
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
        className={buttonClassName ?? clCalculatorIconBtnClass}
      >
        <IconCalculator className={iconClassName ?? clCalculatorIconClass} />
      </button>
      {open ? (
        <ScopeToolModal
          toolType={toolType}
          onClose={() => setOpen(false)}
          initialBenchSections={initialBenchSections}
          initialWallMm={initialWallMm}
          onApply={onApply}
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
      ariaLabel={`Open ${scopeToolTypeLabel(scope.scopeToolType)} for: ${scope.question}`}
      disabled={disabled}
    />
  );
}

type ScopeLineMeasureToolProps = {
  scope?: ScopePublic | null;
  line: ProjectAreaObjectPublic;
  quoteObjects: QuoteObjectPublic[];
  objectLabel: string;
  disabled?: boolean;
  onApplyMeasure: (payload: ScopeToolApplyPayload) => void;
  buttonClassName?: string;
};

/** Checklist line — calculator applies m² to measure and saves section measurements on the line. */
export function ScopeLineMeasureTool({
  scope = null,
  line,
  quoteObjects,
  objectLabel,
  disabled = false,
  onApplyMeasure,
  buttonClassName,
}: ScopeLineMeasureToolProps) {
  const toolType = resolveLineMeasureTool(line, quoteObjects, scope);
  if (!toolType) return null;

  return (
    <ScopeToolLauncher
      toolType={toolType}
      ariaLabel={`Open ${scopeToolTypeLabel(toolType)} for ${objectLabel}`}
      disabled={disabled}
      initialBenchSections={line.scopeToolBenchSections}
      initialWallMm={line.scopeToolWallMm}
      onApply={onApplyMeasure}
      buttonClassName={buttonClassName}
    />
  );
}
