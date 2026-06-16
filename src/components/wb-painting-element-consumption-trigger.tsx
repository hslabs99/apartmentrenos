"use client";

import { findPaintingElementForLine } from "@/lib/client/painting-element-index";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

type Props = {
  line: ProjectAreaObjectPublic;
  catalogSkus: DataSkuPublic[];
  paintingElementBySkuName: Map<string, DataPaintingElementPublic>;
  disabled?: boolean;
  onOpen: (lineId: string) => void;
};

export function WbPaintingElementConsumptionTrigger({
  line,
  catalogSkus,
  paintingElementBySkuName,
  disabled = false,
  onOpen,
}: Props) {
  const element = findPaintingElementForLine(line, catalogSkus, paintingElementBySkuName);
  if (!element || (!line.skuId && !line.skuProduct?.trim())) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onOpen(line.id)}
      className="shrink-0 rounded px-0.5 py-px font-mono text-[11px] font-semibold leading-none text-violet-700 hover:bg-sf-page disabled:opacity-50 dark:text-violet-300 dark:hover:bg-zinc-800"
      title={`View paint consumption for ${element.skuName}`}
      aria-label={`View paint consumption for ${element.skuName}`}
    >
      {"[]"}
    </button>
  );
}
