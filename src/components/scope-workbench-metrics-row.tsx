"use client";

import { CL_FIELD_CONTROL_HEIGHT_CLASS } from "@/components/cl-checklist-layout";
import { readApiJson } from "@/lib/client/read-api-json";
import { scopeMetricValueLookup } from "@/lib/scope-metrics";
import type { ScopeMetricAreaEntry } from "@/lib/scope-metrics";
import type { ProjectAreaPublic } from "@/types/project-area";
import { useCallback, useState } from "react";

type Props = {
  pa: ProjectAreaPublic;
  entries: ScopeMetricAreaEntry[];
  disabled?: boolean;
  onProjectAreaUpdated: (pa: ProjectAreaPublic) => void;
  onError: (message: string) => void;
  onRepriced?: () => void;
};

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ScopeWorkbenchMetricsRow({
  pa,
  entries,
  disabled = false,
  onProjectAreaUpdated,
  onError,
  onRepriced,
}: Props) {
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const saveMetricValue = useCallback(
    async (entry: ScopeMetricAreaEntry, value: number | null) => {
      const saveId = `${entry.scopeDocId}|${entry.scopeInstanceId ?? ""}|${entry.metric.metricid}`;
      setSavingKey(saveId);
      try {
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(pa.id)}/scope-metric`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scopeDocId: entry.scopeDocId,
              scopeInstanceId: entry.scopeInstanceId?.trim()
                ? entry.scopeInstanceId.trim()
                : null,
              metricid: entry.metric.metricid,
              value,
            }),
          },
        );
        const data = await readApiJson<{
          projectArea?: ProjectAreaPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to save scope metric");
        if (data.projectArea) onProjectAreaUpdated(data.projectArea);
        onRepriced?.();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to save scope metric");
      } finally {
        setSavingKey(null);
      }
    },
    [pa.id, onProjectAreaUpdated, onError, onRepriced],
  );

  if (entries.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-end gap-x-4 gap-y-2 py-1"
      role="group"
      aria-label="Scope metrics"
    >
      {entries.map((entry) => {
        const { metric } = entry;
        const saveId = `${entry.scopeDocId}|${entry.scopeInstanceId ?? ""}|${metric.metricid}`;
        const stored = scopeMetricValueLookup(
          pa.scopeMetricValues,
          entry.scopeDocId,
          entry.scopeInstanceId,
          metric.metricid,
        );
        const display = stored != null ? String(stored) : "";
        const busy = savingKey === saveId;
        const fieldLabel = `${entry.scopeQuestion} · ${metric.label} (${metric.uom})`;
        return (
          <label
            key={saveId}
            className="flex min-w-0 shrink-0 flex-col gap-0.5"
            title={fieldLabel}
          >
            <span className="max-w-[14rem] truncate text-[10px] font-medium uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
              {entry.scopeQuestion} · {metric.label} ({metric.uom})
            </span>
            <input
              type="text"
              inputMode="decimal"
              defaultValue={display}
              key={`${saveId}:${display}`}
              disabled={disabled || busy}
              className={`w-[10ch] min-w-[10ch] rounded border border-sf-border-strong bg-sf-surface px-2 text-xs dark:border-zinc-600 dark:bg-zinc-950 ${CL_FIELD_CONTROL_HEIGHT_CLASS}`}
              aria-label={fieldLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (raw !== "" && parseOptionalNumber(raw) === null) {
                  onError("Metric must be a valid number (or empty).");
                  e.target.value = display;
                  return;
                }
                const next = parseOptionalNumber(raw);
                const prev = stored ?? null;
                if (next === prev) return;
                void saveMetricValue(entry, next);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
