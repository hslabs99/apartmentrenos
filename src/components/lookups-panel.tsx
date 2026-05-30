"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import {
  APPROVED_LOOKUP_TYPES,
  CREATABLE_LOOKUP_TYPES,
  LOOKUP_TYPE_OBJECT_CATEGORY,
  type ApprovedLookupType,
} from "@/lib/lookup-types";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { LookupPublic } from "@/types/lookup";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "idle" | "create" | "edit";

type SortColumn = "id" | "type" | "value";

type ActiveSort = { col: SortColumn; dir: "asc" | "desc" } | null;

function numToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function cmpLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function isApprovedType(t: string): t is ApprovedLookupType {
  return (APPROVED_LOOKUP_TYPES as readonly string[]).includes(t);
}

export function LookupsPanel() {
  const [lookups, setLookups] = useState<LookupPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [lookuptype, setLookuptype] = useState<ApprovedLookupType | "">("");
  const [lookupvalue, setLookupvalue] = useState("");
  const [notes, setNotes] = useState("");
  /** When editing a row whose stored type is not in the approved list. */
  const [legacyLookuptype, setLegacyLookuptype] = useState<string | null>(null);

  const [filterId, setFilterId] = useState("");
  const [filterType, setFilterType] = useState<"" | ApprovedLookupType>("");
  const [filterValue, setFilterValue] = useState("");
  const [activeSort, setActiveSort] = useState<ActiveSort>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lookups");
      const data = (await res.json()) as { lookups?: LookupPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load lookups");
      setLookups(data.lookups ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lookups");
      setLookups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const idq = filterId.trim().toLowerCase();
    const valq = filterValue.trim().toLowerCase();
    return lookups.filter((l) => {
      if (filterType && l.lookuptype !== filterType) return false;
      if (idq && !String(l.lookupid ?? "").toLowerCase().includes(idq)) return false;
      if (valq && !l.lookupvalue.toLowerCase().includes(valq)) return false;
      return true;
    });
  }, [lookups, filterId, filterType, filterValue]);

  const displayRows = useMemo(() => {
    const copy = [...filteredRows];
    const defaultSort = () => {
      copy.sort(
        (a, b) =>
          cmpLocale(a.lookuptype, b.lookuptype) || cmpLocale(a.lookupvalue, b.lookupvalue),
      );
    };
    if (!activeSort) {
      defaultSort();
      return copy;
    }
    const { col, dir } = activeSort;
    const mult = dir === "asc" ? 1 : -1;
    switch (col) {
      case "id":
        copy.sort((a, b) => mult * ((a.lookupid ?? 0) - (b.lookupid ?? 0)));
        break;
      case "type":
        copy.sort((a, b) => {
          const t = cmpLocale(a.lookuptype, b.lookuptype);
          if (t !== 0) return mult * t;
          return cmpLocale(a.lookupvalue, b.lookupvalue);
        });
        break;
      case "value":
        copy.sort((a, b) => {
          const t = cmpLocale(a.lookupvalue, b.lookupvalue);
          if (t !== 0) return mult * t;
          return cmpLocale(a.lookuptype, b.lookuptype);
        });
        break;
      default:
        defaultSort();
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

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/lookups/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(initData.error ?? "Failed to initialize lookups collection in Firestore");
          setLookups([]);
          setLoading(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setLookups([]);
        setLoading(false);
        return;
      }
      await load();
    }
    void bootstrapThenLoad();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setLookuptype(LOOKUP_TYPE_OBJECT_CATEGORY);
    setLookupvalue("");
    setNotes("");
    setLegacyLookuptype(null);
    setMode("create");
  }

  function openEdit(l: LookupPublic) {
    setEditingId(l.id);
    setLookupvalue(l.lookupvalue);
    setNotes(l.notes ?? "");
    if (isApprovedType(l.lookuptype)) {
      setLookuptype(l.lookuptype);
      setLegacyLookuptype(null);
    } else {
      setLookuptype("");
      setLegacyLookuptype(l.lookuptype);
    }
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
    setLegacyLookuptype(null);
  }

  function buildPayload(): Record<string, unknown> {
    if (!lookuptype) {
      throw new Error("Select a lookup type");
    }
    return {
      lookuptype,
      lookupvalue,
      notes,
    };
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (mode === "create") {
        const res = await fetch("/api/lookups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      } else if (mode === "edit" && editingId) {
        const res = await fetch(`/api/lookups/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
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
      const res = await fetch(`/api/lookups/${deleteId}`, { method: "DELETE" });
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
          <h2 className={sfSectionHeading}>General lookups</h2>
          <p className={sfSectionLead}>
            Object categories, trades, styles, UOM codes, and relationship types. Import UOM from
            Import Master Prices → Import Lists. Legacy <strong>Area</strong> rows may still appear.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add lookup
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
        ) : lookups.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No lookups yet. Add one to create the{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              lookups
            </code>{" "}
            collection in Firestore.
          </p>
        ) : (
          <>
            <p className="border-b border-sf-border px-4 py-2 text-sm text-sf-text-secondary dark:border-zinc-700/80 dark:text-zinc-400 md:px-5">
              {filteredRows.length === lookups.length
                ? `${lookups.length} lookup${lookups.length === 1 ? "" : "s"}`
                : `Showing ${filteredRows.length} of ${lookups.length} matching column filters`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm md:text-base">
                <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                  <tr>
                    <th scope="col" className="px-4 py-2 md:px-5 md:py-3">
                      <button
                        type="button"
                        onClick={() => toggleColumnSort("id")}
                        className={headerBtnClass}
                        aria-label="Sort by lookup ID"
                      >
                        <span>Lookup ID</span>
                        <span className="shrink-0 font-mono text-xs text-sf-text-weak" aria-hidden>
                          {sortIndicator("id")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-2 md:px-5 md:py-3">
                      <button
                        type="button"
                        onClick={() => toggleColumnSort("type")}
                        className={headerBtnClass}
                        aria-label="Sort by type"
                      >
                        <span>Type</span>
                        <span className="shrink-0 font-mono text-xs text-sf-text-weak" aria-hidden>
                          {sortIndicator("type")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-2 md:px-5 md:py-3">
                      <button
                        type="button"
                        onClick={() => toggleColumnSort("value")}
                        className={headerBtnClass}
                        aria-label="Sort by value"
                      >
                        <span>Value</span>
                        <span className="shrink-0 font-mono text-xs text-sf-text-weak" aria-hidden>
                          {sortIndicator("value")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-2 md:px-5 md:py-3">
                      Notes
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-sm font-semibold md:px-5 md:py-4"
                    >
                      Actions
                    </th>
                  </tr>
                  <tr className="border-b border-sf-border bg-sf-page/95 dark:border-zinc-700 dark:bg-zinc-900/90">
                    <th scope="col" className="px-4 pb-3 pt-0 align-top md:px-5">
                      <label className="block">
                        <span className="sr-only">Filter by lookup ID</span>
                        <input
                          type="search"
                          value={filterId}
                          onChange={(e) => setFilterId(e.target.value)}
                          placeholder="Filter ID…"
                          className={filterInputClass}
                          aria-label="Filter by lookup ID"
                        />
                      </label>
                    </th>
                    <th scope="col" className="px-4 pb-3 pt-0 align-top md:px-5">
                      <label className="block">
                        <span className="sr-only">Filter by type</span>
                        <select
                          value={filterType}
                          onChange={(e) =>
                            setFilterType(e.target.value as "" | ApprovedLookupType)
                          }
                          className={filterInputClass}
                          aria-label="Filter by lookup type"
                        >
                          <option value="">All types</option>
                          {APPROVED_LOOKUP_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                    </th>
                    <th scope="col" className="px-4 pb-3 pt-0 align-top md:px-5">
                      <label className="block">
                        <span className="sr-only">Filter by value</span>
                        <input
                          type="search"
                          value={filterValue}
                          onChange={(e) => setFilterValue(e.target.value)}
                          placeholder="Filter value…"
                          className={filterInputClass}
                          aria-label="Filter by lookup value"
                        />
                      </label>
                    </th>
                    <th scope="col" className="px-4 pb-3 pt-0 md:px-5" aria-hidden />
                    <th scope="col" className="px-4 pb-3 pt-0 md:px-5" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sf-text-secondary dark:text-zinc-400 md:px-5"
                      >
                        No lookups match the column filters. Clear filters or widen the search.
                      </td>
                    </tr>
                  ) : null}
                  {displayRows.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                    >
                      <td className="px-4 py-3 font-mono text-sm md:px-5 md:py-3.5">
                        {numToInput(l.lookupid)}
                      </td>
                      <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">{l.lookuptype}</td>
                      <td className="px-4 py-3 md:px-5 md:py-3.5">{l.lookupvalue}</td>
                      <td className="max-w-xs px-4 py-3 text-sf-text-secondary dark:text-zinc-300 md:px-5 md:py-3.5">
                        {l.notes?.trim() ? l.notes : "—"}
                      </td>
                      <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(l)}
                            className={sfRowIconBtn}
                            aria-label="Edit lookup"
                          >
                            <IconPencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(l.id)}
                            className={sfRowIconBtnDanger}
                            aria-label="Delete lookup"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
          aria-labelledby="lookup-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 id="lookup-form-title" className="text-lg font-semibold md:text-xl">
                {mode === "create" ? "New lookup" : "Edit lookup"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              {mode === "edit" && editingId ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Lookup ID
                  </span>
                  <input
                    readOnly
                    value={numToInput(lookups.find((x) => x.id === editingId)?.lookupid)}
                    className={`${inputClass} bg-sf-page dark:bg-zinc-900`}
                  />
                </label>
              ) : null}
              {legacyLookuptype ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Stored type{" "}
                  <code className="rounded bg-amber-100/80 px-1 font-mono dark:bg-amber-900/50">
                    {legacyLookuptype}
                  </code>{" "}
                  is not an approved type. Choose <strong>ObjectCategory</strong> (or legacy{" "}
                  <strong>Area</strong> if you must keep the old type) to save.
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Lookup type
                </span>
                <select
                  required
                  value={lookuptype}
                  onChange={(e) => setLookuptype(e.target.value as ApprovedLookupType | "")}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Select type…
                  </option>
                  {(mode === "create" ? CREATABLE_LOOKUP_TYPES : APPROVED_LOOKUP_TYPES).map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Lookup value
                </span>
                <input
                  required
                  value={lookupvalue}
                  onChange={(e) => setLookupvalue(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Notes
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
                  className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
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

      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-lookup-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-lookup-title" className="text-lg font-semibold">
              Delete lookup?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This removes the lookup document from Firestore. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={saving}
                className="min-h-12 rounded-lg bg-red-600 px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
