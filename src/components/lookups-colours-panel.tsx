"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { LookupColourPublic } from "@/types/lookup-colour-public";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "idle" | "create" | "edit";

type SortColumn = "id" | "class" | "descriptor";

type ActiveSort = { col: SortColumn; dir: "asc" | "desc" } | null;

function numToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function cmpLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function distinctSorted(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    set.add(t || "(blank)");
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function LookupsColoursPanel() {
  const [rows, setRows] = useState<LookupColourPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [category, setCategory] = useState("Colour");
  const [colourClass, setColourClass] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [notes, setNotes] = useState("");

  const [filterClass, setFilterClass] = useState("");
  const [filterDescriptor, setFilterDescriptor] = useState("");
  const [activeSort, setActiveSort] = useState<ActiveSort>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lookups-colours");
      const data = (await res.json()) as {
        items?: LookupColourPublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load colour lookups");
      setRows(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load colour lookups");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/lookups-colours/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(initData.error ?? "Failed to initialize lookups_colours");
          setRows([]);
          setLoading(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setRows([]);
        setLoading(false);
        return;
      }
      await load();
    }
    void bootstrapThenLoad();
  }, [load]);

  const classOptions = useMemo(
    () => distinctSorted(rows.map((r) => r.colourClass)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const dq = filterDescriptor.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterClass && (r.colourClass.trim() || "(blank)") !== filterClass) return false;
      if (dq && !r.descriptor.toLowerCase().includes(dq)) return false;
      return true;
    });
  }, [rows, filterClass, filterDescriptor]);

  const displayRows = useMemo(() => {
    const copy = [...filteredRows];
    if (!activeSort) {
      copy.sort(
        (a, b) =>
          cmpLocale(a.colourClass, b.colourClass) ||
          cmpLocale(a.descriptor, b.descriptor),
      );
      return copy;
    }
    const { col, dir } = activeSort;
    const mult = dir === "asc" ? 1 : -1;
    if (col === "id") {
      copy.sort((a, b) => mult * (a.colourLookupId - b.colourLookupId));
    } else if (col === "class") {
      copy.sort((a, b) => mult * cmpLocale(a.colourClass, b.colourClass));
    } else {
      copy.sort((a, b) => mult * cmpLocale(a.descriptor, b.descriptor));
    }
    return copy;
  }, [filteredRows, activeSort]);

  function toggleColumnSort(col: SortColumn) {
    setActiveSort((cur) => {
      if (cur?.col !== col) return { col, dir: "asc" };
      if (cur.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  }

  function sortIndicator(col: SortColumn): string {
    if (activeSort?.col !== col) return "↕";
    return activeSort.dir === "asc" ? "↑" : "↓";
  }

  function openCreate() {
    setEditingId(null);
    setCategory("Colour");
    setColourClass("");
    setDescriptor("");
    setNotes("");
    setMode("create");
  }

  function openEdit(r: LookupColourPublic) {
    setEditingId(r.id);
    setCategory(r.category || "Colour");
    setColourClass(r.colourClass);
    setDescriptor(r.descriptor);
    setNotes(r.notes ?? "");
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { category, colourClass, descriptor, notes };
      if (mode === "create") {
        const res = await fetch("/api/lookups-colours", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data),
          );
        }
      } else if (mode === "edit" && editingId) {
        const res = await fetch(`/api/lookups-colours/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data),
          );
        }
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookups-colours/${deleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      setDeleteId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";
  const filterInputClass =
    "min-h-10 w-full rounded-md border border-sf-border-strong bg-sf-surface px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";
  const headerBtnClass =
    "flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-sm font-semibold text-sf-text hover:bg-sf-page dark:text-zinc-100 dark:hover:bg-zinc-800 md:text-base";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Colours lookups</h2>
          <p className={sfSectionLead}>
            Colour codes by class (Heritage, Modern, All) from the Master Prices Lists sheet.
            Import via Import → Import Lists, or add rows here.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add colour
        </button>
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
        ) : rows.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No colour lookups yet. Run <strong>Import Lists</strong> on Import Master Prices, or
            add a row here.
          </p>
        ) : (
          <>
            <p className="border-b border-sf-border px-4 py-2 text-sm text-sf-text-secondary dark:border-zinc-700/80 dark:text-zinc-400 md:px-5">
              {filteredRows.length === rows.length
                ? `${rows.length} colour lookup${rows.length === 1 ? "" : "s"}`
                : `Showing ${filteredRows.length} of ${rows.length} matching filters`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm md:text-base">
                <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 md:px-5 md:py-3">
                      <button
                        type="button"
                        onClick={() => toggleColumnSort("id")}
                        className={headerBtnClass}
                      >
                        <span>ID</span>
                        <span className="font-mono text-xs text-sf-text-weak" aria-hidden>
                          {sortIndicator("id")}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-2 md:px-5 md:py-3">Category</th>
                    <th className="px-4 py-2 md:px-5 md:py-3">
                      <button
                        type="button"
                        onClick={() => toggleColumnSort("class")}
                        className={headerBtnClass}
                      >
                        <span>Class</span>
                        <span className="font-mono text-xs text-sf-text-weak" aria-hidden>
                          {sortIndicator("class")}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-2 md:px-5 md:py-3">
                      <button
                        type="button"
                        onClick={() => toggleColumnSort("descriptor")}
                        className={headerBtnClass}
                      >
                        <span>Descriptor</span>
                        <span className="font-mono text-xs text-sf-text-weak" aria-hidden>
                          {sortIndicator("descriptor")}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-2 md:px-5 md:py-3">Note</th>
                    <th className="px-4 py-3 text-right md:px-5 md:py-4">Actions</th>
                  </tr>
                  <tr className="border-b border-sf-border bg-sf-page/95 dark:border-zinc-700 dark:bg-zinc-900/90">
                    <th className="px-4 pb-3 pt-0 md:px-5" aria-hidden />
                    <th className="px-4 pb-3 pt-0 md:px-5" aria-hidden />
                    <th className="px-4 pb-3 pt-0 align-top md:px-5">
                      <select
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        className={filterInputClass}
                        aria-label="Filter by class"
                      >
                        <option value="">All classes</option>
                        {classOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </th>
                    <th className="px-4 pb-3 pt-0 align-top md:px-5">
                      <input
                        type="search"
                        value={filterDescriptor}
                        onChange={(e) => setFilterDescriptor(e.target.value)}
                        placeholder="Filter descriptor…"
                        className={filterInputClass}
                        aria-label="Filter by descriptor"
                      />
                    </th>
                    <th className="px-4 pb-3 pt-0 md:px-5" colSpan={2} aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sf-text-secondary dark:text-zinc-400"
                      >
                        No rows match filters.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                      >
                        <td className="px-4 py-3 font-mono text-sm md:px-5">
                          {numToInput(r.colourLookupId)}
                        </td>
                        <td className="px-4 py-3 md:px-5">{r.category || "—"}</td>
                        <td className="px-4 py-3 font-medium md:px-5">{r.colourClass || "—"}</td>
                        <td className="px-4 py-3 font-mono text-sm md:px-5">{r.descriptor}</td>
                        <td className="max-w-xs px-4 py-3 text-sf-text-secondary md:px-5">
                          {r.notes?.trim() ? r.notes : "—"}
                        </td>
                        <td className="px-4 py-3 text-right md:px-5">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className={sfRowIconBtn}
                              aria-label="Edit colour lookup"
                            >
                              <IconPencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(r.id)}
                              className={sfRowIconBtnDanger}
                              aria-label="Delete colour lookup"
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {(mode === "create" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 className="text-lg font-semibold">
                {mode === "create" ? "New colour lookup" : "Edit colour lookup"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              {mode === "edit" && editingId ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary">
                    Colour lookup ID
                  </span>
                  <input
                    readOnly
                    value={numToInput(rows.find((x) => x.id === editingId)?.colourLookupId)}
                    className={`${inputClass} bg-sf-page dark:bg-zinc-900`}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary">
                  Category
                </span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary">
                  Class
                </span>
                <input
                  required
                  value={colourClass}
                  onChange={(e) => setColourClass(e.target.value)}
                  className={inputClass}
                  placeholder="Heritage, Modern, All…"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary">
                  Descriptor
                </span>
                <input
                  required
                  value={descriptor}
                  onChange={(e) => setDescriptor(e.target.value)}
                  className={inputClass}
                  placeholder="BN-H, BL, All…"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary">
                  Note
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={`${inputClass} min-h-[4.5rem] resize-y`}
                />
              </label>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Delete colour lookup?</h2>
            <p className="mt-2 text-sm text-sf-text-secondary">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="min-h-10 rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmDelete()}
                className="min-h-10 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
