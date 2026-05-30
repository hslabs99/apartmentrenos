"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CreateScopesFromDataObjectsModal } from "@/components/create-scopes-from-data-objects-modal";
import { readApiJson } from "@/lib/client/read-api-json";
import { scopeBuilderRowsFromDataObjects } from "@/lib/client/scope-builder-selection";
import { scopeLinksForDataObject } from "@/lib/client/scope-questions-for-data-object";
import {
  ScopeFormModal,
} from "@/components/scope-form-modal";
import { resolveQuoteObjectDocId } from "@/lib/client/resolve-quote-object-doc-id";
import { sfDataSurface, sfNeutralToolbarButton, sfPrimaryToolbarButton } from "@/lib/sf-layout";
import type { AreaPublic } from "@/types/area";
import type { DataObjectPublic } from "@/types/data-object-public";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  refreshKey?: number;
  /** Opens parent confirm to empty `data_objects` (Import tab). */
  onRequestEmpty?: () => void;
  emptying?: boolean;
};

const EMPTY_FILTER = "";

function distinctSorted(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    set.add(t || "(blank)");
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function fieldLabel(value: string): string {
  return value.trim() || "(blank)";
}

/** Quote object already exists for this category + product type. */
function hasQuoteObject(row: DataObjectPublic): boolean {
  return row.objectid != null || Boolean(row.quoteObjectDocId?.trim());
}

function rowStatusClass(hasQuote: boolean, checked: boolean): string {
  const tone = hasQuote
    ? "bg-green-50 dark:bg-green-950/45"
    : "bg-red-50 dark:bg-red-950/45";
  const selected = checked ? " ring-2 ring-inset ring-sf-brand/80 dark:ring-[#58a9f5]/80" : "";
  return `border-b border-sf-border/80 dark:border-zinc-700/80 ${tone}${selected}`;
}

const selectClass =
  "min-h-9 w-full min-w-[8rem] rounded border border-sf-border bg-sf-surface px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900";

export function DataObjectsTablePanel({
  refreshKey = 0,
  onRequestEmpty,
  emptying = false,
}: Props) {
  const [rows, setRows] = useState<DataObjectPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(EMPTY_FILTER);
  const [productTypeFilter, setProductTypeFilter] = useState(EMPTY_FILTER);
  const [scopes, setScopes] = useState<ScopePublic[]>([]);
  const [quoteObjects, setQuoteObjects] = useState<QuoteObjectPublic[]>([]);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [createScopesOpen, setCreateScopesOpen] = useState(false);
  const [editScopeDocId, setEditScopeDocId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [objRes, scopeRes, qoRes, areasRes] = await Promise.all([
        fetch("/api/data-objects"),
        fetch("/api/scopes"),
        fetch("/api/quote-objects"),
        fetch("/api/areas"),
      ]);
      const objData = await readApiJson<{ items: DataObjectPublic[]; error?: string }>(objRes);
      const scopeData = await readApiJson<{ scopes?: ScopePublic[]; error?: string }>(scopeRes);
      const qoData = await readApiJson<{ quoteObjects?: QuoteObjectPublic[]; error?: string }>(
        qoRes,
      );
      const areasData = await readApiJson<{ areas?: AreaPublic[]; error?: string }>(areasRes);
      if (!objRes.ok) throw new Error(objData.error ?? "Failed to load data_objects");
      if (!scopeRes.ok) throw new Error(scopeData.error ?? "Failed to load scopes");
      if (!qoRes.ok) throw new Error(qoData.error ?? "Failed to load quote objects");
      if (!areasRes.ok) throw new Error(areasData.error ?? "Failed to load areas");
      setRows(objData.items ?? []);
      setScopes(scopeData.scopes ?? []);
      setQuoteObjects(qoData.quoteObjects ?? []);
      setAreas(areasData.areas ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data_objects");
      setRows([]);
      setScopes([]);
      setQuoteObjects([]);
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const categoryOptions = useMemo(
    () => distinctSorted(rows.map((r) => r.category)),
    [rows],
  );

  const productTypeOptions = useMemo(() => {
    const pool = categoryFilter
      ? rows.filter((r) => fieldLabel(r.category) === categoryFilter)
      : rows;
    return distinctSorted(pool.map((r) => r.productType));
  }, [rows, categoryFilter]);

  const displayRows = useMemo(() => {
    let list = rows;
    if (categoryFilter) {
      list = list.filter((r) => fieldLabel(r.category) === categoryFilter);
    }
    if (productTypeFilter) {
      list = list.filter((r) => fieldLabel(r.productType) === productTypeFilter);
    }
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.category.toLowerCase().includes(q) ||
        r.productType.toLowerCase().includes(q) ||
        r.uom.toLowerCase().includes(q) ||
        String(r.objectid ?? "").includes(q),
    );
  }, [rows, filter, categoryFilter, productTypeFilter]);

  const hasColumnFilters = Boolean(categoryFilter || productTypeFilter);

  const visibleStats = useMemo(() => {
    let withQuote = 0;
    let needsCreate = 0;
    for (const r of displayRows) {
      if (hasQuoteObject(r)) withQuote++;
      else needsCreate++;
    }
    return { withQuote, needsCreate };
  }, [displayRows]);

  const allVisibleSelected =
    displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.id));
  const someVisibleSelected = displayRows.some((r) => selectedIds.has(r.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of displayRows) next.delete(r.id);
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of displayRows) next.add(r.id);
      return next;
    });
  };

  const selectNeedsCreateVisible = () => {
    setSelectedIds(new Set(displayRows.filter((r) => !hasQuoteObject(r)).map((r) => r.id)));
  };

  const selectWithQuoteObjectVisible = () => {
    setSelectedIds(new Set(displayRows.filter((r) => hasQuoteObject(r)).map((r) => r.id)));
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  const allSelectedHaveQuoteObject = useMemo(
    () => selectedRows.length > 0 && selectedRows.every((r) => hasQuoteObject(r)),
    [selectedRows],
  );

  const refreshScopes = useCallback(async () => {
    const scopeRes = await fetch("/api/scopes");
    const scopeData = await readApiJson<{ scopes?: ScopePublic[]; error?: string }>(scopeRes);
    if (!scopeRes.ok) throw new Error(scopeData.error ?? "Failed to load scopes");
    setScopes(scopeData.scopes ?? []);
  }, []);

  const selectionRowsForScopes = useMemo(
    () => scopeBuilderRowsFromDataObjects(selectedRows, quoteObjects),
    [selectedRows, quoteObjects],
  );

  function openCreateScopesModal() {
    if (selectedRows.length === 0) return;
    if (!allSelectedHaveQuoteObject) {
      setError(
        "Create scopes requires every selected row to have a quote object. Use “Select with quote object” or deselect red rows.",
      );
      return;
    }
    setError(null);
    setCreateScopesOpen(true);
  }

  function onScopesCreated(newScopes: ScopePublic[]) {
    setScopes((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      for (const s of newScopes) byId.set(s.id, s);
      return [...byId.values()].sort((a, b) =>
        (a.question ?? "").localeCompare(b.question ?? "", undefined, { sensitivity: "base" }),
      );
    });
    setActionMessage(
      `${newScopes.length} scope${newScopes.length === 1 ? "" : "s"} created. Scopes column updated.`,
    );
  }

  const updateRow = useCallback((updated: DataObjectPublic) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setDeletingSelected(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/data-objects/delete-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await readApiJson<{
        ok?: boolean;
        error?: string;
        deleted?: number;
        notFound?: number;
      }>(res);
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Delete failed");
      }
      const deleted = data.deleted ?? 0;
      const notFound = data.notFound ?? 0;
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setActionMessage(
        notFound > 0
          ? `Deleted ${deleted} row(s); ${notFound} not found.`
          : `Deleted ${deleted} row(s).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingSelected(false);
      setDeleteConfirmOpen(false);
    }
  }

  async function createQuoteObjects() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setCreating(true);
    setCreateProgress({ done: 0, total: ids.length });
    setActionMessage(null);
    setError(null);
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]!;
        try {
          const res = await fetch(
            `/api/data-objects/${encodeURIComponent(id)}/create-quote-object`,
            { method: "POST" },
          );
          const data = await readApiJson<{
            action?: "created" | "updated";
            error?: string;
            dataObject?: DataObjectPublic;
          }>(res);
          if (!res.ok) throw new Error(data.error ?? "Create quote object failed");
          if (data.dataObject) updateRow(data.dataObject);
          if (data.action === "updated") updated++;
          else created++;
        } catch (e) {
          failed++;
          const msg = e instanceof Error ? e.message : "Failed";
          if (errors.length < 3) errors.push(msg);
        }
        setCreateProgress({ done: i + 1, total: ids.length });
      }

      const parts: string[] = [];
      if (created) parts.push(`${created} created`);
      if (updated) parts.push(`${updated} updated`);
      if (failed) parts.push(`${failed} failed`);
      setActionMessage(parts.length ? parts.join(", ") + "." : "Done.");
      if (failed && errors.length) {
        setError(errors.join("; "));
      }
    } finally {
      setCreating(false);
      setCreateProgress(null);
    }
  }

  return (
    <div className="-mx-4 flex flex-col gap-4 md:-mx-6 lg:-mx-8">
      <section className={`${sfDataSurface} mx-4 flex flex-col gap-4 p-4 md:mx-6 md:p-5 lg:mx-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
              Data objects
            </h2>
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              {loading
                ? "Loading…"
                : `Showing ${displayRows.length} of ${rows.length} category + product type line(s)`}
              {hasColumnFilters || filter.trim() ? " (filtered)" : ""}
              {!loading && displayRows.length > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-green-800 dark:text-green-400">
                    {visibleStats.withQuote} with quote object
                  </span>
                  {" · "}
                  <span className="text-red-800 dark:text-red-400">
                    {visibleStats.needsCreate} need create
                  </span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-sf-text-weak dark:text-zinc-500">
              Each row is a unique category and product type (e.g. Appliance · Hob). Green = matching
              quote object exists; red = not linked yet. Scopes lists scope question text for any
              scope that references this object on any answer. Click a question to edit the scope
              here (question, answers, attached quote objects).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasColumnFilters || filter.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter(EMPTY_FILTER);
                  setProductTypeFilter(EMPTY_FILTER);
                  setFilter("");
                }}
                className="inline-flex min-h-10 items-center rounded border border-sf-border px-3 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Clear filters
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading || displayRows.length === 0}
              onClick={selectNeedsCreateVisible}
              className="inline-flex min-h-10 items-center rounded border border-sf-border px-3 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Select need create
            </button>
            <button
              type="button"
              disabled={loading || displayRows.length === 0}
              onClick={selectWithQuoteObjectVisible}
              className="inline-flex min-h-10 items-center rounded border border-sf-border px-3 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Select with quote object
            </button>
            {onRequestEmpty ? (
              <button
                type="button"
                disabled={loading || emptying}
                onClick={onRequestEmpty}
                className={`${sfNeutralToolbarButton} text-red-700 dark:text-red-400`}
              >
                {emptying ? "Emptying…" : "Empty table"}
              </button>
            ) : null}
            <button type="button" onClick={() => void load()} className={sfPrimaryToolbarButton}>
              Refresh
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || creating || deletingSelected || loading}
              onClick={() => setDeleteConfirmOpen(true)}
              className={`${sfNeutralToolbarButton} text-red-700 dark:text-red-400`}
            >
              {deletingSelected
                ? "Deleting…"
                : selectedIds.size === 0
                  ? "Delete selected"
                  : `Delete selected (${selectedIds.size})`}
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || creating || deletingSelected}
              onClick={() => void createQuoteObjects()}
              className={sfPrimaryToolbarButton}
            >
              {creating && createProgress
                ? `Working… ${createProgress.done}/${createProgress.total}`
                : selectedIds.size === 0
                  ? "Create quote object(s)"
                  : `Create quote object(s) (${selectedIds.size})`}
            </button>
            <button
              type="button"
              disabled={
                selectedIds.size === 0 || !allSelectedHaveQuoteObject || creating || deletingSelected
              }
              title={
                !allSelectedHaveQuoteObject && selectedIds.size > 0
                  ? "All selected rows must have a quote object (green)"
                  : undefined
              }
              onClick={openCreateScopesModal}
              className={sfPrimaryToolbarButton}
            >
              {selectedIds.size === 0
                ? "Create scope(s)…"
                : `Create scope(s)… (${selectionRowsForScopes.length})`}
            </button>
          </div>
        </div>

        <label className="flex max-w-md flex-col gap-1 text-sm">
          <span className="text-sf-text-secondary dark:text-zinc-400">Search</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Category, product type, UOM…"
            className="min-h-10 rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>

        {actionMessage ? (
          <p className="text-sm text-green-800 dark:text-green-300" role="status">
            {actionMessage}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-800 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className={`${sfDataSurface} mx-4 overflow-hidden md:mx-6 lg:mx-8`}>
        <div className="max-h-[calc(100dvh-14rem)] overflow-auto px-4 py-3 md:px-5 lg:px-6">
          <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-sm">
            <colgroup>
              <col className="w-10" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-sf-surface dark:bg-zinc-900">
              <tr className="border-b border-sf-border/60 dark:border-zinc-700/80">
                <th className="py-1.5 pr-2" aria-hidden />
                <th className="py-1.5 pr-2 align-bottom">
                  <label className="flex flex-col gap-0.5 text-xs font-normal text-sf-text-secondary dark:text-zinc-400">
                    <span>Filter</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        setCategoryFilter(e.target.value);
                        setProductTypeFilter(EMPTY_FILTER);
                      }}
                      disabled={loading}
                      className={`${selectClass} min-w-0`}
                      aria-label="Filter by category"
                    >
                      <option value={EMPTY_FILTER}>All</option>
                      {categoryOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                </th>
                <th className="py-1.5 pr-2 align-bottom">
                  <label className="flex flex-col gap-0.5 text-xs font-normal text-sf-text-secondary dark:text-zinc-400">
                    <span>Filter</span>
                    <select
                      value={productTypeFilter}
                      onChange={(e) => setProductTypeFilter(e.target.value)}
                      disabled={loading}
                      className={`${selectClass} min-w-0`}
                      aria-label="Filter by product type"
                    >
                      <option value={EMPTY_FILTER}>All</option>
                      {productTypeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                </th>
                <th className="py-1.5 pr-2" colSpan={2} aria-hidden />
                <th className="py-1.5 pr-2" aria-hidden />
              </tr>
              <tr className="border-b border-sf-border dark:border-zinc-700">
                <th className="py-2 pr-2 font-medium">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                    }}
                    onChange={(e) => setSelectAllVisible(e.target.checked)}
                    disabled={loading || displayRows.length === 0}
                    aria-label="Select all visible rows"
                    className="size-4 rounded border-sf-border"
                  />
                </th>
                <th className="py-2 pr-2 font-medium">Category</th>
                <th className="py-2 pr-2 font-medium">Product type</th>
                <th className="py-2 pr-2 font-medium">UOM</th>
                <th className="py-2 pr-2 font-medium">Quote object</th>
                <th className="py-2 pr-2 font-medium">Scopes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-sf-text-secondary dark:text-zinc-400">
                    Loading data_objects…
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-sf-text-secondary dark:text-zinc-400">
                    {rows.length === 0
                      ? "No data objects yet. Run Prepare Objects on the Import tab."
                      : "No rows match your filter."}
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const hasQuote = hasQuoteObject(row);
                  const checked = selectedIds.has(row.id);
                  const scopeLinks = scopeLinksForDataObject(
                    scopes,
                    quoteObjects,
                    row,
                  );
                  return (
                    <tr key={row.id} className={rowStatusClass(hasQuote, checked)}>
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(row.id)}
                          aria-label={`Select ${row.category} ${row.productType}`}
                          className="size-4 rounded border-sf-border"
                        />
                      </td>
                      <td className="truncate py-2 pr-2" title={row.category || undefined}>
                        {row.category || "—"}
                      </td>
                      <td
                        className="truncate py-2 pr-2 font-medium"
                        title={row.productType || undefined}
                      >
                        {row.productType || "—"}
                      </td>
                      <td className="truncate py-2 pr-2">{row.uom || "—"}</td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {row.objectid != null
                          ? `#${row.objectid}`
                          : row.quoteObjectDocId
                            ? "Linked"
                            : "—"}
                      </td>
                      <td className="py-2 pr-2 align-top text-xs leading-snug text-sf-text-secondary dark:text-zinc-300">
                        {scopeLinks.length === 0 ? (
                          <span className="text-sf-text-weak dark:text-zinc-500">—</span>
                        ) : (
                          <ul className="list-none space-y-1">
                            {scopeLinks.map((link) => (
                              <li key={link.scopeDocId}>
                                <button
                                  type="button"
                                  onClick={() => setEditScopeDocId(link.scopeDocId)}
                                  className="text-left font-medium text-sf-brand underline underline-offset-2 hover:text-sf-brand-hover dark:text-[#58a9f5] dark:hover:text-[#7ab8ff]"
                                  title="Edit scope"
                                >
                                  {link.question}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {selectedIds.size > 0 ? (
          <p className="border-t border-sf-border px-4 py-2 text-xs text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400 md:px-6">
            {selectedIds.size} row(s) selected
          </p>
        ) : null}
      </section>

      <CreateScopesFromDataObjectsModal
        open={createScopesOpen}
        selectionRows={selectionRowsForScopes}
        quoteObjects={quoteObjects}
        areas={areas}
        onClose={() => setCreateScopesOpen(false)}
        onCreated={onScopesCreated}
      />

      {editScopeDocId ? (
        <ScopeFormModal
          key={editScopeDocId}
          open
          scopeDocId={editScopeDocId}
          mode="edit"
          areas={areas}
          quoteObjects={quoteObjects}
          scopes={scopes}
          onClose={() => setEditScopeDocId(null)}
          onSaved={async () => {
            await refreshScopes();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={
          selectedIds.size > 1
            ? `Delete ${selectedIds.size} data objects?`
            : "Delete data object?"
        }
        description="Removes the selected row(s) from data_objects only. Linked quote_objects are not deleted. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        pending={deletingSelected}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void deleteSelected()}
      />
    </div>
  );
}
