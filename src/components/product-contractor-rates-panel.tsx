"use client";

import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import type { DataProductContractorRatePublic } from "@/types/data-product-contractor-rate-public";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function ProductContractorRatesPanel() {
  const [rows, setRows] = useState<DataProductContractorRatePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/product-contractor-rates");
      const data = (await res.json()) as {
        items?: DataProductContractorRatePublic[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load product contractor rates");
      }
      setRows(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load product contractor rates");
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
        r.productType.toLowerCase().includes(q) ||
        r.specification.toLowerCase().includes(q) ||
        (r.labourDesc ?? "").toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/product-contractor-rates/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(
            initData.error ??
              "Failed to initialize product contractor rates collection in Firestore",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Product Contractor Rates</h2>
          <p className={sfSectionLead}>
            Read-only view of{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              data_productcontractorrates
            </code>
            . Bulk load from Data Import → Product Contractor Rates (
            <code className="text-xs">Products_ContractorRates</code>).
          </p>
        </div>
        <button type="button" onClick={() => void load()} className={sfPrimaryToolbarButton}>
          Refresh
        </button>
      </div>

      <label className="flex max-w-md flex-col gap-1 text-sm">
        <span className="text-sf-text-secondary dark:text-zinc-400">Filter</span>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Product type, specification, labour desc, notes…"
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
              ? "No product contractor rates yet. Run Product Contractor Rates import on Data Import."
              : "No rows match your filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Product type</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Specification</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Labour desc</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Base</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">M2</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">LM</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Unit</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Notes</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Sheet row</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                  >
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.productType || "—"}</td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.specification || "—"}</td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.labourDesc ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap md:px-5 md:py-3.5">
                      {formatMoney(row.base)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap md:px-5 md:py-3.5">
                      {formatMoney(row.m2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap md:px-5 md:py-3.5">
                      {formatMoney(row.lm)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap md:px-5 md:py-3.5">
                      {formatMoney(row.unit)}
                    </td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{row.notes ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-sf-text-secondary md:px-5 md:py-3.5">
                      {row.sheetRow > 0 ? row.sheetRow : "—"}
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
    </div>
  );
}
