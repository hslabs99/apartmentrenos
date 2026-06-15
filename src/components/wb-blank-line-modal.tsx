"use client";

import { CascadeColourSelect } from "@/components/cascade-style-colour-fields";
import { CascadeElevateSelect } from "@/components/cascade-elevate-select";
import { ModalFrame } from "@/components/modal-frame";
import { cascadeLevelFromPriceLevel } from "@/lib/cascades/cascade-level-from-price-level";
import {
  formatCurrencyInput,
  parseCurrencyInput,
} from "@/lib/client/format-money";
import {
  findSupplierRowByName,
  matchCatalogSkuByProductName,
} from "@/lib/client/scope-line-sku-match";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { useEffect, useId, useMemo, useState } from "react";

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function quoteObjectLabel(q: QuoteObjectPublic): string {
  const name = q.objectname?.trim() || `Object #${q.objectid}`;
  const cat = q.category?.trim();
  return cat ? `${cat} · ${name}` : name;
}

function uniqueSortedValues(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function uniqueCatalogProducts(catalogSkus: DataSkuPublic[]): string[] {
  return uniqueSortedValues(
    catalogSkus.filter((sku) => sku.isCurrent !== false).map((sku) => sku.product),
  );
}

function uniqueCatalogSuppliers(
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): string[] {
  const names: string[] = [];
  for (const rows of Object.values(suppliersBySkuId)) {
    for (const row of rows) {
      names.push(row.supplier);
    }
  }
  return uniqueSortedValues(names);
}

function uniqueCatalogUoms(catalogSkus: DataSkuPublic[]): string[] {
  return uniqueSortedValues(catalogSkus.map((sku) => sku.uom));
}

function uniqueSupplierSkusForSku(
  skuId: string | null,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): string[] {
  if (skuId) {
    return uniqueSortedValues((suppliersBySkuId[skuId] ?? []).map((row) => row.supplierSku));
  }
  const codes: string[] = [];
  for (const rows of Object.values(suppliersBySkuId)) {
    for (const row of rows) {
      codes.push(row.supplierSku);
    }
  }
  return uniqueSortedValues(codes);
}

export type WbBlankLineSaveBody = {
  quoteObjectDocId: string;
  pricelevelid: number | null;
  style: string | null;
  colour: string | null;
  custommeasure: number | null;
  customuom: string;
  customumprice: number | null;
  skuId: string | null;
  skuProduct: string;
  supplierOption: number | null;
  manualSupplier: string | null;
  manualSupplierSku: string | null;
};

type Props = {
  open: boolean;
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  quoteObjects: QuoteObjectPublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  priceLevels: PriceLevelPublic[];
  cascades: CascadeRow[];
  baseStyleOptions: { out: string[]; seen: Set<string> };
  effectiveCascadeStyleForLine: (
    line: ProjectAreaObjectPublic,
    pa: ProjectAreaPublic,
    project: ProjectPublic | null,
  ) => string;
  wbLineColourEmptyLabel: (pa: ProjectAreaPublic, project: ProjectPublic | null) => string;
  saving: boolean;
  onClose: () => void;
  onSave: (body: WbBlankLineSaveBody) => void;
};

const fieldInputClass =
  "min-h-10 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";
const fieldReadOnlyClass =
  "min-h-10 w-full rounded-lg border border-sf-border bg-sf-page px-3 py-2 font-mono text-sm text-sf-text-secondary dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300";
const fieldLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400";
const fieldHintClass = "text-[11px] text-sf-text-weak dark:text-zinc-500";

function CatalogComboInput({
  id,
  listId,
  label,
  value,
  options,
  disabled,
  placeholder,
  hint = "Choose from list or type a value",
  onChange,
}: {
  id: string;
  listId: string;
  label: string;
  value: string;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className={fieldLabelClass}>{label}</span>
      <input
        id={id}
        type="text"
        list={listId}
        className={fieldInputClass}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {hint ? <span className={fieldHintClass}>{hint}</span> : null}
    </label>
  );
}

export function WbBlankLineModal({
  open,
  pa,
  project,
  quoteObjects,
  catalogSkus,
  suppliersBySkuId,
  priceLevels,
  cascades,
  baseStyleOptions,
  effectiveCascadeStyleForLine,
  wbLineColourEmptyLabel,
  saving,
  onClose,
  onSave,
}: Props) {
  const productListId = useId();
  const supplierListId = useId();
  const supplierSkuListId = useId();
  const uomListId = useId();

  const sortedQuoteObjects = useMemo(
    () =>
      [...quoteObjects].sort((a, b) =>
        quoteObjectLabel(a).localeCompare(quoteObjectLabel(b), undefined, {
          sensitivity: "base",
        }),
      ),
    [quoteObjects],
  );

  const productOptions = useMemo(() => uniqueCatalogProducts(catalogSkus), [catalogSkus]);
  const supplierOptions = useMemo(
    () => uniqueCatalogSuppliers(suppliersBySkuId),
    [suppliersBySkuId],
  );
  const uomOptions = useMemo(() => uniqueCatalogUoms(catalogSkus), [catalogSkus]);

  const [quoteObjectDocId, setQuoteObjectDocId] = useState("");
  const [pricelevelid, setPricelevelid] = useState<number | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [colour, setColour] = useState<string | null>(null);
  const [measureStr, setMeasureStr] = useState("");
  const [uom, setUom] = useState("");
  const [unitPriceStr, setUnitPriceStr] = useState("");
  const [skuProduct, setSkuProduct] = useState("");
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualSupplierSku, setManualSupplierSku] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuoteObjectDocId("");
    setPricelevelid(null);
    setStyle(null);
    setColour(null);
    setMeasureStr("");
    setUom("");
    setUnitPriceStr("");
    setSkuProduct("");
    setManualSupplier("");
    setManualSupplierSku("");
    setFormError(null);
  }, [open]);

  const selectedQuoteObject = sortedQuoteObjects.find((q) => q.id === quoteObjectDocId);
  const effectiveUom = uom.trim() || selectedQuoteObject?.uom?.trim() || "ea";

  const matchedCatalogSku = useMemo(
    () => matchCatalogSkuByProductName(skuProduct, catalogSkus),
    [skuProduct, catalogSkus],
  );
  const resolvedSkuId = matchedCatalogSku?.skuId ?? null;

  const resolvedSupplierRow = useMemo(() => {
    if (!resolvedSkuId || !manualSupplier.trim()) return null;
    return findSupplierRowByName(resolvedSkuId, manualSupplier, suppliersBySkuId);
  }, [resolvedSkuId, manualSupplier, suppliersBySkuId]);

  const supplierSkuOptions = useMemo(
    () => uniqueSupplierSkusForSku(resolvedSkuId, suppliersBySkuId),
    [resolvedSkuId, suppliersBySkuId],
  );

  useEffect(() => {
    if (!resolvedSupplierRow) return;
    setManualSupplierSku(resolvedSupplierRow.supplierSku.trim());
  }, [resolvedSupplierRow]);

  useEffect(() => {
    if (!matchedCatalogSku?.uom?.trim() || uom.trim()) return;
    setUom(matchedCatalogSku.uom.trim());
  }, [matchedCatalogSku, uom]);

  const draftLine = useMemo((): ProjectAreaObjectPublic => {
    return {
      id: "__wb-blank-draft__",
      projectid: pa.projectid,
      projectAreaDocId: pa.id,
      objectid: selectedQuoteObject?.objectid ?? 0,
      areaid: pa.areaid,
      linesource: "manual",
      included: true,
      pricelevelid,
      style,
      colour,
      custommeasure: parseOptionalNumber(measureStr),
      customuom: effectiveUom,
      customumprice: parseCurrencyInput(unitPriceStr),
      skuId: resolvedSkuId,
      skuProduct: skuProduct.trim() || null,
      notes1: "",
      notes2: "",
      tooltip: "",
      constructionAssistantHours: null,
      leadContractorHours: null,
      electricianHours: null,
      plumberHours: null,
      generalHours: null,
      projectManagerHours: null,
      paintingHours: null,
      plasteringHours: null,
    };
  }, [
    pa,
    selectedQuoteObject,
    pricelevelid,
    style,
    colour,
    measureStr,
    effectiveUom,
    unitPriceStr,
    resolvedSkuId,
    skuProduct,
  ]);

  function validateAndSave() {
    const trimmedProduct = skuProduct.trim();
    const trimmedSupplier = manualSupplier.trim();
    const measure = parseOptionalNumber(measureStr);
    const unitPrice = parseCurrencyInput(unitPriceStr);

    if (!quoteObjectDocId) {
      setFormError("Choose an object.");
      return;
    }
    if (!trimmedProduct) {
      setFormError("Enter a product name.");
      return;
    }
    if (measure == null || measure <= 0) {
      setFormError("Enter a valid measure greater than zero.");
      return;
    }
    if (!effectiveUom.trim()) {
      setFormError("Enter a unit of measure.");
      return;
    }
    if (unitPrice == null || unitPrice < 0) {
      setFormError("Enter a valid unit price (cost ex GST).");
      return;
    }
    if (!trimmedSupplier) {
      setFormError("Enter a supplier.");
      return;
    }

    setFormError(null);
    onSave({
      quoteObjectDocId,
      pricelevelid,
      style,
      colour,
      custommeasure: measure,
      customuom: effectiveUom,
      customumprice: unitPrice,
      skuId: resolvedSkuId,
      skuProduct: trimmedProduct,
      supplierOption: resolvedSupplierRow?.supplierOption ?? null,
      manualSupplier: resolvedSupplierRow ? null : trimmedSupplier,
      manualSupplierSku: manualSupplierSku.trim() || null,
    });
  }

  if (!open) return null;

  return (
    <ModalFrame
      title="Add blank line"
      description="Enter product, cost, and supplier. Internal SKU code is set automatically when the product matches the catalog."
      onClose={saving ? () => {} : onClose}
      wide
      panelClassName="sm:max-w-3xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={validateAndSave}
            disabled={saving}
            className="min-h-11 rounded-lg border border-emerald-700 bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 dark:border-emerald-600"
          >
            {saving ? "Adding…" : "Add line"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {formError ? (
          <p
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {formError}
          </p>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Object</span>
          <select
            className={fieldInputClass}
            disabled={saving}
            value={quoteObjectDocId}
            onChange={(e) => {
              const id = e.target.value;
              setQuoteObjectDocId(id);
              const q = sortedQuoteObjects.find((row) => row.id === id);
              if (q?.uom?.trim() && !uom.trim()) setUom(q.uom.trim());
            }}
          >
            <option value="">Select object…</option>
            {sortedQuoteObjects.map((q) => (
              <option key={q.id} value={q.id}>
                {quoteObjectLabel(q)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Elevate</span>
            <CascadeElevateSelect
              cascades={cascades}
              priceLevels={priceLevels}
              priceLevelId={pricelevelid}
              projectFinish={project?.projectfinish}
              onChange={({ priceLevelId }) => setPricelevelid(priceLevelId)}
              className={fieldInputClass}
              disabled={saving}
              emptyLabel="Area default"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Style</span>
            <select
              className={fieldInputClass}
              disabled={saving}
              value={style ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setStyle(v ? v : null);
                if (!v) setColour(null);
              }}
            >
              <option value="">Area default</option>
              {baseStyleOptions.out.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Colour</span>
            <CascadeColourSelect
              cascades={cascades}
              level={cascadeLevelFromPriceLevel(
                priceLevels,
                pricelevelid ?? pa.pricelevelid ?? project?.defaultpricelevelid,
                project?.projectfinish,
                cascades,
              )}
              styleForFilter={effectiveCascadeStyleForLine(draftLine, pa, project)}
              colour={colour ?? ""}
              disabled={saving}
              selectClassName={fieldInputClass}
              emptyLabel={wbLineColourEmptyLabel(pa, project)}
              onColourChange={(v) => setColour(v ? v : null)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CatalogComboInput
            id="wb-blank-line-product"
            listId={productListId}
            label="Product"
            value={skuProduct}
            options={productOptions}
            disabled={saving}
            placeholder="Product name"
            onChange={setSkuProduct}
          />
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Internal SKU code</span>
            <div className={fieldReadOnlyClass} aria-live="polite">
              {resolvedSkuId ?? "No catalog match"}
            </div>
            <span className={fieldHintClass}>
              Set automatically from catalog when the product name matches
            </span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Unit price (ex GST)</span>
            <input
              type="text"
              inputMode="decimal"
              className={fieldInputClass}
              disabled={saving}
              value={unitPriceStr}
              onChange={(e) => setUnitPriceStr(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <CatalogComboInput
            id="wb-blank-line-supplier"
            listId={supplierListId}
            label="Supplier"
            value={manualSupplier}
            options={supplierOptions}
            disabled={saving}
            placeholder="Supplier name"
            onChange={setManualSupplier}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CatalogComboInput
            id="wb-blank-line-supplier-sku"
            listId={supplierSkuListId}
            label="Supplier SKU code (optional)"
            value={manualSupplierSku}
            options={supplierSkuOptions}
            disabled={saving}
            placeholder="Supplier code"
            hint={
              resolvedSkuId
                ? "Choose from this product’s supplier codes or type a value"
                : "Choose from list or type a value"
            }
            onChange={setManualSupplierSku}
          />
          <CatalogComboInput
            id="wb-blank-line-uom"
            listId={uomListId}
            label="UOM"
            value={uom}
            options={uomOptions}
            disabled={saving}
            placeholder={selectedQuoteObject?.uom?.trim() || "ea"}
            onChange={setUom}
          />
        </div>

        <label className="flex max-w-sm flex-col gap-1">
          <span className={fieldLabelClass}>Measure</span>
          <input
            type="text"
            inputMode="decimal"
            className={fieldInputClass}
            disabled={saving}
            value={measureStr}
            onChange={(e) => setMeasureStr(e.target.value)}
            placeholder="Quantity"
          />
        </label>
      </div>
    </ModalFrame>
  );
}
