"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DataSkuPublic } from "@/types/data-sku-public";

function displayField(value: string | undefined | null): string {
  const t = String(value ?? "").trim();
  return t || "—";
}

function fieldValue(row: DataSkuPublic, key: ColumnKey): string {
  const t = String(row[key] ?? "").trim();
  return t || "(blank)";
}

function distinctSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

const COLUMNS = [
  { key: "elevateLevel", label: "Pricing level" },
  { key: "style", label: "Style" },
  { key: "colourOptions", label: "Colour" },
  { key: "category", label: "Category" },
  { key: "productType", label: "Type" },
  { key: "product", label: "Product" },
  { key: "uom", label: "UOM" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const DEFAULT_SORT_KEYS: ColumnKey[] = ["elevateLevel", "style", "colourOptions"];
const EMPTY_FILTER = "";

type Filters = Record<ColumnKey, string>;

const EMPTY_FILTERS: Filters = {
  elevateLevel: EMPTY_FILTER,
  style: EMPTY_FILTER,
  colourOptions: EMPTY_FILTER,
  category: EMPTY_FILTER,
  productType: EMPTY_FILTER,
  product: EMPTY_FILTER,
  uom: EMPTY_FILTER,
};

const filterSelectClass =
  "w-full min-w-[7rem] max-w-[12rem] min-h-8 rounded border border-sf-border bg-sf-surface px-1.5 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900";

function compareSkuRows(
  a: DataSkuPublic,
  b: DataSkuPublic,
  primary: ColumnKey,
  dir: "asc" | "desc",
): number {
  const keys: Array<ColumnKey | "skuId"> = [
    primary,
    ...DEFAULT_SORT_KEYS.filter((k) => k !== primary),
    "product",
    "skuId",
  ];
  const uniqueKeys = keys.filter((k, i, all) => all.indexOf(k) === i);

  for (const key of uniqueKeys) {
    const av = key === "skuId" ? String(a.skuId ?? a.id ?? "") : String(a[key] ?? "");
    const bv = key === "skuId" ? String(b.skuId ?? b.id ?? "") : String(b[key] ?? "");
    const cmp = av.localeCompare(bv, undefined, { sensitivity: "base" });
    if (cmp !== 0) return key === primary && dir === "desc" ? -cmp : cmp;
  }
  return 0;
}

type Props = {
  objectLabel: string;
  skus: DataSkuPublic[];
  onClose: () => void;
};

export function ScopeObjectCatalogSkusModal({ objectLabel, skus, onClose }: Props) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<ColumnKey>("elevateLevel");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filterOptions = useMemo(() => {
    const opts = {} as Record<ColumnKey, string[]>;
    for (const col of COLUMNS) {
      opts[col.key] = distinctSorted(skus.map((row) => fieldValue(row, col.key)));
    }
    return opts;
  }, [skus]);

  const filteredSorted = useMemo(() => {
    const list = skus.filter((row) =>
      COLUMNS.every((col) => {
        const f = filters[col.key];
        if (!f) return true;
        return fieldValue(row, col.key) === f;
      }),
    );
    list.sort((a, b) => compareSkuRows(a, b, sortKey, sortDir));
    return list;
  }, [skus, filters, sortKey, sortDir]);

  const hasActiveFilters = COLUMNS.some((col) => filters[col.key] !== EMPTY_FILTER);
  const countLabel =
    skus.length === 1 ? "1 SKU" : `${skus.length} SKUs`;
  const showingLabel =
    hasActiveFilters && filteredSorted.length !== skus.length
      ? `Showing ${filteredSorted.length} of ${countLabel}`
      : countLabel;

  function onSort(key: ColumnKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function setFilter(key: ColumnKey, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scope-object-catalog-skus-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-5xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-sf-border px-5 py-4 dark:border-zinc-700">
          <h2 id="scope-object-catalog-skus-title" className="text-lg font-semibold md:text-xl">
            Catalog SKUs — {objectLabel}
          </h2>
          <p className="mt-1 text-sm text-sf-text-secondary dark:text-zinc-400">
            {showingLabel} matching category and product type. No Elevate, style, or colour filter
            from the project — this is the same set as the count on the scope. Informational only.
          </p>
          {skus.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {COLUMNS.map((col) => (
                <label key={col.key} className="min-w-[7rem] max-w-[12rem] flex-1">
                  <span className="mb-0.5 block text-[11px] font-medium text-sf-text-secondary dark:text-zinc-400">
                    {col.label}
                  </span>
                  <select
                    aria-label={`Filter ${col.label}`}
                    value={filters[col.key]}
                    onChange={(e) => setFilter(col.key, e.target.value)}
                    className={filterSelectClass}
                  >
                    <option value={EMPTY_FILTER}>All</option>
                    {filterOptions[col.key].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="min-h-8 shrink-0 rounded border border-sf-border px-2.5 py-1 text-xs hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {skus.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No current catalog SKUs match this object’s category and product type.
            </p>
          ) : filteredSorted.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No SKUs match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-sf-border dark:border-zinc-700">
              <table className="w-full min-w-[48rem] text-left text-xs">
                <thead className="sticky top-0 bg-sf-page text-sf-text-secondary dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    {COLUMNS.map((col) => {
                      const active = sortKey === col.key;
                      return (
                        <th key={col.key} className="whitespace-nowrap px-2 py-1.5 font-medium">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-left hover:text-sf-brand dark:hover:text-[#58a9f5]"
                            onClick={() => onSort(col.key)}
                          >
                            {col.label}
                            <span className="text-[10px] text-sf-text-weak" aria-hidden>
                              {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredSorted.map((sku) => (
                    <tr
                      key={sku.skuId || sku.id}
                      className="border-t border-sf-border/80 dark:border-zinc-800"
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={
                            col.key === "product"
                              ? "px-2 py-1.5 text-sf-text dark:text-zinc-100"
                              : "whitespace-nowrap px-2 py-1.5 text-sf-text dark:text-zinc-100"
                          }
                        >
                          {displayField(sku[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-sf-border px-5 py-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
