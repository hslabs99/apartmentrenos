"use client";

import {
  isOrphanQuoteObjectLine,
  ORPHAN_QUOTE_OBJECT_LINE_TOOLTIP,
  projectLineObjectLabel,
} from "@/lib/client/project-line-quote-object";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";

type Props = {
  row: ProjectAreaObjectPublic;
  quoteObjects: QuoteObjectPublic[];
  catalogSkus?: DataSkuPublic[];
  /** When false, line is excluded from totals (dimmed styling unless orphan). */
  included?: boolean;
  className?: string;
};

/** Workbench description cell: object name, bold red when quote object is missing. */
export function WbObjectName({
  row,
  quoteObjects,
  catalogSkus,
  included = true,
  className = "",
}: Props) {
  const orphan = isOrphanQuoteObjectLine(row, quoteObjects);
  const label = projectLineObjectLabel(row, quoteObjects, catalogSkus);

  const styleClass = orphan
    ? "min-w-0 truncate font-bold leading-tight text-red-600 dark:text-red-400"
    : `min-w-0 truncate font-medium leading-tight ${
        included ? "text-sf-text dark:text-zinc-100" : ""
      }`;

  return (
    <span
      className={`${styleClass} ${className}`.trim()}
      title={orphan ? ORPHAN_QUOTE_OBJECT_LINE_TOOLTIP : label}
    >
      {label}
    </span>
  );
}
