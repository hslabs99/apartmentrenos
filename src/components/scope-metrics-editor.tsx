"use client";

import { MAX_SCOPE_METRICS, SCOPE_METRIC_UOM_OPTIONS } from "@/types/scope-metric";
import type { ScopeMetricPublic } from "@/types/scope-metric";
import type { ScopeFormDraftAnswer } from "@/lib/client/scope-form-draft";

type Props = {
  metrics: ScopeMetricPublic[];
  answers: ScopeFormDraftAnswer[];
  onChange: (metrics: ScopeMetricPublic[]) => void;
  disabled?: boolean;
  inputClassName: string;
};

export function ScopeMetricsEditor({
  metrics,
  answers,
  onChange,
  disabled = false,
  inputClassName,
}: Props) {
  function updateMetric(metricid: string, patch: Partial<ScopeMetricPublic>) {
    onChange(
      metrics.map((m) => (m.metricid === metricid ? { ...m, ...patch } : m)),
    );
  }

  function toggleAnswer(metricid: string, answerid: string, checked: boolean) {
    const m = metrics.find((x) => x.metricid === metricid);
    if (!m) return;
    const ids = new Set(m.answerids);
    if (checked) ids.add(answerid);
    else ids.delete(answerid);
    updateMetric(metricid, { answerids: [...ids] });
  }

  function addMetric() {
    if (metrics.length >= MAX_SCOPE_METRICS) return;
    const defaultAnswerids = answers
      .filter((a) => a.attachedQuoteObjectIds.length > 0)
      .map((a) => a.answerid);
    onChange([
      ...metrics,
      {
        metricid: crypto.randomUUID(),
        label: `Metric ${metrics.length + 1}`,
        uom: "M2",
        answerids: defaultAnswerids,
      },
    ]);
  }

  function removeMetric(metricid: string) {
    onChange(metrics.filter((m) => m.metricid !== metricid));
  }

  return (
    <div className="space-y-3 rounded-lg border border-sf-border bg-sf-page p-3 dark:border-zinc-600 dark:bg-zinc-900/40">
      <div>
        <h3 className="text-base font-semibold text-sf-text dark:text-zinc-100">Scope metrics</h3>
        <p className="mt-1 text-xs text-sf-text-weak dark:text-zinc-400">
          Optional measurements collected on the checklist when a tagged answer is chosen (max{" "}
          {MAX_SCOPE_METRICS}). Objects on an answer can inherit a metric as their measure source.
        </p>
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">No metrics defined.</p>
      ) : (
        <ul className="space-y-3">
          {metrics.map((m) => (
            <li
              key={m.metricid}
              className="rounded-md border border-sf-border bg-sf-surface p-3 dark:border-zinc-600 dark:bg-zinc-800/60"
            >
              <div className="mb-2 flex flex-wrap items-end gap-3">
                <label className="min-w-[12rem] flex-1">
                  <span className="mb-1 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                    Label
                  </span>
                  <input
                    type="text"
                    value={m.label}
                    maxLength={120}
                    disabled={disabled}
                    className={`${inputClassName} min-h-10 py-2 text-sm`}
                    onChange={(e) => updateMetric(m.metricid, { label: e.target.value })}
                  />
                </label>
                <label className="w-32 shrink-0">
                  <span className="mb-1 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                    UOM
                  </span>
                  <select
                    value={m.uom}
                    disabled={disabled}
                    className={`${inputClassName} min-h-10 py-2 text-sm`}
                    onChange={(e) => updateMetric(m.metricid, { uom: e.target.value })}
                  >
                    {SCOPE_METRIC_UOM_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={disabled}
                  className="shrink-0 text-xs font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                  onClick={() => removeMetric(m.metricid)}
                >
                  Remove
                </button>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                  Show on checklist when answer is
                </legend>
                {answers.length === 0 ? (
                  <p className="text-xs text-sf-text-weak dark:text-zinc-500">Add answers first.</p>
                ) : (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {answers.map((a) => (
                      <li key={a.answerid}>
                        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-sf-border-strong"
                            checked={m.answerids.includes(a.answerid)}
                            disabled={disabled}
                            onChange={(e) =>
                              toggleAnswer(m.metricid, a.answerid, e.target.checked)
                            }
                          />
                          <span>{a.label || "(untitled)"}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={disabled || metrics.length >= MAX_SCOPE_METRICS}
        className="min-h-10 rounded-lg border border-sf-border-strong px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-600"
        onClick={addMetric}
      >
        Add metric
      </button>
    </div>
  );
}
