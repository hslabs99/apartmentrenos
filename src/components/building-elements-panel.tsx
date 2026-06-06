"use client";

import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
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

function formatQuantity(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(n);
}

export function BuildingElementsPanel() {
  const [items, setItems] = useState<DataBuildingElementPublic[]>([]);
  const [lineCount, setLineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/building-elements");
      const data = (await res.json()) as {
        items?: DataBuildingElementPublic[];
        lineCount?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load building elements");
      setItems(data.items ?? []);
      setLineCount(data.lineCount ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load building elements");
      setItems([]);
      setLineCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const displayItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (el) =>
        el.skuName.toLowerCase().includes(q) ||
        el.element.toLowerCase().includes(q) ||
        el.size.toLowerCase().includes(q) ||
        el.type.toLowerCase().includes(q) ||
        el.lines.some(
          (line) =>
            line.category.toLowerCase().includes(q) ||
            line.skuProduct.toLowerCase().includes(q),
        ),
    );
  }, [items, filter]);

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const initRes = await fetch("/api/building-elements/init", { method: "POST" });
        const initData = (await initRes.json()) as { error?: string };
        if (!initRes.ok) {
          setError(
            initData.error ?? "Failed to initialize building elements collection in Firestore",
          );
          setItems([]);
          setLineCount(0);
          setLoading(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setItems([]);
        setLineCount(0);
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
          <h2 className={sfSectionHeading}>Building Elements</h2>
          <p className={sfSectionLead}>
            Read-only view of{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              data_building_elements
            </code>
            . Import from Data Import → Building Elements (
            <code className="text-xs">Building Elements</code> tab, columns F+).
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
          placeholder="SKU name, element, category, product…"
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
        ) : displayItems.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            {items.length === 0
              ? "No building elements yet. Run Building Elements import on Data Import."
              : "No elements match your filter."}
          </p>
        ) : (
          <div className="divide-y divide-sf-border dark:divide-zinc-700">
            {displayItems.map((el) => (
              <details key={el.id} className="group px-4 py-3 md:px-5">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium text-sf-text dark:text-zinc-100">{el.skuName}</p>
                      <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                        {el.element || "—"} · {el.size || "—"} · {el.type || "—"} · qty UOM{" "}
                        {el.quantityUom || "—"} · col {el.sheetColumn}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-sf-text-secondary dark:text-zinc-400">
                      {el.lines.length} line{el.lines.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </summary>
                {el.lines.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-sf-border text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400">
                          <th className="py-2 pr-3 font-medium">Category</th>
                          <th className="py-2 pr-3 font-medium">SKU product</th>
                          <th className="py-2 pr-3 font-medium">UOM</th>
                          <th className="py-2 pr-3 font-medium">Price</th>
                          <th className="py-2 pr-3 font-medium">Qty</th>
                          <th className="py-2 pr-3 font-medium">Sheet row</th>
                        </tr>
                      </thead>
                      <tbody>
                        {el.lines.map((line, idx) => (
                          <tr
                            key={`${line.sheetRow}-${line.skuProduct}-${idx}`}
                            className="border-b border-sf-border/80 last:border-0 dark:border-zinc-800"
                          >
                            <td className="py-2 pr-3">{line.category || "—"}</td>
                            <td className="py-2 pr-3">{line.skuProduct}</td>
                            <td className="py-2 pr-3">{line.lineUom || "—"}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">{formatMoney(line.unitPrice)}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">{formatQuantity(line.quantity)}</td>
                            <td className="py-2 pr-3 font-mono text-xs text-sf-text-secondary">
                              {line.sheetRow > 0 ? line.sheetRow : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-sf-text-secondary dark:text-zinc-400">
                    No detail lines imported for this element.
                  </p>
                )}
              </details>
            ))}
          </div>
        )}
        {!loading ? (
          <p className="border-t border-sf-border px-4 py-2 text-xs text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400 md:px-5">
            Showing {displayItems.length} of {items.length} element(s), {lineCount} total line(s)
          </p>
        ) : null}
      </div>
    </div>
  );
}
