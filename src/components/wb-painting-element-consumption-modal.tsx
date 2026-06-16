"use client";

import { formatMoney } from "@/lib/client/format-money";
import {
  buildPaintingElementConsumptionRows,
  paintingElementParentMultiplier,
  paintingElementPriceCheck,
  sumPaintingElementExtendedTotals,
  sumPaintingElementUnitTotals,
} from "@/lib/client/painting-element-index";
import {
  resolveScopeLineSkuUnitPriceExcGst,
  scopeLineSkuPickSupplierLabel,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import {
  formatSupplierDiscountPctLabel,
  type SupplierDiscountByKey,
} from "@/lib/client/supplier-discount-price";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import { useMemo } from "react";

type Props = {
  line: ProjectAreaObjectPublic;
  element: DataPaintingElementPublic;
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  supplierDiscountByKey?: SupplierDiscountByKey;
  onClose: () => void;
};

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(n);
}

function formatPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${formatMoney(price)}`;
}

function consumptionSupplierLabel(
  pick: ScopeLineSkuPick | null,
  discountPctApplied: number | null,
): string {
  if (!pick) return "—";
  const base = scopeLineSkuPickSupplierLabel(pick);
  const pctLabel =
    discountPctApplied != null && discountPctApplied > 0
      ? formatSupplierDiscountPctLabel(discountPctApplied)
      : "";
  return pctLabel ? `${base} (${pctLabel})` : base;
}

export function WbPaintingElementConsumptionModal({
  line,
  element,
  catalogSkus,
  suppliersBySkuId,
  supplierDiscountByKey = new Map(),
  onClose,
}: Props) {
  const multiplier = paintingElementParentMultiplier(line);
  const parentUom = line.customuom?.trim() || "—";
  const rows = useMemo(
    () =>
      buildPaintingElementConsumptionRows(
        element,
        line,
        catalogSkus,
        suppliersBySkuId,
        supplierDiscountByKey,
      ),
    [element, line, catalogSkus, suppliersBySkuId, supplierDiscountByKey],
  );

  const paintUnitPriceExcGst = useMemo(
    () =>
      resolveScopeLineSkuUnitPriceExcGst(line, suppliersBySkuId, supplierDiscountByKey),
    [line, suppliersBySkuId, supplierDiscountByKey],
  );

  const unitSum = useMemo(() => sumPaintingElementUnitTotals(rows), [rows]);
  const extendedSum = useMemo(() => sumPaintingElementExtendedTotals(rows), [rows]);
  const priceCheck = useMemo(
    () => paintingElementPriceCheck(unitSum.total, paintUnitPriceExcGst),
    [unitSum.total, paintUnitPriceExcGst],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wb-painting-element-consumption-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-6xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
          <h2
            id="wb-painting-element-consumption-title"
            className="text-lg font-semibold text-sf-text dark:text-zinc-100"
          >
            Paint consumption — {element.skuName}
          </h2>
          <p className="mt-1 text-sm text-sf-text-secondary dark:text-zinc-400">
            {element.element} · {element.size} · {element.type} · sheet qty UOM{" "}
            {element.quantityUom || "—"}
          </p>
          <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
            Parent line:{" "}
            <strong className="font-medium text-sf-text dark:text-zinc-200">
              {formatQty(multiplier)} {parentUom}
            </strong>
            {multiplier !== 1 ? (
              <span> — each component M2 factor below is × {formatQty(multiplier)}</span>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-sf-text-weak dark:text-zinc-500">
            Unit cost uses retail/catalog price per line UOM. Extended cost applies supplier
            discount when configured. Litres = total M2 × Litre/M2. Paint materials: extended
            cost = litres × price/L (not m² × price again).
          </p>
        </div>

        <div className="overflow-x-auto px-5 py-4">
          {rows.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No component lines imported for this painting element.
            </p>
          ) : (
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-sf-border text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium">SKU product</th>
                  <th className="py-2 pr-3 font-medium">Supplier</th>
                  <th className="py-2 pr-3 text-right font-medium">Price</th>
                  <th className="py-2 pr-3 font-medium">UOM</th>
                  <th className="py-2 pr-3 text-right font-medium">Unit M2</th>
                  <th className="py-2 pr-3 text-right font-medium">Total M2</th>
                  <th className="py-2 pr-3 text-right font-medium">L/m²</th>
                  <th className="py-2 pr-3 text-right font-medium">Litres</th>
                  <th className="py-2 pr-3 text-right font-medium">Unit cost</th>
                  <th className="py-2 pr-3 text-right font-medium">Extended cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const pick = row.skuPick;
                  const supplierLabel = consumptionSupplierLabel(pick, row.discountPctApplied);

                  return (
                    <tr
                      key={`${row.skuProduct}-${idx}`}
                      className="border-b border-sf-border/80 last:border-0 dark:border-zinc-800"
                    >
                      <td className="py-2 pr-3">{row.category || "—"}</td>
                      <td className="py-2 pr-3">{row.skuProduct}</td>
                      <td className="py-2 pr-3">{supplierLabel}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatPrice(row.retailPriceExcGst)}
                      </td>
                      <td className="py-2 pr-3">{row.lineUom || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatQty(row.unitM2Multiplier)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium">
                        {formatQty(row.extendedM2)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.litrePerM2 == null ? "—" : formatQty(row.litrePerM2)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.extendedLitres == null ? "—" : formatQty(row.extendedLitres)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatPrice(row.unitLineTotalExcGst)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-medium">
                        {formatPrice(row.lineTotalExcGst)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-sf-border dark:border-zinc-700">
                  <td
                    colSpan={10}
                    className="py-3 pr-3 text-right font-medium text-sf-text-secondary dark:text-zinc-400"
                  >
                    Extended total
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-semibold">
                    {formatPrice(extendedSum.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {rows.length > 0 ? (
          <div className="border-t border-sf-border px-5 py-3 dark:border-zinc-700">
            {unitSum.missingPriceCount > 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {unitSum.missingPriceCount} line
                {unitSum.missingPriceCount === 1 ? "" : "s"} missing price — check excluded from
                sum.
              </p>
            ) : null}
            {priceCheck.matches === true ? (
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                Check passed — component unit totals match paint line unit price.
              </p>
            ) : priceCheck.matches === false ? (
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Check mismatch — difference{" "}
                {priceCheck.difference != null
                  ? `$${formatMoney(Math.abs(priceCheck.difference))} ${
                      priceCheck.difference > 0 ? "over" : "under"
                    } paint unit price`
                  : ""}
                . Catalog prices may differ from sheet build or some SKUs may not match.
              </p>
            ) : (
              <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                Price check unavailable — need component prices and paint unit price on the line.
              </p>
            )}
          </div>
        ) : null}

        <div className="flex justify-end border-t border-sf-border px-5 py-4 dark:border-zinc-700">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg border border-sf-border-strong px-4 py-2 text-sm font-medium dark:border-zinc-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
