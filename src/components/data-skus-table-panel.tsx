"use client";

import { ModalFrame } from "@/components/modal-frame";
import { readApiJson } from "@/lib/client/read-api-json";
import { isAllLookupOrFilterValue } from "@/lib/lookup-list-values";
import { sfDataSurface, sfPrimaryToolbarButton } from "@/lib/sf-layout";
import { normalizeElevateLevel, normalizeSkuPart } from "@/lib/sku/normalize-sku-part";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type Filters = {
  category: string;
  /** Empty = all types. Matches row productType or any append slot type. */
  productTypes: string[];
  elevateLevel: string;
  style: string;
  /** Case-insensitive substring match on product name. Empty = no product search. */
  productSearch: string;
  /** When a type is selected, also include SKU rows whose type is All. */
  includeAllProductTypes: boolean;
  /** When an elevate level is selected, also include SKU rows with All. */
  includeAllElevate: boolean;
  /** When a style is selected, also include SKU rows with All. */
  includeAllStyle: boolean;
};

type FilterKey = "category" | "elevateLevel" | "style";

const FILTER_LABELS: Record<FilterKey, string> = {
  category: "Category",
  elevateLevel: "Elevate Level",
  style: "Style",
};

type SortKey =
  | FilterKey
  | "skuId"
  | "productType"
  | "product"
  | "append1Type"
  | "append1Spec"
  | "append2Type"
  | "append2Spec"
  | "append3Type"
  | "append3Spec"
  | "supplierCount"
  | "colourOptions"
  | "isCurrent"
  | "calcM2"
  | "calculatedM2";

type CurrentScope = "current" | "archived" | "all";

const EMPTY_FILTER = "";
const TABLE_COL_COUNT = 21;
const DEFAULT_INCLUDE_ALL = {
  includeAllProductTypes: true,
  includeAllElevate: true,
  includeAllStyle: true,
};
const filterSelectClass =
  "w-full min-w-[7rem] max-w-[14rem] min-h-8 rounded border border-sf-border bg-sf-surface px-1.5 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900";
const headerFilterCellClass = "align-bottom whitespace-nowrap py-1.5 pr-3";

function parseCalculatedM2Input(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("M² must be a non-negative number (or empty).");
  }
  return n;
}

function formatCalculatedM2Input(v: number | null): string {
  if (v == null) return "";
  return String(v);
}

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

