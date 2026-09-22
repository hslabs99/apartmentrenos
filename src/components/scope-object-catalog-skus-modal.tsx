"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { DataSkuPublic } from "@/types/data-sku-public";

function displayField(value: string | undefined | null): string {
  const t = String(value ?? "").trim();
  return t || "—";
}

function compareSkuRows(a: DataSkuPublic, b: DataSkuPublic): number {
  return [
    a.product,
    a.elevateLevel,
    a.style,
    a.colourOptions,
    a.skuId,
  ]
    .join("\u0001")
    .localeCompare(
      [b.product, b.elevateLevel, b.style, b.colourOptions, b.skuId].join("\u0001"),
      undefined,
      { sensitivity: "base" },
    );
}

const COLUMNS = [
  { key: "category", label: "Category" },
  { key: "productType", label: "Type" },
  { key: "product", label: "Product" },
  { key: "uom", label: "UOM" },
  { key: "elevateLevel", label: "Pricing level" },
  { key: "style", label: "Style" },
  { key: "colourOptions", label: "Colour" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

type Props = {
  objectLabel: string;
  skus: DataSkuPublic[];
  onClose: () => void;
};

export function ScopeObjectCatalogSkusModal({ objectLabel, skus, onClose }: Props) {
  const sorted = [...skus].sort(compareSkuRows);
  const countLabel = skus.length === 1 ? "1 SKU" : `${skus.length} SKUs`;

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
            {countLabel} matching category and product type. No Elevate, style, or colour filter —
            this is the same set as the count on the scope. Informational only.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No current catalog SKUs match this object’s category and product type.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-sf-border dark:border-zinc-700">
              <table className="w-full min-w-[48rem] text-left text-xs">
                <thead className="bg-sf-page text-sf-text-secondary dark:bg-zinc-950 dark:text-zinc-400">
                  <tr>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((sku) => (
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
                          {displayField(sku[col.key as ColumnKey])}
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
