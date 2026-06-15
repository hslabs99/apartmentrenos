"use client";

import {
  areaCeilingHeightInputTitle,
  areaCeilingHeightPlaceholder,
} from "@/lib/project-area-ceiling-height";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  disabled?: boolean;
  labelClassName: string;
  inputClassName: string;
  fieldKey: string;
  onPatch: (body: { ceilingheightm: number | null }) => void;
  onValidationError: (message: string) => void;
};

export function ProjectAreaCeilingHeightField({
  pa,
  project,
  disabled = false,
  labelClassName,
  inputClassName,
  fieldKey,
  onPatch,
  onValidationError,
}: Props) {
  const overrideValue = pa.ceilingheightm;
  const title = areaCeilingHeightInputTitle(pa, project);

  return (
    <label className="flex shrink-0 flex-col gap-0.5">
      <span className={labelClassName}>Ceiling (m)</span>
      <input
        key={fieldKey}
        type="text"
        inputMode="decimal"
        className={inputClassName}
        defaultValue={overrideValue != null ? String(overrideValue) : ""}
        placeholder={areaCeilingHeightPlaceholder(project)}
        title={title}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw !== "" && parseOptionalNumber(raw) === null) {
            onValidationError("Ceiling height (m) must be a valid number (or empty).");
            e.target.value = overrideValue != null ? String(overrideValue) : "";
            return;
          }
          const next = parseOptionalNumber(raw);
          const prev = overrideValue ?? null;
          if (next === prev) return;
          onPatch({ ceilingheightm: next });
        }}
      />
    </label>
  );
}
