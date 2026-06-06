"use client";

import { WbBuildingElementConsumptionTrigger } from "@/components/wb-building-element-consumption-trigger";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

type Props = {
  line: ProjectAreaObjectPublic;
  catalogSkus: DataSkuPublic[];
  buildingElementBySkuName: Map<string, DataBuildingElementPublic>;
  disabled?: boolean;
  onOpenConsumption: (lineId: string) => void;
  children: React.ReactNode;
};

/** Workbench SKU column: picker + optional `{}` consumption trigger. */
export function WbBuildingElementSkuCell({
  line,
  catalogSkus,
  buildingElementBySkuName,
  disabled = false,
  onOpenConsumption,
  children,
}: Props) {
  return (
    <div className="flex h-full min-w-0 items-center gap-0.5">
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
      <WbBuildingElementConsumptionTrigger
        line={line}
        catalogSkus={catalogSkus}
        buildingElementBySkuName={buildingElementBySkuName}
        disabled={disabled}
        onOpen={onOpenConsumption}
      />
    </div>
  );
}
