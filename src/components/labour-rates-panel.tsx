"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "idle" | "create" | "edit";

function formatPriceExcGst(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function priceToInput(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(n);
}

export function LabourRatesPanel() {
  const [rows, setRows] = useState<DataLabourRatePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [product, setProduct] = useState("");
  const [priceExcGst, setPriceExcGst] = useState("");
  const [uom, setUom] = useState("");

  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/labour-rates");
      const data = (await res.json()) as {
        items?: DataLabourRatePublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load labour rates");
      setRows(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load labour rates");
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
        r.uom.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/labour-rates/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(
            initData.error ?? "Failed to initialize labour rates collection in Firestore",
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
    setPriceExcGst("");
    setUom("");
    setMode("create");
  }

  function openEdit(row: DataLabourRatePublic) {
    setEditingId(row.id);
    setCategory(row.category);
    setProductType(row.productType);
    setProduct(row.product);
    setPriceExcGst(priceToInput(row.priceExcGst));
    setUom(row.uom);
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
    const price = Number(priceExcGst);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid price (exc GST).");
      setSaving(false);
      return;
    }
    const payload = {
      category: category.trim(),
      productType: productType.trim(),
      product: product.trim(),
      priceExcGst: price,
      uom: uom.trim(),
    };
    try {
      if (mode === "create") {
        const res = await fetch("/api/labour-rates", {
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
        const res = await fetch(`/api/labour-rates/${editingId}`, {
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
      const res = await fetch(`/api/labour-rates/${deleteId}`, { method: "DELETE" });
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
          <h2 className={sfSectionHeading}>Labour Rates</h2>
          <p className={sfSectionLead}>
            Manage labour rates in{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              data_labourrates
            </code>
            . Bulk load from Data Import → Import Labour Rates Table (
            <code className="text-xs">Products_Labour</code>).
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add labour rate
        </button>
      </div>

      <label className="flex max-w-md flex-col gap-1 text-sm">
        <span className="text-sf-text-secondary dark:text-zinc-400">Filter</span>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Category, product type, product, UOM…"
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
              ? "No labour rates yet. Add one here or run Import Labour Rates Table on Data Import."
              : "No rows match your filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Category</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Product type</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Product</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">$ Exc GST</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">UOM</th>
                  <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                  >
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.category || "—"}</td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.productType || "—"}</td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.product || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap md:px-5 md:py-3.5">
                      {formatPriceExcGst(row.priceExcGst)}
                    </td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.uom || "—"}</td>
                    <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className={sfRowIconBtn}
                          aria-label="Edit labour rate"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(row.id)}
                          className={sfRowIconBtnDanger}
                          aria-label="Delete labour rate"
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
          aria-labelledby="labour-rate-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 id="labour-rate-form-title" className="text-lg font-semibold md:text-xl">
                {mode === "create" ? "New labour rate" : "Edit labour rate"}
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
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  $ Exc GST
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  step={0.01}
                  value={priceExcGst}
                  onChange={(e) => setPriceExcGst(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  UOM
                </span>
                <input
                  required
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  placeholder="Unit, Hour, M2, Site…"
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
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
          aria-labelledby="delete-labour-rate-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-labour-rate-title" className="text-lg font-semibold">
              Delete labour rate?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This removes the rate from Firestore. This cannot be undone.
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