/** Parent productType plus append slot types on a row. */
function rowProductTypeTokens(row: DataSkuPublic): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [
    row.productType,
    row.append1Type,
    row.append2Type,
    row.append3Type,
  ]) {
    const token = raw.trim() || "(blank)";
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function productTypeFilterLabel(selected: string[]): string {
  if (selected.length === 0) return "All";
  if (selected.length === 1) return selected[0]!;
  if (selected.length === 2) return `${selected[0]!}, ${selected[1]!}`;
  return `${selected[0]!} +${selected.length - 1}`;
}

function dimensionTokens(value: string): string[] {
  const raw = value.trim();
  if (!raw) return [""];
  if (!/[;,]/.test(raw)) return [raw];
  const parts = raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [""];
}

function dimensionValueMatches(
  rowValue: string,
  filter: string,
  includeAll: boolean,
  kind: "elevate" | "text",
): boolean {
  if (!filter) return true;
  if (includeAll && isAllLookupOrFilterValue(rowValue)) return true;
  const norm = kind === "elevate" ? normalizeElevateLevel : normalizeSkuPart;
  const want = norm(filter === "(blank)" ? "" : filter);
  return dimensionTokens(rowValue).some((token) => {
    const t = token === "(blank)" ? "" : token;
    return norm(t) === want;
  });
}

function matchesProductTypes(
  row: DataSkuPublic,
  selected: string[],
  includeAll: boolean,
): boolean {
  if (selected.length === 0) return true;
  const tokens = rowProductTypeTokens(row);
  if (selected.some((s) => tokens.includes(s))) return true;
  if (includeAll) {
    return tokens.some((t) => isAllLookupOrFilterValue(t === "(blank)" ? "" : t));
  }
  return false;
}

function matchesFilter(row: DataSkuPublic, filters: Filters): boolean {
  if (filters.category && rowFieldValue(row, "category") !== filters.category) {
    return false;
  }
  if (!matchesProductTypes(row, filters.productTypes, filters.includeAllProductTypes)) {
    return false;
  }
  if (
    !dimensionValueMatches(
      row.elevateLevel,
      filters.elevateLevel,
      filters.includeAllElevate,
      "elevate",
    )
  ) {
    return false;
  }
  if (!dimensionValueMatches(row.style, filters.style, filters.includeAllStyle, "text")) {
    return false;
  }
  const productQ = filters.productSearch.trim().toLowerCase();
  if (productQ && !row.product.toLowerCase().includes(productQ)) {
    return false;
  }
  return true;
}

function compareRows(a: DataSkuPublic, b: DataSkuPublic, key: SortKey, dir: "asc" | "desc"): number {
  let cmp = 0;
  if (key === "supplierCount") {
    cmp = a.supplierCount - b.supplierCount;
  } else if (key === "isCurrent") {
    cmp = Number(a.isCurrent) - Number(b.isCurrent);
  } else if (key === "calcM2") {
    cmp = Number(a.calcM2) - Number(b.calcM2);
  } else if (key === "calculatedM2") {
    const av = a.calculatedM2 ?? -1;
    const bv = b.calculatedM2 ?? -1;
    cmp = av - bv;
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

function IncludeAllCheckbox({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
}) {
  return (
    <label
      className="flex h-[18px] cursor-pointer items-center gap-1 text-[11px] leading-none text-sf-text-secondary dark:text-zinc-400"
      title={title}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Include all
    </label>
  );
}

function HeaderFilterCell({
  children,
  includeAll,
  className,
}: {
  children?: ReactNode;
  includeAll?: ReactNode;
  className?: string;
}) {
  return (
    <th className={`${headerFilterCellClass} ${className ?? ""}`}>
      <div className="flex flex-col justify-end gap-1">
        <div className="h-[18px]">{includeAll ?? null}</div>
        {children}
      </div>
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
    productTypes: [],
    elevateLevel: EMPTY_FILTER,
    style: EMPTY_FILTER,
    productSearch: EMPTY_FILTER,
    ...DEFAULT_INCLUDE_ALL,
  });
  const [productTypePickerOpen, setProductTypePickerOpen] = useState(false);
  const [productTypeDraft, setProductTypeDraft] = useState<string[]>([]);
  const [productTypeSearch, setProductTypeSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("skuId");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentScope, setCurrentScope] = useState<CurrentScope>("current");
  const [selectedProduct, setSelectedProduct] = useState<DataSkuPublic | null>(null);
  const [suppliers, setSuppliers] = useState<DataSkuSupplierPublic[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [calcM2SavingId, setCalcM2SavingId] = useState<string | null>(null);
  const [calculatedM2SavingId, setCalculatedM2SavingId] = useState<string | null>(null);

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

  const toggleCalcM2 = async (row: DataSkuPublic, next: boolean) => {
    setCalcM2SavingId(row.skuId);
    setError(null);
    try {
      const res = await fetch(`/api/data-skus/${encodeURIComponent(row.skuId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calcM2: next }),
      });
      const data = await readApiJson<{
        skuId?: string;
        calcM2?: boolean;
        calculatedM2?: number | null;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setRows((prev) =>
        prev.map((r) =>
          r.skuId === row.skuId
            ? {
                ...r,
                calcM2: data.calcM2 ?? next,
                calculatedM2:
                  data.calculatedM2 !== undefined ? data.calculatedM2 : r.calculatedM2,
              }
            : r,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update M2 flag");
    } finally {
      setCalcM2SavingId(null);
    }
  };

  const saveCalculatedM2 = async (row: DataSkuPublic, next: number | null) => {
    if (!row.calcM2) return;
    if (row.calculatedM2 === next) return;
    setCalculatedM2SavingId(row.skuId);
    setError(null);
    try {
      const res = await fetch(`/api/data-skus/${encodeURIComponent(row.skuId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calculatedM2: next }),
      });
      const data = await readApiJson<{
        skuId?: string;
        calcM2?: boolean;
        calculatedM2?: number | null;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setRows((prev) =>
        prev.map((r) =>
          r.skuId === row.skuId
            ? {
                ...r,
                calcM2: data.calcM2 ?? r.calcM2,
                calculatedM2:
                  data.calculatedM2 !== undefined ? data.calculatedM2 : next,
              }
            : r,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save M²");
    } finally {
      setCalculatedM2SavingId(null);
    }
  };

  const filterOptions = useMemo(() => {
    const opts: Record<FilterKey, string[]> = {
      category: [],
      elevateLevel: [],
      style: [],
    };
    for (const key of Object.keys(FILTER_LABELS) as FilterKey[]) {
      opts[key] = distinctSorted(rows.map((r) => rowFieldValue(r, key)));
    }
    return opts;
  }, [rows]);

  const productTypeOptions = useMemo(() => {
    const pool = filters.category
      ? rows.filter((r) => rowFieldValue(r, "category") === filters.category)
      : rows;
    const values: string[] = [];
    for (const row of pool) {
      values.push(...rowProductTypeTokens(row));
    }
    return distinctSorted(values);
  }, [rows, filters.category]);

  const filteredProductTypeOptions = useMemo(() => {
    const q = productTypeSearch.trim().toLowerCase();
    if (!q) return productTypeOptions;
    return productTypeOptions.filter((opt) => opt.toLowerCase().includes(q));
  }, [productTypeOptions, productTypeSearch]);

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
      productTypes: [],
      elevateLevel: EMPTY_FILTER,
      style: EMPTY_FILTER,
      productSearch: EMPTY_FILTER,
      ...DEFAULT_INCLUDE_ALL,
    });
    setCurrentScope("current");
  };

  const openProductTypePicker = () => {
    setProductTypeDraft([...filters.productTypes]);
    setProductTypeSearch("");
    setProductTypePickerOpen(true);
  };

  const applyProductTypePicker = () => {
    setFilters((f) => ({ ...f, productTypes: [...productTypeDraft] }));
    setProductTypePickerOpen(false);
  };

  const hasActiveFilters =
    filters.category !== EMPTY_FILTER ||
    filters.productTypes.length > 0 ||
    filters.elevateLevel !== EMPTY_FILTER ||
    filters.style !== EMPTY_FILTER ||
    filters.productSearch.trim() !== EMPTY_FILTER ||
    currentScope !== "current";

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

        {error ? <p className="text-sm text-red-800 dark:text-red-300">{error}</p> : null}
      </section>

      <section className={`${sfDataSurface} mx-4 overflow-hidden md:mx-6 lg:mx-8`}>
        <div className="max-h-[calc(100dvh-14rem)] overflow-auto px-4 py-3 md:px-5 lg:px-6">
          <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-sf-surface dark:bg-zinc-900">
              <tr className="border-b border-sf-border/70 dark:border-zinc-700">
                <HeaderFilterCell className="pl-1" />
                <HeaderFilterCell>
                  <select
                    aria-label="Filter category"
                    value={filters.category}
                    onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                    className={filterSelectClass}
                  >
                    <option value={EMPTY_FILTER}>All</option>
                    {filterOptions.category.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </HeaderFilterCell>
                <HeaderFilterCell
                  includeAll={
                    <IncludeAllCheckbox
                      checked={filters.includeAllProductTypes}
                      onChange={(next) =>
                        setFilters((f) => ({ ...f, includeAllProductTypes: next }))
                      }
                      title="When a type is selected, also show SKU rows whose type is All."
                    />
                  }
                >
                  <button
                    type="button"
                    aria-label="Filter product type"
                    onClick={openProductTypePicker}
                    className={`${filterSelectClass} text-left hover:bg-sf-page dark:hover:bg-zinc-800`}
                  >
                    {productTypeFilterLabel(filters.productTypes)}
                  </button>
                </HeaderFilterCell>
                <HeaderFilterCell>
                  <input
                    type="search"
                    aria-label="Search product"
                    placeholder="Search product"
                    value={filters.productSearch}
                    onChange={(e) => setFilters((f) => ({ ...f, productSearch: e.target.value }))}
                    className={filterSelectClass}
                  />
                </HeaderFilterCell>
                <HeaderFilterCell
                  includeAll={
                    <IncludeAllCheckbox
                      checked={filters.includeAllElevate}
                      onChange={(next) => setFilters((f) => ({ ...f, includeAllElevate: next }))}
                      title="When an elevate level is selected (e.g. Investor), also show SKU rows with All."
                    />
                  }
                >
                  <select
                    aria-label="Filter elevate level"
                    value={filters.elevateLevel}
                    onChange={(e) => setFilters((f) => ({ ...f, elevateLevel: e.target.value }))}
                    className={filterSelectClass}
                  >
                    <option value={EMPTY_FILTER}>All</option>
                    {filterOptions.elevateLevel.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </HeaderFilterCell>
                <HeaderFilterCell
                  includeAll={
                    <IncludeAllCheckbox
                      checked={filters.includeAllStyle}
                      onChange={(next) => setFilters((f) => ({ ...f, includeAllStyle: next }))}
                      title="When a style is selected, also show SKU rows with All."
                    />
                  }
                >
                  <select
                    aria-label="Filter style"
                    value={filters.style}
                    onChange={(e) => setFilters((f) => ({ ...f, style: e.target.value }))}
                    className={filterSelectClass}
                  >
                    <option value={EMPTY_FILTER}>All</option>
                    {filterOptions.style.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </HeaderFilterCell>
                <HeaderFilterCell />
                <HeaderFilterCell>
                  <select
                    aria-label="Filter on sheet"
                    value={currentScope}
                    onChange={(e) => setCurrentScope(e.target.value as CurrentScope)}
                    className={filterSelectClass}
                  >
                    <option value="current">Current only</option>
                    <option value="archived">Not on sheet</option>
                    <option value="all">All</option>
                  </select>
                </HeaderFilterCell>
                {Array.from({ length: TABLE_COL_COUNT - 8 }, (_, i) => (
                  <HeaderFilterCell key={`filter-pad-${i}`} />
                ))}
              </tr>
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
                <SortableTh
                  label="M2"
                  sortKey="calcM2"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="M²"
                  sortKey="calculatedM2"
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
                  label="App1 Type"
                  sortKey="append1Type"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="App1 Spec"
                  sortKey="append1Spec"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="App2 Type"
                  sortKey="append2Type"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="App2 Spec"
                  sortKey="append2Spec"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="App3 Type"
                  sortKey="append3Type"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableTh
                  label="App3 Spec"
                  sortKey="append3Spec"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <th className="py-2 pr-3 font-medium">UOM</th>
                <th className="py-2 pr-3 font-medium">Sheet rows</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COL_COUNT} className="py-8 text-center text-sf-text-secondary">
                    Loading data_skus…
                  </td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COL_COUNT} className="py-8 text-center text-sf-text-secondary">
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
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={row.calcM2}
                        disabled={calcM2SavingId === row.skuId}
                        aria-label={`M2 for ${row.skuId}`}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void toggleCalcM2(row, e.target.checked)}
                      />
                    </td>
                    <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                      <input
                        key={`${row.skuId}-m2-${row.calculatedM2 ?? ""}-${row.calcM2}`}
                        type="text"
                        inputMode="decimal"
                        className="min-h-8 w-[5.5rem] rounded border border-sf-border bg-sf-surface px-1.5 py-1 text-sm tabular-nums disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900"
                        defaultValue={formatCalculatedM2Input(row.calculatedM2)}
                        disabled={!row.calcM2 || calculatedM2SavingId === row.skuId}
                        aria-label={`M² for ${row.skuId}`}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        onBlur={(e) => {
                          try {
                            const next = parseCalculatedM2Input(e.target.value);
                            if (next === row.calculatedM2) return;
                            void saveCalculatedM2(row, next);
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "Invalid M² value",
                            );
                            e.target.value = formatCalculatedM2Input(row.calculatedM2);
                          }
                        }}
                      />
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
                    <td className="max-w-[8rem] py-2 pr-3 text-xs whitespace-nowrap">
                      {row.append1Type || "—"}
                    </td>
                    <td className="max-w-[10rem] py-2 pr-3 text-xs">
                      {row.append1Spec || "—"}
                    </td>
                    <td className="max-w-[8rem] py-2 pr-3 text-xs whitespace-nowrap">
                      {row.append2Type || "—"}
                    </td>
                    <td className="max-w-[10rem] py-2 pr-3 text-xs">
                      {row.append2Spec || "—"}
                    </td>
                    <td className="max-w-[8rem] py-2 pr-3 text-xs whitespace-nowrap">
                      {row.append3Type || "—"}
                    </td>
                    <td className="max-w-[10rem] py-2 pr-3 text-xs">
                      {row.append3Spec || "—"}
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
          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <span className="text-sf-text-secondary dark:text-zinc-400">Product</span>
              <span className="mt-0.5 block">{selectedProduct.product || "—"}</span>
            </p>
            <p>
              <span className="text-sf-text-secondary dark:text-zinc-400">
                Product row — Append 1
              </span>
              <span className="mt-0.5 block">
                {selectedProduct.append1Type || selectedProduct.append1Spec
                  ? `${selectedProduct.append1Type || "—"} · ${selectedProduct.append1Spec || "—"}`
                  : "—"}
              </span>
            </p>
            <p>
              <span className="text-sf-text-secondary dark:text-zinc-400">
                Product row — Append 2
              </span>
              <span className="mt-0.5 block">
                {selectedProduct.append2Type || selectedProduct.append2Spec
                  ? `${selectedProduct.append2Type || "—"} · ${selectedProduct.append2Spec || "—"}`
                  : "—"}
              </span>
            </p>
            <p>
              <span className="text-sf-text-secondary dark:text-zinc-400">
                Product row — Append 3
              </span>
              <span className="mt-0.5 block">
                {selectedProduct.append3Type || selectedProduct.append3Spec
                  ? `${selectedProduct.append3Type || "—"} · ${selectedProduct.append3Spec || "—"}`
                  : "—"}
              </span>
            </p>
          </div>
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
                    <th className="py-2 pr-3 font-medium">Option Append 1</th>
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
                      <td className="py-2 pr-3 text-xs">
                        {s.append1Type || s.append1Spec
                          ? `${s.append1Type || "—"} · ${s.append1Spec || "—"}`
                          : "—"}
                      </td>
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

      {productTypePickerOpen ? (
        <ModalFrame
          wide
          title="Filter by product type"
          description="Select one or more types. Includes parent productType and append slot types (App1–App3). Rows match if any selected type appears on the row."
          onClose={() => setProductTypePickerOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="inline-flex min-h-10 items-center rounded border border-sf-border px-3 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
                onClick={() => setProductTypePickerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={sfPrimaryToolbarButton}
                onClick={applyProductTypePicker}
              >
                Apply
              </button>
            </>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={productTypeSearch}
              onChange={(e) => setProductTypeSearch(e.target.value)}
              placeholder="Search types…"
              className="min-h-10 min-w-[12rem] flex-1 rounded border border-sf-border bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <button
              type="button"
              className="inline-flex min-h-10 items-center rounded border border-sf-border px-3 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
              onClick={() => setProductTypeDraft([...filteredProductTypeOptions])}
            >
              Select all shown
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center rounded border border-sf-border px-3 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
              onClick={() => setProductTypeDraft([])}
            >
              Clear
            </button>
          </div>
          {productTypeOptions.length === 0 ? (
            <p className="text-sm text-sf-text-secondary">No product types in catalog.</p>
          ) : filteredProductTypeOptions.length === 0 ? (
            <p className="text-sm text-sf-text-secondary">No types match search.</p>
          ) : (
            <ul className="max-h-[50dvh] space-y-1 overflow-y-auto rounded border border-sf-border p-2 dark:border-zinc-700">
              {filteredProductTypeOptions.map((opt) => {
                const checked = productTypeDraft.includes(opt);
                return (
                  <li key={opt}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-sf-page dark:hover:bg-zinc-800/60">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0"
                        checked={checked}
                        onChange={(e) => {
                          setProductTypeDraft((prev) =>
                            e.target.checked
                              ? [...prev, opt]
                              : prev.filter((v) => v !== opt),
                          );
                        }}
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-sf-text-secondary dark:text-zinc-400">
            {productTypeDraft.length === 0
              ? "No types selected — shows all product types."
              : `${productTypeDraft.length} type(s) selected.`}
          </p>
        </ModalFrame>
      ) : null}
    </div>
  );
}
