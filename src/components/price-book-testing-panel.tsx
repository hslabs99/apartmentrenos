"use client";

import { ModalFrame } from "@/components/modal-frame";
import { readApiJson } from "@/lib/client/read-api-json";
import {
  cascadeColoursForLevelStyle,
  cascadeStylesForLevel,
  distinctCascadeLevels,
  withSavedChoice,
  type CascadeRow,
} from "@/lib/cascades/cascade-filter-options";
import { normalizeDataObjectPart } from "@/lib/data-object-key";
import {
  distinctLookupValues,
  excludeAllFromChoices,
} from "@/lib/lookup-list-values";
import { filterDataSkusWithCascadeFallback } from "@/lib/sku/match-data-sku-filters";
import { useLookupsColours } from "@/lib/client/use-lookups-colours";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";
import { LOOKUP_TYPE_STYLE } from "@/lib/lookup-types";
import { sfDataSurface, sfPrimaryToolbarButton } from "@/lib/sf-layout";
import type { DataObjectPublic } from "@/types/data-object-public";
import type { LookupPublic } from "@/types/lookup";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import { useCallback, useEffect, useMemo, useState } from "react";

function distinctSorted(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    set.add(t || "(blank)");
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function displayProduct(product: string): string {
  const t = product.trim();
  return t || "(blank)";
}

function blankLabel(value: string): string {
  const t = value.trim();
  return t || "(blank)";
}

/** Dropdown choices from imported SKUs and prepared data_objects (same coverage as Data tab). */
function distinctFieldChoices(
  skus: DataSkuPublic[],
  objects: DataObjectPublic[],
  pickSku: (s: DataSkuPublic) => string,
  pickObj: (o: DataObjectPublic) => string,
): string[] {
  return distinctSorted(
    excludeAllFromChoices([
      ...skus.map((s) => blankLabel(pickSku(s))),
      ...objects.map((o) => blankLabel(pickObj(o))),
    ]),
  );
}

function skusMatchingCategory(skus: DataSkuPublic[], categoryChoice: string): DataSkuPublic[] {
  if (!categoryChoice.trim()) return skus;
  const norm = normalizeDataObjectPart(choiceToRaw(categoryChoice));
  return skus.filter((s) => normalizeDataObjectPart(s.category) === norm);
}

function skusMatchingCategoryAndType(
  skus: DataSkuPublic[],
  categoryChoice: string,
  productTypeChoice: string,
): DataSkuPublic[] {
  let pool = skusMatchingCategory(skus, categoryChoice);
  if (!productTypeChoice.trim()) return pool;
  const norm = normalizeDataObjectPart(choiceToRaw(productTypeChoice));
  return pool.filter((s) => normalizeDataObjectPart(s.productType) === norm);
}

function choiceToRaw(choice: string): string {
  return choice === "(blank)" ? "" : choice.trim();
}

function objectMatchesCategoryAndType(
  o: DataObjectPublic,
  category: string,
  productType: string,
): boolean {
  return (
    normalizeDataObjectPart(o.category) === normalizeDataObjectPart(choiceToRaw(category)) &&
    normalizeDataObjectPart(o.productType) === normalizeDataObjectPart(choiceToRaw(productType))
  );
}

function objectMatchesChoices(
  o: DataObjectPublic,
  category: string,
  productType: string,
  _productChoice: string,
): boolean {
  return objectMatchesCategoryAndType(o, category, productType);
}

function formatMoney(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isOpenFilter(choice: string): boolean {
  const t = choice.trim();
  return t === "" || t === "All";
}

/** Hardcoded elevate tiers for price book testing (until driven from lookups). */
const ELEVATE_LEVEL_OPTIONS = [
  "All",
  "Investor",
  "Investor-Plus",
  "Executive",
] as const;

const PREFERRED_SUPPLIER_OPTION = 1;

type PrimarySupplierSummary = {
  supplier: string;
  priceExcGst: number | null;
  /** Lowest supplier option on file for this SKU (1 preferred; 2, 3, … as fallback). */
  supplierOption: number;
};

/** Best supplier row per SKU: option 1, else 2, else 3, else lowest option available. */
function buildPrimarySupplierBySkuId(
  items: DataSkuSupplierPublic[],
): Record<string, PrimarySupplierSummary> {
  const bySku = new Map<string, DataSkuSupplierPublic[]>();
  for (const s of items) {
    if (!isValidSupplierOption(s.supplierOption)) continue;
    const list = bySku.get(s.skuId) ?? [];
    list.push(s);
    bySku.set(s.skuId, list);
  }

  const out: Record<string, PrimarySupplierSummary> = {};
  for (const [skuId, list] of bySku) {
    const sorted = [...list].sort((a, b) => a.supplierOption - b.supplierOption);
    const best = sorted[0];
    if (!best) continue;
    out[skuId] = {
      supplier: best.supplier.trim(),
      priceExcGst: best.priceExcGst,
      supplierOption: best.supplierOption,
    };
  }
  return out;
}

function activeFilterLabels(filters: {
  category: string;
  productType: string;
  productChoice: string;
  elevateLevel: string;
  styleChoice: string;
  colourChoice: string;
}): string[] {
  const parts: string[] = [];
  if (!isOpenFilter(filters.elevateLevel)) parts.push(`price level ${filters.elevateLevel}`);
  if (!isOpenFilter(filters.styleChoice)) parts.push(`style ${filters.styleChoice}`);
  if (!isOpenFilter(filters.colourChoice)) parts.push(`colour ${filters.colourChoice}`);
  if (filters.category) parts.push(`category ${filters.category}`);
  if (filters.productType) parts.push(`type ${filters.productType}`);
  if (filters.productChoice) parts.push(`product ${filters.productChoice}`);
  return parts;
}

type Props = {
  /** When false, panel stays mounted but hidden (parent tab); close overlay modals. */
  isActive?: boolean;
};

export function PriceBookTestingPanel({ isActive = true }: Props) {
  const { colourLookupIndex } = useLookupsColours();
  const [dataObjects, setDataObjects] = useState<DataObjectPublic[]>([]);
  const [catalogSkus, setCatalogSkus] = useState<DataSkuPublic[]>([]);
  const [cascades, setCascades] = useState<CascadeRow[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(true);
  const [objectsError, setObjectsError] = useState<string | null>(null);

  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [productChoice, setProductChoice] = useState("");
  const [elevateLevel, setElevateLevel] = useState<string>("All");
  const [styleChoice, setStyleChoice] = useState<string>("All");
  const [colourChoice, setColourChoice] = useState<string>("All");

  const [lookups, setLookups] = useState<LookupPublic[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  const [skuRows, setSkuRows] = useState<DataSkuPublic[] | null>(null);
  const [primarySupplierBySkuId, setPrimarySupplierBySkuId] = useState<
    Record<string, PrimarySupplierSummary>
  >({});
  const [skusLoading, setSkusLoading] = useState(false);
  const [skusError, setSkusError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<DataSkuPublic | null>(null);
  const [suppliers, setSuppliers] = useState<DataSkuSupplierPublic[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  const loadFilterCatalog = useCallback(async () => {
    setObjectsLoading(true);
    try {
      const [objRes, skuRes, cascadeRes] = await Promise.all([
        fetch("/api/data-objects"),
        fetch("/api/data-skus"),
        fetch("/api/cascades"),
      ]);
      const objData = await readApiJson<{ items: DataObjectPublic[]; error?: string }>(objRes);
      const skuData = await readApiJson<{ items: DataSkuPublic[]; error?: string }>(skuRes);
      const cascadeData = await readApiJson<{
        items?: { level: string; style: string; colour: string }[];
        error?: string;
      }>(cascadeRes);
      if (!objRes.ok) throw new Error(objData.error ?? "Failed to load data_objects");
      if (!skuRes.ok) throw new Error(skuData.error ?? "Failed to load data_skus");
      setDataObjects(objData.items ?? []);
      setCatalogSkus(skuData.items ?? []);
      setCascades(
        cascadeRes.ok
          ? (cascadeData.items ?? []).map((r) => ({
              level: r.level,
              style: r.style,
              colour: r.colour,
            }))
          : [],
      );
      setObjectsError(null);
    } catch (e) {
      setObjectsError(e instanceof Error ? e.message : "Failed to load filter catalog");
      setDataObjects([]);
      setCatalogSkus([]);
      setCascades([]);
    } finally {
      setObjectsLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    try {
      const res = await fetch("/api/lookups");
      const data = await readApiJson<{ lookups: LookupPublic[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load lookups");
      setLookups(data.lookups ?? []);
      setLookupsError(null);
    } catch (e) {
      setLookupsError(e instanceof Error ? e.message : "Failed to load lookups");
      setLookups([]);
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (!isActive) return;
    void loadFilterCatalog();
  }, [isActive, loadFilterCatalog]);

  const priceLevelOptions = useMemo(() => {
    const fromCascade = distinctCascadeLevels(cascades);
    if (fromCascade.length > 0) return ["All", ...fromCascade] as const;
    return ELEVATE_LEVEL_OPTIONS;
  }, [cascades]);

  const cascadeLevel = isOpenFilter(elevateLevel) ? "" : elevateLevel.trim();

  const styleOptions = useMemo(() => {
    const fromCascade = cascadeStylesForLevel(cascades, cascadeLevel);
    if (fromCascade.length > 0) {
      return ["All", ...fromCascade];
    }
    return ["All", ...distinctLookupValues(lookups, LOOKUP_TYPE_STYLE)];
  }, [cascades, cascadeLevel, lookups]);

  const colourOptions = useMemo(() => {
    if (isOpenFilter(elevateLevel) || isOpenFilter(styleChoice)) {
      return ["All"];
    }
    const styleRaw = choiceToRaw(styleChoice);
    const fromCascade = cascadeColoursForLevelStyle(cascades, cascadeLevel, styleRaw);
    if (fromCascade.length > 0) {
      const saved = colourChoice === "All" ? "" : colourChoice;
      return ["All", ...withSavedChoice(fromCascade, saved)];
    }
    return [
      "All",
      ...distinctSorted(
        excludeAllFromChoices(catalogSkus.map((s) => blankLabel(s.colourOptions))),
      ),
    ];
  }, [cascades, cascadeLevel, elevateLevel, styleChoice, colourChoice, catalogSkus]);

  const styleSelectDisabled =
    lookupsLoading || (cascades.length > 0 && !cascadeLevel);
  const colourSelectDisabled =
    objectsLoading ||
    (cascades.length > 0 &&
      (isOpenFilter(elevateLevel) || isOpenFilter(styleChoice) || !cascadeLevel));

  const categoryOptions = useMemo(
    () =>
      distinctFieldChoices(
        catalogSkus,
        dataObjects,
        (s) => s.category,
        (o) => o.category,
      ),
    [catalogSkus, dataObjects],
  );

  const typeOptions = useMemo(() => {
    const skuPool = skusMatchingCategory(catalogSkus, category);
    const objPool = category
      ? dataObjects.filter(
          (o) =>
            normalizeDataObjectPart(o.category) ===
            normalizeDataObjectPart(choiceToRaw(category)),
        )
      : dataObjects;
    return distinctFieldChoices(
      skuPool,
      objPool,
      (s) => s.productType,
      (o) => o.productType,
    );
  }, [catalogSkus, dataObjects, category]);

  const productOptions = useMemo(() => {
    const skuPool = skusMatchingCategoryAndType(catalogSkus, category, productType);
    let objPool = dataObjects;
    if (category) {
      objPool = objPool.filter(
        (o) =>
          normalizeDataObjectPart(o.category) ===
          normalizeDataObjectPart(choiceToRaw(category)),
      );
    }
    if (productType) {
      objPool = objPool.filter(
        (o) =>
          normalizeDataObjectPart(o.productType) ===
          normalizeDataObjectPart(choiceToRaw(productType)),
      );
    }
    return distinctFieldChoices(
      skuPool,
      objPool,
      (s) => s.product,
      (o) => o.product,
    );
  }, [catalogSkus, dataObjects, category, productType]);

  const selectedDataObject = useMemo((): DataObjectPublic | null => {
    if (!category || !productType || !productChoice) return null;
    return (
      dataObjects.find((o) =>
        objectMatchesChoices(o, category, productType, productChoice),
      ) ?? null
    );
  }, [dataObjects, category, productType, productChoice]);

  const filterSnapshot = useMemo(
    () => ({
      category,
      productType,
      productChoice,
      elevateLevel,
      styleChoice,
      colourChoice,
    }),
    [category, productType, productChoice, elevateLevel, styleChoice, colourChoice],
  );

  const activeFilters = useMemo(
    () => activeFilterLabels(filterSnapshot),
    [filterSnapshot],
  );

  const onCategoryChange = (value: string) => {
    setCategory(value);
    setProductType("");
    setProductChoice("");
  };

  const onProductTypeChange = (value: string) => {
    setProductType(value);
    setProductChoice("");
  };

  const onProductChange = (value: string) => {
    setProductChoice(value);
  };

  const onElevateLevelChange = (value: string) => {
    setElevateLevel(value);
    setStyleChoice("All");
    setColourChoice("All");
  };

  const onStyleChange = (value: string) => {
    setStyleChoice(value);
    setColourChoice("All");
  };

  const onColourChange = (value: string) => {
    const raw = value.replace(/\s+\(saved\)$/i, "").trim();
    setColourChoice(raw || "All");
  };

  const loadSkus = useCallback(
    async (filters: typeof filterSnapshot, signal: { cancelled: boolean }) => {
      setSkusLoading(true);
      setSkusError(null);
      try {
        const [skuRes, supRes] = await Promise.all([
          fetch("/api/data-skus"),
          fetch("/api/data-sku-suppliers"),
        ]);
        const skuData = await readApiJson<{ items: DataSkuPublic[]; error?: string }>(skuRes);
        const supData = await readApiJson<{
          items: DataSkuSupplierPublic[];
          error?: string;
        }>(supRes);
        if (!skuRes.ok) throw new Error(skuData.error ?? "Failed to load data_skus");
        if (!supRes.ok) throw new Error(supData.error ?? "Failed to load data_sku_suppliers");
        if (signal.cancelled) return;
        const matched = filterDataSkusWithCascadeFallback(skuData.items ?? [], {
          category: filters.category,
          productType: filters.productType,
          product: filters.productChoice,
          elevateLevel: filters.elevateLevel,
          style: filters.styleChoice,
          colour: filters.colourChoice,
        }, {
          includeAllDimensionSkuRows: true,
          colourLookupIndex,
        });
        matched.sort((a, b) => a.skuId.localeCompare(b.skuId, undefined, { sensitivity: "base" }));
        setSkuRows(matched);
        setPrimarySupplierBySkuId(buildPrimarySupplierBySkuId(supData.items ?? []));
      } catch (e) {
        if (!signal.cancelled) {
          setSkusError(e instanceof Error ? e.message : "Failed to load SKUs");
          setPrimarySupplierBySkuId({});
        }
      } finally {
        if (!signal.cancelled) setSkusLoading(false);
      }
    },
    [colourLookupIndex],
  );

  useEffect(() => {
    if (!isActive) return;
    const signal = { cancelled: false };
    void loadSkus(filterSnapshot, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [filterSnapshot, isActive, loadSkus, colourLookupIndex]);

  const loadSuppliers = useCallback(async (skuId: string) => {
    setSuppliersLoading(true);
    setSuppliersError(null);
    try {
      const res = await fetch(`/api/data-sku-suppliers?skuId=${encodeURIComponent(skuId)}`);
      const data = await readApiJson<{ items: DataSkuSupplierPublic[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load suppliers");
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
    void loadSuppliers(row.skuId);
  };

  const closeModal = useCallback(() => {
    setSelectedProduct(null);
    setSuppliers([]);
    setSuppliersError(null);
  }, []);

  useEffect(() => {
    if (!isActive) closeModal();
  }, [isActive, closeModal]);

  const selectClass =
    "min-h-10 w-full rounded border border-sf-border bg-sf-surface px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900";

  return (
    <div className="-mx-4 flex flex-col gap-4 md:-mx-6 lg:-mx-8">
      <section className={`${sfDataSurface} mx-4 flex flex-col gap-4 p-4 md:mx-6 md:p-5 lg:mx-8`}>
        <div>
          <h2 className="text-base font-semibold text-sf-text dark:text-zinc-100">
            Price book testing
          </h2>
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            Category, type, and product lists come from <code className="text-xs">data_skus</code>{" "}
            and <code className="text-xs">data_objects</code>. Style and colour options follow{" "}
            <code className="text-xs">cascades</code> (Import Master Prices → Import Cascades) for the chosen price
            level and style. Leave blank or <strong>All</strong> to ignore a dimension.
          </p>
        </div>

        {objectsLoading ? (
          <p className="text-sm text-sf-text-secondary">Loading data objects…</p>
        ) : null}
        {objectsError ? (
          <p className="text-sm text-red-800 dark:text-red-300">{objectsError}</p>
        ) : null}
        {!objectsLoading &&
        !objectsError &&
        dataObjects.length === 0 &&
        catalogSkus.length === 0 ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            No SKUs or data objects for category/type/product dropdowns — run a SKU import and/or{" "}
            <strong>Prepare Objects</strong> on Import, or filter by price level / style / colour only.
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-sf-text-secondary dark:text-zinc-400">Price level</span>
              <select
                value={elevateLevel}
                onChange={(e) => onElevateLevelChange(e.target.value)}
                className={selectClass}
              >
                {priceLevelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-sf-text-secondary dark:text-zinc-400">Style</span>
              <select
                value={styleChoice}
                onChange={(e) => onStyleChange(e.target.value)}
                disabled={styleSelectDisabled}
                title={
                  cascades.length > 0 && !cascadeLevel
                    ? "Choose a price level (not All) to filter styles from cascades"
                    : undefined
                }
                className={selectClass}
              >
                {styleOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-sf-text-secondary dark:text-zinc-400">Colour</span>
              <select
                value={colourChoice}
                onChange={(e) => onColourChange(e.target.value)}
                disabled={colourSelectDisabled}
                title={
                  isOpenFilter(elevateLevel) || isOpenFilter(styleChoice)
                    ? "Choose a specific price level and style to pick a cascade colour"
                    : undefined
                }
                className={selectClass}
              >
                {colourOptions.map((c) => {
                  const value = c.replace(/\s+\(saved\)$/i, "").trim() || "All";
                  return (
                    <option key={c} value={value}>
                      {c}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-sf-text-secondary dark:text-zinc-400">Category</span>
              <select
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
                disabled={objectsLoading}
                className={selectClass}
              >
                <option value="">All</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-sf-text-secondary dark:text-zinc-400">Product type</span>
              <select
                value={productType}
                onChange={(e) => onProductTypeChange(e.target.value)}
                disabled={objectsLoading}
                className={selectClass}
              >
                <option value="">All</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-sf-text-secondary dark:text-zinc-400">Product</span>
              <select
                value={productChoice}
                onChange={(e) => onProductChange(e.target.value)}
                disabled={objectsLoading}
                className={selectClass}
              >
                <option value="">All</option>
                {productOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {skusLoading ? (
          <p className="text-sm text-sf-text-secondary" role="status">
            Loading SKUs…
          </p>
        ) : null}

        {lookupsError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
            Style list unavailable: {lookupsError}. Import Lists or add Style lookups in Setup.
          </p>
        ) : null}

        {selectedDataObject ? (
          <p className="text-xs text-sf-text-weak dark:text-zinc-500">
            Data object UOM {selectedDataObject.uom || "—"}
            {selectedDataObject.objectid != null
              ? ` · Quote object #${selectedDataObject.objectid}`
              : ""}
          </p>
        ) : null}
        {skuRows != null ? (
          <p className="text-xs text-sf-text-weak dark:text-zinc-500">
            {activeFilters.length > 0
              ? `Filters: ${activeFilters.join(" · ")}`
              : "No filters applied — showing all SKUs."}
          </p>
        ) : null}

        {skusError ? (
          <p className="text-sm text-red-800 dark:text-red-300" role="alert">
            {skusError}
          </p>
        ) : null}
      </section>

      {skuRows != null ? (
        <section className={`${sfDataSurface} mx-4 overflow-hidden md:mx-6 lg:mx-8`}>
          <p className="border-b border-sf-border px-4 py-3 text-sm text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400 md:px-5">
            {skusLoading ? (
              <span className="mr-2 text-sf-brand dark:text-[#58a9f5]">Updating…</span>
            ) : null}
            {skuRows.length === 0
              ? activeFilters.length > 0
                ? `No SKU rows match: ${activeFilters.join(", ")}.`
                : "No SKU rows in data_skus."
              : `${skuRows.length} SKU row${skuRows.length === 1 ? "" : "s"}${activeFilters.length > 0 ? ` (${activeFilters.join(", ")})` : ""} — click a supplier count for details.`}
          </p>
          <div className="max-h-[calc(100dvh-18rem)] overflow-auto px-4 py-3 md:px-5 lg:px-6">
            <table className="w-full min-w-[1560px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-sf-surface dark:bg-zinc-900">
                <tr className="border-b border-sf-border dark:border-zinc-700">
                  <th className="py-2 pr-3 pl-1 font-medium">SKU ID</th>
                  <th className="py-2 pr-3 font-medium">Sheet row</th>
                  <th className="py-2 pr-3 font-medium">Product type</th>
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">Elevate</th>
                  <th className="py-2 pr-3 font-medium">Style</th>
                  <th className="py-2 pr-3 font-medium">Colour</th>
                  <th className="py-2 pr-3 font-medium">UOM</th>
                  <th className="py-2 pr-3 font-medium">Current</th>
                  <th className="py-2 pr-3 font-medium">Suppliers</th>
                  <th className="py-2 pr-3 font-medium">Supplier</th>
                  <th className="py-2 pr-3 font-medium">$ exc GST</th>
                </tr>
              </thead>
              <tbody>
                {skuRows.map((row) => {
                  const primary = primarySupplierBySkuId[row.skuId];
                  return (
                  <tr
                    key={row.id}
                    className="border-b border-sf-border/80 dark:border-zinc-800"
                  >
                    <td className="py-2 pl-1 pr-3 font-mono text-xs font-medium text-sf-text dark:text-zinc-200">
                      {row.skuId}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-sf-text-secondary dark:text-zinc-400">
                      {row.sourceSheetRows.length ? row.sourceSheetRows.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.productType || "—"}</td>
                    <td className="max-w-xs py-2 pr-3">{row.product || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.elevateLevel || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.style || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.colourOptions || "—"}</td>
                    <td className="py-2 pr-3">{row.uom || "—"}</td>
                    <td className="py-2 pr-3">
                      {row.isCurrent ? (
                        <span className="text-green-700 dark:text-green-400">Yes</span>
                      ) : (
                        <span className="text-sf-text-weak">No</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      <button
                        type="button"
                        className="font-medium text-sf-brand underline decoration-sf-brand/70 underline-offset-2 hover:text-sf-brand-hover dark:text-[#58a9f5] dark:decoration-[#58a9f5]/70"
                        onClick={() => openProduct(row)}
                        aria-label={`View ${row.supplierCount} supplier option(s) for ${row.skuId}`}
                      >
                        {row.supplierCount}
                      </button>
                    </td>
                    <td className="max-w-[12rem] py-2 pr-3 whitespace-nowrap">
                      {primary?.supplier ? (
                        <span
                          className={
                            primary.supplierOption !== PREFERRED_SUPPLIER_OPTION
                              ? "font-medium text-red-700 dark:text-red-400"
                              : undefined
                          }
                          title={
                            primary.supplierOption !== PREFERRED_SUPPLIER_OPTION
                              ? `No priority 1 supplier — showing P${primary.supplierOption}`
                              : "Priority 1 supplier"
                          }
                        >
                          {primary.supplier}
                          {primary.supplierOption !== PREFERRED_SUPPLIER_OPTION
                            ? ` (P${primary.supplierOption})`
                            : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                      {formatMoney(primary?.priceExcGst ?? null)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedProduct ? (
        <ModalFrame
          wide
          panelClassName="!w-[min(98vw,105rem)] !max-w-[min(98vw,105rem)]"
          title={`Suppliers — ${selectedProduct.skuId}`}
          description={`${selectedProduct.category} · ${selectedProduct.productType} · ${selectedProduct.product} · ${selectedProduct.elevateLevel} · ${selectedProduct.style} · ${selectedProduct.colourOptions}`}
          onClose={closeModal}
          footer={
            <button type="button" className={sfPrimaryToolbarButton} onClick={closeModal}>
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
