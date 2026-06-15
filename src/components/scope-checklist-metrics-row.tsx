"use client";

import { clScopeMetricsRowClass } from "@/components/cl-checklist-layout";
import { CL_FIELD_CONTROL_HEIGHT_CLASS } from "@/components/cl-checklist-layout";
import { scopeMetricValueLookup } from "@/lib/scope-metrics";
import { readApiJson } from "@/lib/client/read-api-json";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ScopeMetricPublic } from "@/types/scope-metric";
import { useCallback, useState } from "react";

type Props = {
  pa: ProjectAreaPublic;
  scopeDocId: string;
  scopeInstanceId: string | null | undefined;
  metrics: ScopeMetricPublic[];
  disabled?: boolean;
  onProjectAreaUpdated: (pa: ProjectAreaPublic) => void;
  onError: (message: string) => void;
};

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ScopeChecklistMetricsRow({
  pa,
  scopeDocId,
  scopeInstanceId,
  metrics,
  disabled = false,
  onProjectAreaUpdated,
  onError,
}: Props) {
  const [savingMetricId, setSavingMetricId] = useState<string | null>(null);

  const saveMetricValue = useCallback(
    async (metricid: string, value: number | null) => {
      setSavingMetricId(metricid);
      try {
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(pa.id)}/scope-metric`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scopeDocId,
              scopeInstanceId: scopeInstanceId?.trim() ? scopeInstanceId.trim() : null,
              metricid,
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
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to save scope metric");
      } finally {
        setSavingMetricId(null);
      }
    },
    [pa.id, scopeDocId, scopeInstanceId, onProjectAreaUpdated, onError],
  );

  if (metrics.length === 0) return null;

  return (
    <div className={clScopeMetricsRowClass} role="group" aria-label="Scope metrics">
      {metrics.map((m) => {
        const stored = scopeMetricValueLookup(
          pa.scopeMetricValues,
          scopeDocId,
          scopeInstanceId,
          m.metricid,
        );
        const display = stored != null ? String(stored) : "";
        const busy = savingMetricId === m.metricid;
        return (
          <label
            key={m.metricid}
            className="flex shrink-0 flex-col gap-0.5"
            title={`${m.label} (${m.uom})`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
              {m.label} ({m.uom})
            </span>
            <input
              type="text"
              inputMode="decimal"
              defaultValue={display}
              key={`${m.metricid}:${display}`}
              disabled={disabled || busy}
              className={`w-[10ch] min-w-[10ch] rounded border border-sf-border-strong bg-sf-surface px-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 ${CL_FIELD_CONTROL_HEIGHT_CLASS}`}
              aria-label={`${m.label} in ${m.uom}`}
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
                void saveMetricValue(m.metricid, next);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
