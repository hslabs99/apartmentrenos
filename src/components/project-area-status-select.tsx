"use client";

import type { ProjectAreaStatus } from "@/types/project-area";

const STATUS_OPTIONS: { value: ProjectAreaStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "escalated", label: "Escalated" },
];

function statusSelectClass(status: ProjectAreaStatus | null | undefined): string {
  if (status === "completed") {
    return "font-semibold text-emerald-700 dark:text-emerald-300";
  }
  if (status === "escalated") {
    return "font-semibold text-red-700 dark:text-red-400";
  }
  return "text-sf-text dark:text-zinc-100";
}

type Props = {
  value: ProjectAreaStatus | null | undefined;
  disabled?: boolean;
  labelClassName?: string;
  selectClassName?: string;
  onChange: (next: ProjectAreaStatus | null) => void;
};

export function ProjectAreaStatusSelect({
  value,
  disabled = false,
  labelClassName = "mb-0.5 block text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400",
  selectClassName = "rounded border border-sf-border-strong bg-sf-surface px-1 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950",
  onChange,
}: Props) {
  return (
    <label className="flex w-fit shrink-0 flex-col gap-0.5">
      <span className={labelClassName}>Area Status</span>
      <select
        className={`${selectClassName} ${statusSelectClass(value)} inline-block`}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "completed" || raw === "escalated" ? raw : null);
        }}
      >
        <option value="">—</option>
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="font-normal text-sf-text dark:text-zinc-100">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
