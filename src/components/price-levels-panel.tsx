"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { ReorderArrows } from "@/components/reorder-arrows";
import { readApiJson } from "@/lib/client/read-api-json";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { PriceLevelPublic } from "@/types/price-level";
import { useCallback, useEffect, useState } from "react";

type Mode = "idle" | "create" | "edit";

function numToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function PriceLevelsPanel() {
  const [rows, setRows] = useState<PriceLevelPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [pricelevel, setPricelevel] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/price-levels");
      const data = (await res.json()) as { priceLevels?: PriceLevelPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load price levels");
      setRows(data.priceLevels ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load price levels");
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
        const initRes = await fetch("/api/price-levels/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(
            initData.error ?? "Failed to initialize price levels collection in Firestore",
          );
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

  function openCreate() {
    setEditingId(null);
    setPricelevel("");
    setDescription("");
    setMode("create");
  }

  function openEdit(r: PriceLevelPublic) {
    setEditingId(r.id);
    setPricelevel(r.pricelevel);
    setDescription(r.description);
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
      const payload = { pricelevel, description };
      if (mode === "create") {
        const res = await fetch("/api/price-levels", {
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
        const res = await fetch(`/api/price-levels/${editingId}`, {
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

  async function movePriceLevel(id: string, direction: "up" | "down") {
    setReordering(true);
    setError(null);
    try {
      const res = await fetch("/api/price-levels/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, direction }),
      });
      const data = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Reorder failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    } finally {
      setReordering(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/price-levels/${deleteId}`, { method: "DELETE" });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Price Levels</h2>
          <p className={sfSectionLead}>
            Define price level labels used across quotes. Each row gets an automatic{" "}
            <span className="font-mono text-sm">pricelevelid</span>. Use ↑ ↓ to set display order
            (e.g. Investor first in Setup → Quote Objects).
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add price level
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
            No price levels yet. Add one to create the{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              price_levels
            </code>{" "}
            collection in Firestore.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="w-px whitespace-nowrap px-2 py-3 text-center text-xs font-semibold md:px-3 md:py-4">
                    Order
                  </th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">ID</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Price level</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Description</th>
                  <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, index) => (
                  <tr
                    key={r.id}
                    className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                  >
                    <td className="px-2 py-2 align-middle md:px-3 md:py-3">
                      <ReorderArrows
                        dense
                        itemLabel={r.pricelevel}
                        disabledUp={reordering || index === 0}
                        disabledDown={reordering || index === rows.length - 1}
                        onUp={() => void movePriceLevel(r.id, "up")}
                        onDown={() => void movePriceLevel(r.id, "down")}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm md:px-5 md:py-3.5">
                      {numToInput(r.pricelevelid)}
                    </td>
                    <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-left text-base font-medium text-blue-700 underline decoration-blue-700/70 underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:decoration-blue-400/70 dark:hover:text-blue-300"
                      >
                        {r.pricelevel}
                      </button>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sf-text-secondary md:px-5 md:py-3.5 dark:text-zinc-300">
                      {r.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className={sfRowIconBtn}
                          aria-label="Edit price level"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(r.id)}
                          className={sfRowIconBtnDanger}
                          aria-label="Delete price level"
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
        )}
      </div>

      {(mode === "create" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-level-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 id="price-level-form-title" className="text-lg font-semibold md:text-xl">
                {mode === "create" ? "New price level" : "Edit price level"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              {mode === "edit" && editingId ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Price level ID
                  </span>
                  <input
                    readOnly
                    value={numToInput(rows.find((x) => x.id === editingId)?.pricelevelid)}
                    className={`${inputClass} bg-sf-page dark:bg-zinc-900`}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Price level <span className="text-sf-text-weak">(max 100)</span>
                </span>
                <input
                  required
                  maxLength={100}
                  value={pricelevel}
                  onChange={(e) => setPricelevel(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Description <span className="text-sf-text-weak">(max 200)</span>
                </span>
                <textarea
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={`${inputClass} min-h-[5rem] resize-y`}
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
          aria-labelledby="delete-price-level-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-price-level-title" className="text-lg font-semibold">
              Delete price level?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This removes the price level document from Firestore. This cannot be undone.
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
