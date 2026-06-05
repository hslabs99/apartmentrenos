"use client";

import {
  resolveScopeLineSupplier,
  resolveScopeLineSupplierLabel,
  resolveScopeLineSupplierTitle,
} from "@/lib/client/scope-line-sku-match";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

type Props = {
  row: ProjectAreaObjectPublic;
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  supplierDiscountByKey?: SupplierDiscountByKey;
  cellClassName?: string;
};

/** Workbench Supplier column (read-only). */
export function WbLineSupplierCell({
  row,
  suppliersBySkuId,
  supplierDiscountByKey = new Map(),
  cellClassName = "",
}: Props) {
  const supplierRow = resolveScopeLineSupplier(row, suppliersBySkuId);
  const label = resolveScopeLineSupplierLabel(row, suppliersBySkuId, supplierDiscountByKey);
  const title = resolveScopeLineSupplierTitle(row, suppliersBySkuId, supplierDiscountByKey);

  return (
    <td
      className={`${cellClassName} align-middle`.trim()}
      title={title}
    >
      <span className="block min-w-0 truncate font-medium text-sf-text-secondary dark:text-zinc-300">
        {label}
      </span>
      {supplierRow ? (
        <span className="mt-0.5 block truncate text-[10px] tabular-nums text-sf-text-weak dark:text-zinc-500">
          P{supplierRow.supplierOption}
        </span>
      ) : null}
    </td>
  );
}
