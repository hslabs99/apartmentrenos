"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";
import type { DataSupplierDiscountRangePublic } from "@/types/data-supplier-discount-range-public";
import { useCallback, useEffect, useMemo, useState } from "react";

type SupplierMode = "idle" | "create" | "edit";
type RangeMode = "idle" | "edit";

function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${n}%`;
}

function formatThreshold(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function pctToInput(n: number | null): string {
  if (n == null) return "";
  return String(n);
}

export function SupplierDiscountsPanel() {
  const [ranges, setRanges] = useState<DataSupplierDiscountRangePublic[]>([]);
  const [rows, setRows] = useState<DataSupplierDiscountPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplierMode, setSupplierMode] = useState<SupplierMode>("idle");
  const [rangeMode, setRangeMode] = useState<RangeMode>("idle");
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingRangeId, setEditingRangeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null);

  const [supplier, setSupplier] = useState("");
  const [defaultPct, setDefaultPct] = useState("");
  const [range1, setRange1] = useState("");
  const [range2, setRange2] = useState("");
  const [range3, setRange3] = useState("");
  const [range4, setRange4] = useState("");
  const [comment, setComment] = useState("");
  const [rangeDiscount, setRangeDiscount] = useState("");
  const [filter, setFilter] = useState("");

  const rangeByName = useMemo(() => {
    const map = new Map<number, DataSupplierDiscountRangePublic>();
    for (const r of ranges) map.set(r.rangeName, r);
    return map;
  }, [ranges]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rangesRes, suppliersRes] = await Promise.all([
        fetch("/api/supplier-discount-ranges"),
        fetch("/api/supplier-discounts"),
      ]);
      const rangesData = (await rangesRes.json()) as {
        items?: DataSupplierDiscountRangePublic[];
        error?: string;
      };
      const suppliersData = (await suppliersRes.json()) as {
        items?: DataSupplierDiscountPublic[];
        error?: string;
      };
      if (!rangesRes.ok) {
        throw new Error(rangesData.error ?? "Failed to load discount ranges");
      }
      if (!suppliersRes.ok) {
        throw new Error(suppliersData.error ?? "Failed to load supplier discounts");
      }
      setRanges(rangesData.items ?? []);
      setRows(suppliersData.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
      setRanges([]);
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
        r.supplier.toLowerCase().includes(q) ||
        (r.comment ?? "").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const [rInit, sInit] = await Promise.all([
          fetch("/api/supplier-discount-ranges/init", { method: "POST" }),
          fetch("/api/supplier-discounts/init", { method: "POST" }),
        ]);
        const rData = (await rInit.json()) as { error?: string };
        const sData = (await sInit.json()) as { error?: string };
        if (!rInit.ok) throw new Error(rData.error ?? "Failed to init ranges collection");
        if (!sInit.ok) throw new Error(sData.error ?? "Failed to init suppliers collection");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setLoading(false);
        return;
      }
      await load();
    }
    void bootstrapThenLoad();
  }, [load]);

  function openCreateSupplier() {
    setEditingSupplierId(null);
    setSupplier("");
    setDefaultPct("");
    setRange1("");
    setRange2("");
    setRange3("");
    setRange4("");
    setComment("");
    setSupplierMode("create");
  }

  function openEditSupplier(row: DataSupplierDiscountPublic) {
    setEditingSupplierId(row.id);
    setSupplier(row.supplier);
    setDefaultPct(String(row.default));
    setRange1(pctToInput(row.range1));
    setRange2(pctToInput(row.range2));
    setRange3(pctToInput(row.range3));
    setRange4(pctToInput(row.range4));
    setComment(row.comment ?? "");
    setSupplierMode("edit");
  }

  function closeSupplierForm() {
    setSupplierMode("idle");
    setEditingSupplierId(null);
  }

  function openEditRange(row: DataSupplierDiscountRangePublic) {
    setEditingRangeId(row.id);
    setRangeDiscount(String(row.discount));
    setRangeMode("edit");
  }

  function closeRangeForm() {
    setRangeMode("idle");
    setEditingRangeId(null);
  }

  function parseOptionalPctInput(raw: string): number | null {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n;
  }

  async function submitSupplierForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const def = Number(defaultPct);
    if (!Number.isFinite(def) || def < 0 || def > 100) {
      setError("Enter a valid default discount (0–100%).");
      setSaving(false);
      return;
    }
    const payload = {
      supplier: supplier.trim(),
      default: def,
      range1: parseOptionalPctInput(range1),
      range2: parseOptionalPctInput(range2),
      range3: parseOptionalPctInput(range3),
      range4: parseOptionalPctInput(range4),
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    };
    try {
      if (supplierMode === "create") {
        const res = await fetch("/api/supplier-discounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Create failed");
      } else if (supplierMode === "edit" && editingSupplierId) {
        const res = await fetch(`/api/supplier-discounts/${editingSupplierId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Save failed");
      }
      closeSupplierForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitRangeForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRangeId) return;
    setSaving(true);
    setError(null);
    const discount = Number(rangeDiscount);
    if (!Number.isFinite(discount) || discount < 0) {
      setError("Enter a valid order threshold ($).");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/supplier-discount-ranges/${editingRangeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      closeRangeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSupplier() {
    if (!deleteSupplierId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/supplier-discounts/${deleteSupplierId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setDeleteSupplierId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="min-w-0 space-y-1">
        <h2 className={sfSectionHeading}>Supplier Discounts</h2>
        <p className={sfSectionLead}>
          <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
            data_supplier_discount_ranges
          </code>{" "}
          defines order thresholds for ranges 1–4;{" "}
          <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
            data_supplier_discounts
          </code>{" "}
          holds one row per supplier. Import replaces both collections from the sheet.
        </p>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-sf-text dark:text-zinc-200">Order value ranges</h3>
        <div className={sfDataSurface}>
          {loading ? (
            <p className="p-6 text-sf-text-secondary dark:text-zinc-400">Loading…</p>
          ) : ranges.length === 0 ? (
            <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
              No ranges yet. Run Import Supplier Discounts on Data Import.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Range name</th>
                    <th className="px-4 py-3 font-semibold">Discount (threshold $)</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ranges.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                    >
                      <td className="px-4 py-3 tabular-nums">{row.rangeName}</td>
                      <td className="px-4 py-3">{formatThreshold(row.discount)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditRange(row)}
                          className={sfRowIconBtn}
                          aria-label={`Edit range ${row.rangeName}`}
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-sf-text dark:text-zinc-200">Suppliers</h3>
          <button type="button" onClick={openCreateSupplier} className={sfPrimaryToolbarButton}>
            Add supplier
          </button>
        </div>

        <label className="flex max-w-md flex-col gap-1 text-sm">
          <span className="text-sf-text-secondary dark:text-zinc-400">Filter</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Supplier or comment…"
            className="min-h-10 rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </label>

        <div className={sfDataSurface}>
          {loading ? (
            <p className="p-6 text-sf-text-secondary dark:text-zinc-400">Loading…</p>
          ) : displayRows.length === 0 ? (
            <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
              {rows.length === 0
                ? "No suppliers yet. Import from Data Import or add one here."
                : "No rows match your filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm md:text-base">
                <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-3 font-semibold md:px-4">Supplier</th>
                    <th className="px-3 py-3 font-semibold md:px-4">Default</th>
                    {[1, 2, 3, 4].map((n) => (
                      <th key={n} className="px-3 py-3 font-semibold md:px-4">
                        Range {n}
                        {rangeByName.get(n) ? (
                          <span className="mt-0.5 block text-xs font-normal text-sf-text-weak dark:text-zinc-500">
                            {formatThreshold(rangeByName.get(n)!.discount)}+
                          </span>
                        ) : null}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-semibold md:px-4">Comment</th>
                    <th className="px-3 py-3 text-right font-semibold md:px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                    >
                      <td className="px-3 py-3 font-medium md:px-4">{row.supplier}</td>
                      <td className="px-3 py-3 whitespace-nowrap md:px-4">
                        {formatPct(row.default)}
                      </td>
                      <td className="px-3 py-3 md:px-4">{formatPct(row.range1)}</td>
                      <td className="px-3 py-3 md:px-4">{formatPct(row.range2)}</td>
                      <td className="px-3 py-3 md:px-4">{formatPct(row.range3)}</td>
                      <td className="px-3 py-3 md:px-4">{formatPct(row.range4)}</td>
                      <td className="max-w-xs px-3 py-3 text-sm text-sf-text-secondary md:px-4 dark:text-zinc-400">
                        {row.comment || "—"}
                      </td>
                      <td className="px-3 py-3 text-right md:px-4">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditSupplier(row)}
                            className={sfRowIconBtn}
                            aria-label={`Edit ${row.supplier}`}
                          >
                            <IconPencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteSupplierId(row.id)}
                            className={sfRowIconBtnDanger}
                            aria-label={`Delete ${row.supplier}`}
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
            <p className="border-t border-sf-border px-4 py-2 text-xs text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400">
              Showing {displayRows.length} of {rows.length} supplier(s)
            </p>
          ) : null}
        </div>
      </section>

      {supplierMode !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeSupplierForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 className="text-lg font-semibold">
                {supplierMode === "create" ? "New supplier" : "Edit supplier"}
              </h2>
            </div>
            <form onSubmit={submitSupplierForm} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Supplier</span>
                <input
                  required
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Default (%)</span>
                <input
                  required
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={defaultPct}
                  onChange={(e) => setDefaultPct(e.target.value)}
                  className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {([1, 2, 3, 4] as const).map((n) => {
                  const val = n === 1 ? range1 : n === 2 ? range2 : n === 3 ? range3 : range4;
                  const set =
                    n === 1 ? setRange1 : n === 2 ? setRange2 : n === 3 ? setRange3 : setRange4;
                  const thresh = rangeByName.get(n);
                  return (
                    <label key={n} className="block">
                      <span className="mb-1 block text-xs font-medium text-sf-text-secondary">
                        Range {n} %{thresh ? ` (${formatThreshold(thresh.discount)}+)` : ""}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        placeholder="—"
                        className="min-h-11 w-full rounded-lg border border-sf-border-strong px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                      />
                    </label>
                  );
                })}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Comment</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-sf-border-strong px-3 py-2.5 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeSupplierForm}
                  className="min-h-12 rounded-lg border px-4 py-3 dark:border-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : supplierMode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rangeMode === "edit" && editingRangeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeRangeForm}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-sf-border bg-sf-surface p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Edit range threshold</h2>
            <form onSubmit={submitRangeForm} className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  Discount (order threshold $)
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  value={rangeDiscount}
                  onChange={(e) => setRangeDiscount(e.target.value)}
                  className="min-h-12 w-full rounded-lg border px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeRangeForm} className="min-h-11 rounded-lg border px-4">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-lg bg-sf-brand px-4 text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteSupplierId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Delete supplier?</h2>
            <p className="mt-2 text-sm text-sf-text-secondary">This cannot be undone.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteSupplierId(null)}
                className="min-h-12 rounded-lg border px-4 dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSupplier()}
                disabled={saving}
                className="min-h-12 rounded-lg bg-red-600 px-5 text-white disabled:opacity-50"
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
