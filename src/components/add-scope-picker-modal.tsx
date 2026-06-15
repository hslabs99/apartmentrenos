"use client";

import { ModalFrame } from "@/components/modal-frame";
import {
  compareSetupAreasDisplayOrder,
  scopeTaggedForSetupAreaDocId,
} from "@/lib/scope-areas";
import type { AreaPublic } from "@/types/area";
import type { ScopePublic } from "@/types/scope";
import { useEffect, useMemo, useState } from "react";

const ALL_AREAS = "";

function displayQuestion(s: ScopePublic): string {
  return (s.question ?? "").trim() || `Scope ${s.scopeid ?? ""}`;
}

function displaySetupAreas(s: ScopePublic, areaNameByDocId: Map<string, string>): string {
  const names: string[] = [];
  for (const docId of s.areaDocIds ?? []) {
    const n = areaNameByDocId.get(docId);
    if (n) names.push(n);
  }
  if (names.length > 0) {
    return [...new Set(names)].join(", ");
  }
  return (
    s.areaNamesDisplay?.trim() ||
    s.areaname?.trim() ||
    (s.areaid != null ? `Area #${s.areaid}` : "—")
  );
}

type Props = {
  open: boolean;
  areaLabel: string;
  scopes: ScopePublic[];
  areas: AreaPublic[];
  /** Default “Filter by area” to this Setup → Areas doc id (project area template). */
  defaultSetupAreaDocId?: string | null;
  /** Scope doc ids already on this project area (picker still lists them for another copy). */
  scopeIdsOnArea?: ReadonlySet<string>;
  saving: boolean;
  onClose: () => void;
  onPick: (scopeDocId: string) => void;
};

export function AddScopePickerModal({
  open,
  areaLabel,
  scopes,
  areas,
  defaultSetupAreaDocId = null,
  scopeIdsOnArea,
  saving,
  onClose,
  onPick,
}: Props) {
  const [search, setSearch] = useState("");
  const [setupAreaDocIdFilter, setSetupAreaDocIdFilter] = useState(ALL_AREAS);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSetupAreaDocIdFilter(defaultSetupAreaDocId?.trim() || ALL_AREAS);
  }, [open, defaultSetupAreaDocId]);

  const areasById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  const areaNameByDocId = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areas) {
      m.set(a.id, (a.areaname ?? "").trim() || `Area #${a.areaid ?? ""}`);
    }
    return m;
  }, [areas]);

  const setupAreaOptions = useMemo(
    () => [...areas].sort(compareSetupAreasDisplayOrder),
    [areas],
  );

  const filteredRows = useMemo(() => {
    let rows = scopes.filter((s) => s.kind !== "header" && s.kind !== "footer");
    if (setupAreaDocIdFilter) {
      const templateArea = areasById.get(setupAreaDocIdFilter) ?? null;
      rows = rows.filter((s) =>
        scopeTaggedForSetupAreaDocId(s, setupAreaDocIdFilter, templateArea),
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => {
        const hay = [displayQuestion(row), displaySetupAreas(row, areaNameByDocId)]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return rows.sort((a, b) => {
      const area = displaySetupAreas(a, areaNameByDocId).localeCompare(
        displaySetupAreas(b, areaNameByDocId),
        undefined,
        { sensitivity: "base" },
      );
      if (area !== 0) return area;
      return displayQuestion(a).localeCompare(displayQuestion(b), undefined, {
        sensitivity: "base",
      });
    });
  }, [scopes, areasById, areaNameByDocId, setupAreaDocIdFilter, search]);

  const filterAreaLabel =
    setupAreaDocIdFilter && areaNameByDocId.get(setupAreaDocIdFilter)
      ? areaNameByDocId.get(setupAreaDocIdFilter)
      : null;

  if (!open) return null;

  const filterInputClass =
    "min-h-10 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";

  const questionScopes = scopes.filter((s) => s.kind !== "header" && s.kind !== "footer");

  return (
    <ModalFrame
      title="Add scope question"
      description={`Add a setup scope question to “${areaLabel}”. Filter by template area tags below. Questions already on this area can be added again (e.g. a second wardrobe with its own measurements).`}
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
      {questionScopes.length === 0 ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          No setup scope questions exist under Setup → Scopes.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                Filter by area
              </span>
              <select
                value={setupAreaDocIdFilter}
                onChange={(e) => setSetupAreaDocIdFilter(e.target.value)}
                disabled={saving}
                aria-label="Filter scope questions by setup template area"
                className={filterInputClass}
              >
                <option value={ALL_AREAS}>All setup areas</option>
                {setupAreaOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.areaname ?? "").trim() || `Area #${a.areaid ?? ""}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                Search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={saving}
                placeholder="Question or area name…"
                className={filterInputClass}
                autoFocus
              />
            </label>
          </div>

          <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
            {filterAreaLabel
              ? `Showing ${filteredRows.length} of ${questionScopes.length} questions tagged for ${filterAreaLabel} in Setup → Scopes.`
              : `Showing ${filteredRows.length} of ${questionScopes.length} setup questions (all template areas).`}
            {scopeIdsOnArea && scopeIdsOnArea.size > 0
              ? " Questions marked “On area” can be added again as a separate copy."
              : null}
          </p>

          {saving ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Adding…</p>
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No scope questions match this area filter
              {search.trim() ? " and search" : ""}. Try All setup areas or a different area.
            </p>
          ) : (
            <div className="max-h-[min(24rem,55vh)] overflow-auto rounded-lg border border-sf-border dark:border-zinc-700">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-sf-surface dark:bg-zinc-900">
                  <tr className="border-b border-sf-border dark:border-zinc-700">
                    <th className="px-3 py-2 font-semibold text-sf-text-secondary dark:text-zinc-300">
                      Setup area(s)
                    </th>
                    <th className="px-3 py-2 font-semibold text-sf-text-secondary dark:text-zinc-300">
                      Question
                    </th>
                    <th className="w-[6.5rem] px-3 py-2 font-semibold text-sf-text-secondary dark:text-zinc-300">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((s) => {
                    const onArea = scopeIdsOnArea?.has(s.id) ?? false;
                    return (
                    <tr
                      key={s.id}
                      className="border-b border-sf-border last:border-b-0 dark:border-zinc-800"
                    >
                      <td className="px-3 py-2 text-sf-text-secondary dark:text-zinc-400">
                        {displaySetupAreas(s, areaNameByDocId)}
                      </td>
                      <td className="px-3 py-0">
                        <button
                          type="button"
                          onClick={() => onPick(s.id)}
                          disabled={saving}
                          className="w-full rounded px-1 py-2 text-left font-medium text-sf-text transition hover:bg-sf-page disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {displayQuestion(s)}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-sf-text-secondary dark:text-zinc-400">
                        {onArea ? (
                          <span className="font-medium text-amber-800 dark:text-amber-300">
                            On area
                          </span>
                        ) : (
                          <span>New</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ModalFrame>
  );
}
