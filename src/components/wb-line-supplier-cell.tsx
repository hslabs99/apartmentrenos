"use client";

import {
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
    </td>
  );
}
