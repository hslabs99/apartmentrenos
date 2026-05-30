"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "idle" | "create" | "edit";

function hoursToInput(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function parseHoursInput(value: string): number {
  if (!value.trim()) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function formatHours(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function LabTypeLabourRatesPanel() {
  const [rows, setRows] = useState<DataObjectLabourRatePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [product, setProduct] = useState("");
  const [constructionAssistant, setConstructionAssistant] = useState("");
  const [leadContractor, setLeadContractor] = useState("");
  const [electrician, setElectrician] = useState("");
  const [plumber, setPlumber] = useState("");
  const [uom, setUom] = useState("");
  const [comments, setComments] = useState("");

  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/object-labour-rates");
      const data = (await res.json()) as {
        items?: DataObjectLabourRatePublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load lab type labour rates");
      setRows(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lab type labour rates");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const displayRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.category.toLowerCase().includes(q) ||
        r.productType.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q) ||
        r.uom.toLowerCase().includes(q) ||
        r.comments.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/object-labour-rates/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(
            initData.error ??
              "Failed to initialize object labour rates collection in Firestore",
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
    setCategory("");
    setProductType("");
    setProduct("");
    setConstructionAssistant("");
    setLeadContractor("");
    setElectrician("");
    setPlumber("");
    setUom("");
    setComments("");
    setMode("create");
  }

  function openEdit(row: DataObjectLabourRatePublic) {
    setEditingId(row.id);
    setCategory(row.category);
    setProductType(row.productType);
    setProduct(row.product);
    setConstructionAssistant(hoursToInput(row.constructionAssistant));
    setLeadContractor(hoursToInput(row.leadContractor));
    setElectrician(hoursToInput(row.electrician));
    setPlumber(hoursToInput(row.plumber));
    setUom(row.uom);
    setComments(row.comments);
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

    const hours = {
      constructionAssistant: parseHoursInput(constructionAssistant),
      leadContractor: parseHoursInput(leadContractor),
      electrician: parseHoursInput(electrician),
      plumber: parseHoursInput(plumber),
    };
    if (Object.values(hours).some((n) => Number.isNaN(n))) {
      setError("Labour hours must be valid numbers (0 or greater).");
      setSaving(false);
      return;
    }

    const payload = {
      category: category.trim(),
      productType: productType.trim(),
      product: product.trim(),
      ...hours,
      uom: uom.trim(),
      comments: comments.trim(),
    };

    try {
      if (mode === "create") {
        const res = await fetch("/api/object-labour-rates", {
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
        const res = await fetch(`/api/object-labour-rates/${editingId}`, {
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
      const res = await fetch(`/api/object-labour-rates/${deleteId}`, { method: "DELETE" });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Lab Type Labour Rates</h2>
          <p className={sfSectionLead}>
            Incremental labour hours per product in{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              data_objectlabourrates
            </code>
            . Bulk load from Data Import → Import Incremental Labour Products (
            <code className="text-xs">Incremental Labour - Products</code>).
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add lab type labour rate
        </button>
      </div>

      <label className="flex max-w-md flex-col gap-1 text-sm">
        <span className="text-sf-text-secondary dark:text-zinc-400">Filter</span>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Category, product type, product, UOM, comments…"
          className="min-h-10 rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
      </label>

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
        ) : displayRows.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            {rows.length === 0
              ? "No lab type labour rates yet. Add one here or run Import Incremental Labour Products on Data Import."
              : "No rows match your filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-3 font-semibold md:px-4">Category</th>
                  <th className="px-3 py-3 font-semibold md:px-4">Product type</th>
                  <th className="px-3 py-3 font-semibold md:px-4">Product</th>
                  <th className="px-3 py-3 text-right font-semibold md:px-4">Constr. asst.</th>
                  <th className="px-3 py-3 text-right font-semibold md:px-4">Lead contr.</th>
                  <th className="px-3 py-3 text-right font-semibold md:px-4">Electrician</th>
                  <th className="px-3 py-3 text-right font-semibold md:px-4">Plumber</th>
                  <th className="px-3 py-3 font-semibold md:px-4">UOM</th>
                  <th className="min-w-[12rem] px-3 py-3 font-semibold md:px-4">Comments</th>
                  <th className="px-3 py-3 text-right font-semibold md:px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                  >
                    <td className="px-3 py-3 whitespace-nowrap md:px-4">{row.category || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap md:px-4">
                      {row.productType || "—"}
                    </td>
                    <td className="px-3 py-3 md:px-4">{row.product || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums md:px-4">
                      {formatHours(row.constructionAssistant)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums md:px-4">
                      {formatHours(row.leadContractor)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums md:px-4">
                      {formatHours(row.electrician)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums md:px-4">
                      {formatHours(row.plumber)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap md:px-4">{row.uom || "—"}</td>
                    <td className="max-w-xs px-3 py-3 text-sm text-sf-text-secondary md:px-4 dark:text-zinc-400">
                      {row.comments || "—"}
                    </td>
                    <td className="px-3 py-3 text-right md:px-4">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className={sfRowIconBtn}
                          aria-label="Edit lab type labour rate"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(row.id)}
                          className={sfRowIconBtnDanger}
                          aria-label="Delete lab type labour rate"
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
        {!loading ? (
          <p className="border-t border-sf-border px-4 py-2 text-xs text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400 md:px-5">
            Showing {displayRows.length} of {rows.length} row(s)
          </p>
        ) : null}
      </div>

      {(mode === "create" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lab-type-labour-rate-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 id="lab-type-labour-rate-form-title" className="text-lg font-semibold md:text-xl">
                {mode === "create" ? "New lab type labour rate" : "Edit lab type labour rate"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Category
                </span>
                <input
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Product type
                </span>
                <input
                  required
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Product
                </span>
                <input
                  required
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Construction assistant
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={constructionAssistant}
                    onChange={(e) => setConstructionAssistant(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Lead contractor
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={leadContractor}
                    onChange={(e) => setLeadContractor(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Electrician
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={electrician}
                    onChange={(e) => setElectrician(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Plumber
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={plumber}
                    onChange={(e) => setPlumber(e.target.value)}
                    className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  UOM
                </span>
                <input
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  placeholder="ea, Hour…"
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Comments
                </span>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
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
          aria-labelledby="delete-lab-type-labour-rate-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-lab-type-labour-rate-title" className="text-lg font-semibold">
              Delete lab type labour rate?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This removes the row from Firestore. This cannot be undone.
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
