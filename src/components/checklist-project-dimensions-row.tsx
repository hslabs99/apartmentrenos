"use client";

import type { ProjectPublic } from "@/types/project";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const hdrLabel =
  "mb-0.5 block text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400";
const inputClass =
  "w-[6ch] max-w-full rounded border border-sf-border-strong bg-sf-surface px-1.5 py-1 text-xs tabular-nums text-right outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-emerald-500";

type DimKey = "projectm2" | "projectm2hard" | "projectm2soft" | "ceilingheightm";

const FIELDS: { key: DimKey; label: string }[] = [
  { key: "projectm2", label: "m² (total)" },
  { key: "projectm2hard", label: "M2 (Hard Floor)" },
  { key: "projectm2soft", label: "M2 (Soft Floor)" },
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
    <div className="flex w-full flex-wrap items-end gap-x-3 gap-y-2 border-b border-sf-border pb-2 dark:border-zinc-700">
      {FIELDS.map(({ key, label }) => {
        const value = project[key];
        return (
          <label key={key} className="flex min-w-[7rem] flex-col gap-0.5">
            <span className={hdrLabel}>{label}</span>
            <input
              key={`${key}-${value ?? "empty"}`}
              type="text"
              inputMode="decimal"
              className={inputClass}
              defaultValue={value != null ? String(value) : ""}
              placeholder="Optional"
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
