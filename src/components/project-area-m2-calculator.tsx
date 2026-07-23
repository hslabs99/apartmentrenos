"use client";

import { ModalFrame } from "@/components/modal-frame";
import {
  clAreaCalculatorIconClass,
  clAreaHdrCalculatorBtnClass,
  clCalculatorIconBtnClass,
} from "@/components/cl-checklist-layout";
import { IconCalculator, RectSectionsM2CalculatorBody } from "@/components/scope-tool-modal";
import { roundScopeToolM2, type ScopeToolBenchSection } from "@/lib/scope-tools";
import type { ProjectAreaPublic } from "@/types/project-area";
import { useCallback, useState } from "react";

type Props = {
  pa: ProjectAreaPublic;
  areaLabel: string;
  disabled?: boolean;
  labelClassName: string;
  /** Use dark-bar chrome when rendered inside checklist area header. */
  areaHeaderChrome?: boolean;
  onApply: (body: {
    aream2: number;
    aream2calcsections: ScopeToolBenchSection[] | null;
  }) => void;
};

export function ProjectAreaM2Calculator({
  pa,
  areaLabel,
  disabled = false,
  labelClassName,
  areaHeaderChrome = false,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [resultM2, setResultM2] = useState<number | null>(null);
  const [sections, setSections] = useState<ScopeToolBenchSection[]>([]);

  const handleResult = useCallback((value: number | null) => {
    setResultM2(value);
  }, []);

  const handleSectionsChange = useCallback((next: ScopeToolBenchSection[]) => {
    setSections(next);
  }, []);

  function handleOpen() {
    setSections(pa.aream2calcsections ?? []);
    setResultM2(null);
    setOpen(true);
  }

  function handleApply() {
    if (resultM2 == null) return;
    onApply({
      aream2: roundScopeToolM2(resultM2),
      aream2calcsections: sections.length > 0 ? sections : null,
    });
    setOpen(false);
  }

  return (
    <>
      <div className="flex shrink-0 flex-col gap-0.5">
        <span className={labelClassName} aria-hidden="true">
          {"\u00a0"}
        </span>
        <button
          type="button"
          disabled={disabled}
          title="Open area m² calculator"
          aria-label={`Open area m² calculator for ${areaLabel}`}
          onClick={handleOpen}
          className={areaHeaderChrome ? clAreaHdrCalculatorBtnClass : clCalculatorIconBtnClass}
        >
          <IconCalculator className={clAreaCalculatorIconClass} />
        </button>
      </div>
      {open ? (
        <ModalFrame
          title="Area m² calculator"
          description="Enter floor dimensions in millimetres, then apply the total to this area’s m² field. Sections are saved on this area."
          onClose={() => setOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
              >
                Close
              </button>
              <button
                type="button"
                disabled={resultM2 == null}
                onClick={handleApply}
                className="rounded-lg bg-sf-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-[#0176d3]"
              >
                Apply to area m²
              </button>
            </>
          }
        >
          <RectSectionsM2CalculatorBody
            key={pa.id}
            initialSections={pa.aream2calcsections}
            onResult={handleResult}
            onSectionsChange={handleSectionsChange}
            intro="Add floor areas in millimetres (e.g. 4200 × 3500). Total area is the sum of all sections."
            totalLabel="Total floor area"
          />
        </ModalFrame>
      ) : null}
    </>
  );
}
