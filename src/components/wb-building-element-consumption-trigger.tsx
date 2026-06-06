"use client";

import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import { findBuildingElementForLine } from "@/lib/client/building-element-index";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

type Props = {
  line: ProjectAreaObjectPublic;
  catalogSkus: DataSkuPublic[];
  buildingElementBySkuName: Map<string, DataBuildingElementPublic>;
  disabled?: boolean;
  onOpen: (lineId: string) => void;
};

export function WbBuildingElementConsumptionTrigger({
  line,
  catalogSkus,
  buildingElementBySkuName,
  disabled = false,
  onOpen,
}: Props) {
  const element = findBuildingElementForLine(line, catalogSkus, buildingElementBySkuName);
  if (!element || (!line.skuId && !line.skuProduct?.trim())) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onOpen(line.id)}
      className="shrink-0 rounded px-0.5 py-px font-mono text-[11px] font-semibold leading-none text-sf-brand hover:bg-sf-page disabled:opacity-50 dark:text-[#58a9f5] dark:hover:bg-zinc-800"
      title={`View consumption components for ${element.skuName}`}
      aria-label={`View consumption for ${element.skuName}`}
    >
      {"{}"}
    </button>
  );
}
