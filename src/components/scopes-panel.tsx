"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { ReorderArrows } from "@/components/reorder-arrows";
import { useTemplateReorder } from "@/lib/client/use-template-reorder";
import type { AreaPublic } from "@/types/area";
import { readApiJson } from "@/lib/client/read-api-json";
import {
  ScopeFormModal,
  scopeFormModeForScope,
  type ScopeFormMode,
} from "@/components/scope-form-modal";
import type { QuoteObjectPublic } from "@/types/quote-object";
import {
  sfDataSurface,
  sfNeutralToolbarButton,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import { sortOrderInArea } from "@/lib/scope-areas";
import type { ScopePublic } from "@/types/scope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SCOPES_AREA_FILTER_STORAGE_KEY = "apartmentrenos-setup-scopes-area-filter";

type Mode = "idle" | ScopeFormMode;

function scopeAreaGroupKey(s: ScopePublic, contextAreaDocId: string | null): string {
  if (contextAreaDocId) return `ctx:${contextAreaDocId}`;
  const id = String(s.areaDocId ?? "").trim();
  if (id) return `d:${id}`;
  return `a:${Number(s.areaid)}`;
}

function scopeReorderEdges(
  rows: ScopePublic[],
  idx: number,
  contextAreaDocId: string | null,
): { disabledUp: boolean; disabledDown: boolean } {
  const cur = rows[idx];
  if (!cur) return { disabledUp: true, disabledDown: true };
  const k = scopeAreaGroupKey(cur, contextAreaDocId);
  const prev = idx > 0 ? rows[idx - 1] : null;
  const next = idx < rows.length - 1 ? rows[idx + 1] : null;
  return {
    disabledUp: !prev || scopeAreaGroupKey(prev, contextAreaDocId) !== k,
    disabledDown: !next || scopeAreaGroupKey(next, contextAreaDocId) !== k,
  };
}

type ScopesPanelProps = {
  /** Open this scope in the edit form once scopes have loaded (Setup deep link). */
  initialScopeDocId?: string | null;
  onConsumedInitialScopeId?: () => void;
};

export function ScopesPanel({
  initialScopeDocId = null,
  onConsumedInitialScopeId,
}: ScopesPanelProps = {}) {
  const [scopes, setScopes] = useState<ScopePublic[]>([]);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [quoteObjects, setQuoteObjects] = useState<QuoteObjectPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(() => new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [selectedScopeRowId, setSelectedScopeRowId] = useState<string | null>(null);
  const [areaFilterAreaDocId, setAreaFilterAreaDocId] = useState("");
  const areaFilterHydrated = useRef(false);
  const consumedInitialScopeRef = useRef(false);

  const setAreaFilterAndPersist = useCallback((next: string) => {
    setAreaFilterAreaDocId(next);
    try {
      if (next) sessionStorage.setItem(SCOPES_AREA_FILTER_STORAGE_KEY, next);
      else sessionStorage.removeItem(SCOPES_AREA_FILTER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const areasForFilter = useMemo(() => {
    return [...areas].sort((a, b) => {
      const ao = a.sortOrder;
      const bo = b.sortOrder;
      const aHas = typeof ao === "number" && Number.isFinite(ao);
      const bHas = typeof bo === "number" && Number.isFinite(bo);
      if (aHas && bHas && ao !== bo) return ao - bo;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.areaname.localeCompare(b.areaname, undefined, { sensitivity: "base" });
    });
  }, [areas]);

  const filteredScopes = useMemo(() => {
    if (!areaFilterAreaDocId) return scopes;
    return scopes
      .filter((s) => s.areaDocIds.includes(areaFilterAreaDocId))
      .sort((a, b) => {
        const ao = sortOrderInArea(a, areaFilterAreaDocId);
        const bo = sortOrderInArea(b, areaFilterAreaDocId);
        if (ao !== bo) return ao - bo;
        return (a.scopeid ?? 0) - (b.scopeid ?? 0) || a.id.localeCompare(b.id);
      });
  }, [scopes, areaFilterAreaDocId]);

  const allVisibleSelected =
    filteredScopes.length > 0 && filteredScopes.every((s) => selectedDeleteIds.has(s.id));
  const someVisibleSelected = filteredScopes.some((s) => selectedDeleteIds.has(s.id));

  const toggleSelectForDelete = (id: string) => {
    setSelectedDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSelectAllVisibleForDelete = (checked: boolean) => {
    if (!checked) {
      setSelectedDeleteIds((prev) => {
        const next = new Set(prev);
        for (const s of filteredScopes) next.delete(s.id);
        return next;
      });
      return;
    }
    setSelectedDeleteIds((prev) => {
      const next = new Set(prev);
      for (const s of filteredScopes) next.add(s.id);
      return next;
    });
  };

  const reorderContextAreaDocId = areaFilterAreaDocId.trim() || null;

  const getReorderExtraBody = useCallback(() => {
    return reorderContextAreaDocId ? { contextAreaDocId: reorderContextAreaDocId } : {};
  }, [reorderContextAreaDocId]);

  const editingScope = useMemo(
    () => (editingId ? scopes.find((s) => s.id === editingId) ?? null : null),
    [editingId, scopes],
  );

  const loadScopes = useCallback(async () => {
    const res = await fetch("/api/scopes");
    const data = await readApiJson<{ scopes?: ScopePublic[]; error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to load scopes");
    setScopes(data.scopes ?? []);
  }, []);

  const scopeReorder = useTemplateReorder("/api/scopes/reorder", loadScopes, (msg) =>
    setError(msg),
    { getExtraBody: getReorderExtraBody },
  );

  const loadQuoteObjects = useCallback(async (): Promise<QuoteObjectPublic[]> => {
    const quoteRes = await fetch("/api/quote-objects");
    const quoteData = await readApiJson<{ quoteObjects?: QuoteObjectPublic[]; error?: string }>(
      quoteRes,
    );
    if (!quoteRes.ok) throw new Error(quoteData.error ?? "Failed to load quote objects");
    const list = quoteData.quoteObjects ?? [];
    setQuoteObjects(list);
    return list;
  }, []);

  const loadSupporting = useCallback(async () => {
    const areasRes = await fetch("/api/areas");
    const areasData = await readApiJson<{ areas?: AreaPublic[]; error?: string }>(areasRes);
    if (!areasRes.ok) throw new Error(areasData.error ?? "Failed to load areas");
    setAreas(areasData.areas ?? []);
    await loadQuoteObjects();
  }, [loadQuoteObjects]);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/scopes/init", { method: "POST" });
        const initData = await readApiJson<{ error?: string }>(initRes);
        if (!initRes.ok) {
          setError(initData.error ?? "Failed to initialize scopes collection in Firestore");
          setScopes([]);
          return;
        }
        await Promise.all([loadScopes(), loadSupporting()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setScopes([]);
      } finally {
        setLoading(false);
      }
    }
    void bootstrapThenLoad();
  }, [loadScopes, loadSupporting]);

  useEffect(() => {
    if (areas.length === 0 || areaFilterHydrated.current) return;
    areaFilterHydrated.current = true;
    try {
      const stored = sessionStorage.getItem(SCOPES_AREA_FILTER_STORAGE_KEY);
      if (stored && areas.some((a) => a.id === stored)) {
        setAreaFilterAndPersist(stored);
        return;
      }
    } catch {
      /* ignore */
    }
    if (areas.length === 1) {
      setAreaFilterAndPersist(areas[0].id);
    }
  }, [areas, setAreaFilterAndPersist]);

  useEffect(() => {
    if (!initialScopeDocId || loading || consumedInitialScopeRef.current) return;
    consumedInitialScopeRef.current = true;
    const hit = scopes.find((s) => s.id === initialScopeDocId);
    if (!hit) {
      onConsumedInitialScopeId?.();
      return;
    }
    const areaForFilter = hit.areaDocIds[0]?.trim();
    if (areaForFilter && areas.some((a) => a.id === areaForFilter)) {
      setAreaFilterAndPersist(areaForFilter);
    }
    setSelectedScopeRowId(hit.id);
    openEdit(hit);
    onConsumedInitialScopeId?.();
  }, [
    initialScopeDocId,
    loading,
    scopes,
    areas,
    setAreaFilterAndPersist,
    onConsumedInitialScopeId,
  ]);

  function openCreate() {
    setEditingId(null);
    setMode("create");
  }

  function openCreateHeader() {
    setEditingId(null);
    setMode("create-header");
  }

  function openEdit(s: ScopePublic) {
    setEditingId(s.id);
    setMode(scopeFormModeForScope(s));
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
  }

  async function confirmDelete() {
    const ids = pendingDeleteIds ?? [];
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    let removed = 0;
    const failures: string[] = [];
    try {
      for (const id of ids) {
        const res = await fetch(`/api/scopes/${encodeURIComponent(id)}`, { method: "DELETE" });
        const data = await readApiJson<{ error?: string }>(res);
        if (!res.ok) {
          failures.push(data.error ?? "Delete failed");
          continue;
        }
        removed += 1;
      }
      setPendingDeleteIds(null);
      setSelectedDeleteIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (selectedScopeRowId && ids.includes(selectedScopeRowId)) {
        setSelectedScopeRowId(null);
      }
      if (editingId && ids.includes(editingId)) closeForm();
      await loadScopes();
      if (failures.length) {
        throw new Error(
          failures.length === ids.length
            ? failures[0]!
            : `${removed} deleted, ${failures.length} failed: ${failures[0]}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Scopes</h2>
          <p className={sfSectionLead}>
            Scope questions can attach to one or many template areas (same answers everywhere). Use{" "}
            <span className="font-medium">All template areas</span> to snapshot every area at save time—new
            areas added later are not included automatically. Each answer links one or more quote objects from Setup → Quote Objects (grouped by object type). At project runtime, those rows are added as checklist lines; pricing still uses the project’s effective price level on each quote object.
            Use <span className="font-medium">Add header</span> for section titles only (no answers)—for
            example grouping kitchen questions under one block and appliances under another. A paired
            <span className="font-medium"> Footer </span>
            row is added under each new header so you can bracket a block (move the footer down with ↑
            ↓ to include more questions). Click a row to select it; new headers are inserted below the
            selected row when it belongs to the same area. Use the ↑ ↓ controls beside each row to set
            order within the area; that order is used on Check List and Workbench. Choose a
            specific area in the Area column to move rows with ↑ ↓ (disabled when viewing all areas).
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={selectedDeleteIds.size === 0 || saving || loading}
            onClick={() => setPendingDeleteIds([...selectedDeleteIds])}
            className={`${sfNeutralToolbarButton} text-red-700 disabled:opacity-50 dark:text-red-400`}
          >
            {selectedDeleteIds.size === 0
              ? "Delete selected"
              : `Delete selected (${selectedDeleteIds.size})`}
          </button>
          <button type="button" onClick={openCreateHeader} className={sfNeutralToolbarButton}>
            Add header
          </button>
          <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
            Add scope
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className={sfDataSurface}>
        {loading ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">Loading…</p>
        ) : scopes.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No scopes yet. Add one to create the{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              scopes
            </code>{" "}
            collection in Firestore.
          </p>
        ) : (
          <>
            {selectedDeleteIds.size > 0 ? (
              <p className="border-b border-sf-border px-4 py-2 text-sm text-sf-text-secondary dark:border-zinc-700/80 dark:text-zinc-400 md:px-5">
                {selectedDeleteIds.size} scope{selectedDeleteIds.size === 1 ? "" : "s"} selected
              </p>
            ) : null}
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="w-10 px-2 py-3 md:px-3 md:py-4">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                      }}
                      onChange={(e) => setSelectAllVisibleForDelete(e.target.checked)}
                      disabled={filteredScopes.length === 0}
                      aria-label="Select all visible scopes"
                      className="size-4 rounded border-sf-border"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Scope ID</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Type</th>
                  <th className="px-4 py-3 align-bottom font-semibold md:px-5 md:py-4">
                    <div className="flex flex-col gap-2">
                      <span>Area</span>
                      <label className="sr-only" htmlFor="scopes-area-filter">
                        Show scopes for area
                      </label>
                      <select
                        id="scopes-area-filter"
                        value={areaFilterAreaDocId}
                        onChange={(e) => setAreaFilterAndPersist(e.target.value)}
                        className="min-h-9 w-full min-w-[10rem] rounded-md border border-sf-border-strong bg-sf-surface px-2 py-1.5 text-xs font-normal text-sf-text dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                      >
                        <option value="">All areas</option>
                        {areasForFilter.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.areaname}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Question</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Answers</th>
                  <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredScopes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sf-text-secondary md:px-5 dark:text-zinc-400"
                    >
                      No scopes match this area filter. Choose another area above.
                    </td>
                  </tr>
                ) : null}
                {filteredScopes.map((s, idx) => {
                  const qLabel = (s.question ?? "").trim() || `Scope ${s.scopeid ?? ""}`;
                  const edges = scopeReorderEdges(
                    filteredScopes,
                    idx,
                    reorderContextAreaDocId,
                  );
                  const checkedForDelete = selectedDeleteIds.has(s.id);
                  return (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    role="row"
                    aria-selected={selectedScopeRowId === s.id}
                    onClick={() =>
                      setSelectedScopeRowId((cur) => (cur === s.id ? null : s.id))
                    }
                    onKeyDown={(e) => scopeReorder.onRowKeyDown(s.id, e)}
                    aria-label={`${qLabel}. Arrow keys also reorder.`}
                    className={`cursor-pointer border-b border-sf-border last:border-0 outline-none focus-visible:bg-sf-page focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sf-brand/40 dark:border-zinc-700/80 dark:focus-visible:bg-zinc-800/40 dark:focus-visible:ring-sf-brand/40 ${
                      selectedScopeRowId === s.id
                        ? "bg-teal-50/70 dark:bg-teal-950/35"
                        : checkedForDelete
                          ? "bg-sf-page/80 dark:bg-zinc-800/50"
                          : ""
                    }`}
                  >
                    <td
                      className="px-2 py-3 md:px-3 md:py-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checkedForDelete}
                        onChange={() => toggleSelectForDelete(s.id)}
                        aria-label={`Select ${qLabel} for delete`}
                        className="size-4 rounded border-sf-border"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm md:px-5 md:py-3.5">
                      {s.scopeid ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm md:px-5 md:py-3.5">
                      {s.kind === "header" ? (
                        <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-xs font-medium text-sf-text dark:bg-zinc-700 dark:text-zinc-100">
                          Header
                        </span>
                      ) : s.kind === "footer" ? (
                        <span className="rounded-md bg-teal-200/90 px-2 py-0.5 text-xs font-medium text-teal-950 dark:bg-teal-900/80 dark:text-teal-100">
                          Footer
                        </span>
                      ) : (
                        <span className="text-sf-text-secondary dark:text-zinc-400">Question</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">
                      <span className="line-clamp-2" title={s.areaNamesDisplay ?? s.areaname}>
                        {s.areaNamesDisplay || s.areaname || `Area #${s.areaid}`}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 md:px-5 md:py-3.5" title={s.question}>
                      <div
                        className="flex w-full min-w-0 items-center justify-between gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="min-w-0 truncate">{s.question || "—"}</span>
                        <ReorderArrows
                          dense
                          itemLabel={qLabel}
                          onUp={() => void scopeReorder.moveRow(s.id, "up")}
                          onDown={() => void scopeReorder.moveRow(s.id, "down")}
                          disabledUp={!reorderContextAreaDocId || edges.disabledUp}
                          disabledDown={!reorderContextAreaDocId || edges.disabledDown}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">
                      {s.kind === "header" || s.kind === "footer"
                        ? "—"
                        : s.answers.length}
                    </td>
                    <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                      <div
                        className="flex justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className={sfRowIconBtn}
                          aria-label="Edit scope"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteIds([s.id])}
                          className={sfRowIconBtnDanger}
                          aria-label="Delete scope"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {mode !== "idle" ? (
        <ScopeFormModal
          open
          mode={mode}
          scope={editingScope}
        areas={areas}
        quoteObjects={quoteObjects}
        scopes={scopes}
        selectedScopeRowId={selectedScopeRowId}
        defaultAreaDocIds={areaFilterAreaDocId ? [areaFilterAreaDocId] : []}
        onClose={closeForm}
        onSaved={async () => {
          await loadScopes();
          setSelectedScopeRowId(null);
        }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDeleteIds?.length)}
        title={
          (pendingDeleteIds?.length ?? 0) > 1
            ? `Delete ${pendingDeleteIds!.length} scopes?`
            : "Delete scope?"
        }
        description={
          (pendingDeleteIds?.length ?? 0) > 1
            ? "This removes the selected scope questions and all answer mappings. Project checklist data is not changed."
            : "This removes the scope question and all answer mappings. Project checklist data is not changed."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        pending={saving}
        onCancel={() => setPendingDeleteIds(null)}
        onConfirm={() => void confirmDelete()}
      />


    </div>
  );
}
