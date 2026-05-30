"use client";

import { ModalFrame } from "@/components/modal-frame";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { useEffect, useMemo, useState } from "react";

const ALL_CATEGORIES = "";
const NO_CATEGORY = "__none__";

function displayObjectName(q: QuoteObjectPublic): string {
  return (
    q.objectname?.trim() ||
    (q.objectid != null ? `Object #${q.objectid}` : "Unnamed object")
  );
}

function displayCategory(q: QuoteObjectPublic): string {
  return q.category?.trim() || "—";
}

type Props = {
  open: boolean;
  areaLabel: string;
  quoteObjects: QuoteObjectPublic[];
  saving: boolean;
  onClose: () => void;
  onPick: (quoteObjectDocId: string) => void;
};

export function AddObjectPickerModal({
  open,
  areaLabel,
  quoteObjects,
  saving,
  onClose,
  onPick,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setCategoryFilter(ALL_CATEGORIES);
  }, [open]);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const q of quoteObjects) {
      const c = q.category?.trim();
      if (c) seen.add(c);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [quoteObjects]);

  const hasUncategorized = useMemo(
    () => quoteObjects.some((q) => !q.category?.trim()),
    [quoteObjects],
  );

  const filteredRows = useMemo(() => {
    let rows = [...quoteObjects];
    if (categoryFilter === NO_CATEGORY) {
      rows = rows.filter((q) => !q.category?.trim());
    } else if (categoryFilter) {
      rows = rows.filter((q) => (q.category ?? "").trim() === categoryFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => {
        const hay = [row.category ?? "", row.objectname ?? ""].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return rows.sort((a, b) => {
      const cat = displayCategory(a).localeCompare(displayCategory(b), undefined, {
        sensitivity: "base",
      });
      if (cat !== 0) return cat;
      return displayObjectName(a).localeCompare(displayObjectName(b), undefined, {
        sensitivity: "base",
      });
    });
  }, [quoteObjects, categoryFilter, search]);

  if (!open) return null;

  const filterInputClass =
    "min-h-10 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";

  return (
    <ModalFrame
      title="Add object"
      description={`Choose a quote object to add to “${areaLabel}”.`}
      onClose={saving ? () => {} : onClose}
      wide
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium disabled:opacity-50 dark:border-zinc-600"
        >
          Cancel
        </button>
      }
    >
      {quoteObjects.length === 0 ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          No quote objects in Setup. Add some under Setup → Quote Objects.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                Search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={saving}
                placeholder="Category or object name…"
                className={filterInputClass}
                autoFocus
              />
            </label>
            <label className="flex min-w-[10rem] flex-col gap-1 sm:w-48">
              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                Type
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                disabled={saving}
                aria-label="Filter by type (category)"
                className={filterInputClass}
              >
                <option value={ALL_CATEGORIES}>All types</option>
                {hasUncategorized ? <option value={NO_CATEGORY}>No category</option> : null}
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {saving ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Adding…</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No objects match your filters.
            </p>
          ) : (
            <div className="max-h-[min(24rem,55vh)] overflow-auto rounded-lg border border-sf-border dark:border-zinc-700">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-sf-surface dark:bg-zinc-900">
                  <tr className="border-b border-sf-border dark:border-zinc-700">
                    <th className="px-3 py-2 font-semibold text-sf-text-secondary dark:text-zinc-300">
                      Category
                    </th>
                    <th className="px-3 py-2 font-semibold text-sf-text-secondary dark:text-zinc-300">
                      Object name
                    </th>
                    <th className="px-3 py-2 font-semibold text-sf-text-secondary dark:text-zinc-300">
                      UOM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((q) => (
                    <tr key={q.id} className="border-b border-sf-border last:border-b-0 dark:border-zinc-800">
                      <td className="px-3 py-2 text-sf-text-secondary dark:text-zinc-400">
                        {displayCategory(q)}
                      </td>
                      <td className="px-3 py-0">
                        <button
                          type="button"
                          onClick={() => onPick(q.id)}
                          disabled={saving}
                          className="w-full rounded px-1 py-2 text-left font-medium text-sf-text transition hover:bg-sf-page disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {displayObjectName(q)}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-sf-text-secondary dark:text-zinc-400">
                        {q.uom?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ModalFrame>
  );
}
