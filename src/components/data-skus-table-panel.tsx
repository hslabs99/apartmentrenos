"use client";

import { ModalFrame } from "@/components/modal-frame";
import { readApiJson } from "@/lib/client/read-api-json";
import { sfDataSurface, sfPrimaryToolbarButton } from "@/lib/sf-layout";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import { useCallback, useEffect, useMemo, useState } from "react";

type FilterKey = "category" | "productType" | "elevateLevel" | "style";

type SortKey =
  | FilterKey
  | "skuId"
  | "product"
  | "append1Spec"
  | "append2Spec"
  | "supplierCount"
  | "colourOptions"
  | "isCurrent";

type CurrentScope = "current" | "archived" | "all";

type Filters = Record<FilterKey, string>;

const FILTER_LABELS: Record<FilterKey, string> = {
  category: "Category",
  productType: "Product Type",
  elevateLevel: "Elevate Level",
  style: "Style",
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

function rowFieldValue(row: DataSkuPublic, key: FilterKey): string {
  const v = row[key].trim();
  return v || "(blank)";
}

function matchesFilter(row: DataSkuPublic, filters: Filters): boolean {
  for (const key of Object.keys(FILTER_LABELS) as FilterKey[]) {
    const selected = filters[key];
    if (!selected) continue;
    if (rowFieldValue(row, key) !== selected) return false;
  }
  return true;
}

function compareRows(a: DataSkuPublic, b: DataSkuPublic, key: SortKey, dir: "asc" | "desc"): number {
  let cmp = 0;
  if (key === "supplierCount") {
    cmp = a.supplierCount - b.supplierCount;
  } else if (key === "isCurrent") {
    cmp = Number(a.isCurrent) - Number(b.isCurrent);
  } else {
    const av = String(a[key] ?? "");
    const bv = String(b[key] ?? "");
    cmp = av.localeCompare(bv, undefined, { sensitivity: "base" });
  }
  return dir === "asc" ? cmp : -cmp;
}

function formatMoney(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={`whitespace-nowrap py-2 pr-3 font-medium ${className ?? ""}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left hover:text-sf-brand dark:hover:text-[#58a9f5]"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="text-xs text-sf-text-weak" aria-hidden>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

type Props = {
  refreshKey?: number;
};

export function DataSkusTablePanel({ refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<DataSkuPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    category: EMPTY_FILTER,
    productType: EMPTY_FILTER,
    elevateLevel: EMPTY_FILTER,
    style: EMPTY_FILTER,
  });
  const [sortKey, setSortKey] = useState<SortKey>("skuId");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentScope, setCurrentScope] = useState<CurrentScope>("current");
  const [selectedProduct, setSelectedProduct] = useState<DataSkuPublic | null>(null);
  const [suppliers, setSuppliers] = useState<DataSkuSupplierPublic[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data-skus");
      const data = await readApiJson<{ items: DataSkuPublic[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setRows(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const loadSuppliers = useCallback(async (skuId: string) => {
    setSuppliersLoading(true);
    setSuppliersError(null);
    try {
      const res = await fetch(`/api/data-sku-suppliers?skuId=${encodeURIComponent(skuId)}`);
      const data = await readApiJson<{ items: DataSkuSupplierPublic[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSuppliers(data.items ?? []);
    } catch (e) {
      setSuppliersError(e instanceof Error ? e.message : "Failed to load suppliers");
      setSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  const openProduct = (row: DataSkuPublic) => {
    setSelectedProduct(row);
    setSuppliers([]);
    void loadSuppliers(row.skuId);
  };

  const closeModal = () => {
    setSelectedProduct(null);
    setSuppliers([]);
    setSuppliersError(null);
  };

  const filterOptions = useMemo(() => {
    const opts: Record<FilterKey, string[]> = {
      category: [],
      productType: [],
      elevateLevel: [],
      style: [],
    };
    for (const key of Object.keys(FILTER_LABELS) as FilterKey[]) {
      opts[key] = distinctSorted(rows.map((r) => rowFieldValue(r, key)));
    }
    return opts;
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const list = rows.filter((r) => {
      if (currentScope === "current" && !r.isCurrent) return false;
      if (currentScope === "archived" && r.isCurrent) return false;
      return matchesFilter(r, filters);
    });
    list.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return list;
  }, [rows, filters, sortKey, sortDir, currentScope]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const clearFilters = () => {
    setFilters({
      category: EMPTY_FILTER,
      productType: EMPTY_FILTER,
      elevateLevel: EMPTY_FILTER,
      style: EMPTY_FILTER,
    });
    setCurrentScope("current");
  };

  const hasActiveFilters =
    Object.values(filters).some(Boolean) || currentScope !== "current";

  return (
    <div className="-mx-4 flex flex-col gap-4 md:-mx-6 lg:-mx-8">
      <section className={`${sfDataSurface} mx-4 flex flex-col gap-4 p-4 md:mx-6 md:p-5 lg:mx-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
              Data for Products (<code className="text-xs font-normal">data_skus</code>)
            </h2>
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              {loading
                ? "Loading…"
                : `Showing ${filteredSorted.length} of ${rows.length} product(s)`}
              {hasActiveFilters ? " (filtered)" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-10 items-center rounded border border-sf-border px-3 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Clear filters
              </button>
            ) : null}
            <button type="button" onClick={() => void load()} className={sfPrimaryToolbarButton}>
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sf-text-secondary dark:text-zinc-400">On sheet</span>
            <select
              value={currentScope}
              onChange={(e) => setCurrentScope(e.target.value as CurrentScope)}
              className="min-h-10 rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="current">Current only</option>
              <option value="archived">Not on sheet</option>
              <option value="all">All</option>
            </select>
          </label>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-sf-text-secondary dark:text-zinc-400">{FILTER_LABELS[key]}</span>
              <select
                value={filters[key]}
                onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                className="min-h-10 rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value={EMPTY_FILTER}>All</option>
                {filterOptions[key].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {error ? <p className="text-sm text-red-800 dark:text-red-300">{error}</p> : null}
      </section>

      <section className={`${sfDataSurface} mx-4 overflow-hidden md:mx-6 lg:mx-8`}>
        <div className="max-h-[calc(100dvh-14rem)] overflow-auto px-4 py-3 md:px-5 lg:px-6">
          <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-sf-surface dark:bg-zinc-900">
              <tr className="border-b border-sf-border dark:border-zinc-700">
                <SortableTh
                  label="SKU ID"
                  sortKey="skuId"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="pl-1"
                />
                <SortableTh
                  label="Category"
                  sortKey="category"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Product Type"
                  sortKey="productType"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Product"
                  sortKey="product"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Elevate Level"
                  sortKey="elevateLevel"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh label="Style" sortKey="style" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh
                  label="Colour"
                  sortKey="colourOptions"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Current"
                  sortKey="isCurrent"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <th className="py-2 pr-3 font-medium">Supplier</th>
                <th className="py-2 pr-3 font-medium">$ Inc GST</th>
                <SortableTh
                  label="Opts"
                  sortKey="supplierCount"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Append 1"
                  sortKey="append1Spec"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="Append 2"
                  sortKey="append2Spec"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <th className="py-2 pr-3 font-medium">Append 3</th>
                <th className="py-2 pr-3 font-medium">UOM</th>
                <th className="py-2 pr-3 font-medium">Sheet rows</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-sf-text-secondary">
                    Loading data_skus…
                  </td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-sf-text-secondary">
                    {rows.length === 0 ? "No data — run Import first." : "No rows match filters."}
                  </td>
                </tr>
              ) : (
                filteredSorted.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-sf-border/80 hover:bg-sf-page/50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                    onClick={() => openProduct(row)}
                  >
                    <td className="py-2 pl-1 pr-3 font-mono text-xs font-medium text-sf-brand dark:text-[#58a9f5]">
                      {row.skuId}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.category || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.productType || "—"}</td>
                    <td className="py-2 pr-3">{row.product || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.elevateLevel || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.style || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.colourOptions || "—"}</td>
                    <td className="py-2 pr-3">
                      {row.isCurrent ? (
                        <span className="text-green-700 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-sf-text-weak">No</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {row.primarySupplier?.supplier ? (
                        <>
                          {row.primarySupplier.supplier}
                          {row.supplierCount > 1 ? (
                            <span className="ml-1 text-xs text-sf-text-weak">
                              (+{row.supplierCount - 1})
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                      {formatMoney(row.primarySupplier?.priceIncGst ?? null)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.supplierCount || "—"}</td>
                    <td className="max-w-[9rem] py-2 pr-3 text-xs">
                      {row.append1Type || row.append1Spec
                        ? `${row.append1Type || "—"} · ${row.append1Spec || "—"}`
                        : "—"}
                    </td>
                    <td className="max-w-[9rem] py-2 pr-3 text-xs">
                      {row.append2Type || row.append2Spec
                        ? `${row.append2Type || "—"} · ${row.append2Spec || "—"}`
                        : "—"}
                    </td>
                    <td className="max-w-[9rem] py-2 pr-3 text-xs">
                      {row.append3Type || row.append3Spec
                        ? `${row.append3Type || "—"} · ${row.append3Spec || "—"}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">{row.uom || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-sf-text-secondary">
                      {row.sourceSheetRows.length ? row.sourceSheetRows.join(", ") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedProduct ? (
        <ModalFrame
          wide
          panelClassName="!w-[min(98vw,105rem)] !max-w-[min(98vw,105rem)]"
          contentClassName=""
          title={`Suppliers — ${selectedProduct.skuId}`}
          description={`${selectedProduct.category} · ${selectedProduct.productType} · ${selectedProduct.elevateLevel} · ${selectedProduct.style} · ${selectedProduct.colourOptions}`}
          onClose={closeModal}
          footer={
            <button
              type="button"
              className={sfPrimaryToolbarButton}
              onClick={closeModal}
            >
              Close
            </button>
          }
        >
          {suppliersLoading ? (
            <p className="text-sm text-sf-text-secondary">Loading suppliers…</p>
          ) : suppliersError ? (
            <p className="text-sm text-red-800 dark:text-red-300">{suppliersError}</p>
          ) : suppliers.length === 0 ? (
            <p className="text-sm text-sf-text-secondary">No supplier options for this product.</p>
          ) : (
            <div className="max-h-[36dvh] overflow-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-sf-border dark:border-zinc-700">
                    <th className="py-2 pr-3 font-medium">Option</th>
                    <th className="py-2 pr-3 font-medium">Supplier</th>
                    <th className="py-2 pr-3 font-medium">Model</th>
                    <th className="py-2 pr-3 font-medium">Supplier SKU</th>
                    <th className="py-2 pr-3 font-medium">$ Inc GST</th>
                    <th className="py-2 pr-3 font-medium">$ Exc GST</th>
                    <th className="py-2 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-sf-border/80 dark:border-zinc-800">
                      <td className="py-2 pr-3 tabular-nums">{s.supplierOption}</td>
                      <td className="py-2 pr-3">{s.supplier || "—"}</td>
                      <td className="py-2 pr-3">{s.model || "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{s.supplierSku || "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatMoney(s.priceIncGst)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatMoney(s.priceExcGst)}</td>
                      <td className="py-2 pr-3">
                        {s.link ? (
                          <a
                            href={s.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sf-brand hover:underline dark:text-[#58a9f5]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalFrame>
      ) : null}
    </div>
  );
}
