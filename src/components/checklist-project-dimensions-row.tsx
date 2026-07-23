"use client";

import type { ProjectPublic } from "@/types/project";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const hdrLabel =
  "mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-sf-text-secondary dark:text-zinc-400";
const inputClass =
  "h-8 w-24 rounded-lg border border-sf-border bg-sf-page px-2.5 text-sm font-medium tabular-nums text-sf-text outline-none transition-all placeholder:text-sf-text-weak focus:border-sf-accent focus:bg-sf-surface focus:ring-2 focus:ring-sf-accent/40 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-sf-accent";

type DimKey = "projectm2" | "projectm2hard" | "projectm2soft" | "ceilingheightm";

const FIELDS: { key: DimKey; label: string }[] = [
  { key: "projectm2", label: "M² (Total)" },
  { key: "projectm2hard", label: "M² (Hard Floor)" },
  { key: "projectm2soft", label: "M² (Soft Floor)" },
  { key: "ceilingheightm", label: "Ceiling Height (m)" },
];

type Props = {
  project: ProjectPublic;
  disabled?: boolean;
  onPatch: (body: Partial<Pick<ProjectPublic, DimKey>>) => void;
  onValidationError: (message: string) => void;
};

export function ChecklistProjectDimensionsRow({
  project,
  disabled = false,
  onPatch,
  onValidationError,
}: Props) {
  return (
    <div className="flex w-full flex-wrap items-end gap-x-4 gap-y-2">
      {FIELDS.map(({ key, label }) => {
        const value = project[key];
        return (
          <label key={key} className="flex flex-col gap-1">
            <span className={hdrLabel}>{label}</span>
            <input
              key={`${key}-${value ?? "empty"}`}
              type="text"
              inputMode="decimal"
              className={inputClass}
              defaultValue={value != null ? String(value) : ""}
              placeholder={key === "projectm2soft" ? "Optional" : undefined}
              disabled={disabled}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (raw !== "" && parseOptionalNumber(raw) === null) {
                  onValidationError(`${label} must be a valid number (or empty).`);
                  e.target.value = value != null ? String(value) : "";
                  return;
                }
                const next = parseOptionalNumber(raw);
                const prev = value ?? null;
                if (next === prev) return;
                onPatch({ [key]: next });
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
