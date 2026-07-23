import {
  buildBuildingElementConsumptionRows,
  findBuildingElementForLine,
} from "@/lib/client/building-element-index";
import {
  buildPaintingElementConsumptionRows,
  findPaintingElementForLine,
} from "@/lib/client/painting-element-index";
import { partitionAreaLines } from "@/lib/client/partition-area-lines";
import {
  preferredSupplierForSku,
  resolveScopeLineSupplier,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";

export const WB_PURCHASING_LIST_REPORT_WINDOW_LABEL = "Purchasing List Report";

export type WbPurchasingListLine = {
  supplier: string;
  /** Supplier’s own SKU/code. */
  supplierSku: string;
  /** Catalog product description. */
  description: string;
  /** Supplier model / description from the price book. */
  model: string;
  /** Catalog SKU id. */
  catalogSkuId: string;
  /** Product URL from the supplier row. */
  link: string;
  /** Unit price ex GST. */
  price: number | null;
};

export type WbPurchasingListSupplierGroup = {
  supplier: string;
  lines: WbPurchasingListLine[];
  /** Sum of line unit prices ex GST (null prices treated as 0). */
  totalExcGst: number;
  itemCount: number;
};

export type WbPurchasingListReportData = {
  projectName: string;
  groups: WbPurchasingListSupplierGroup[];
  lineCount: number;
  /** Sum of all group totals ex GST. */
  grandTotalExcGst: number;
  printedAt: Date;
};

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function isIncluded(row: ProjectAreaObjectPublic): boolean {
  return row.included !== false;
}

function lineSkuProduct(row: ProjectAreaObjectPublic, catalogSkus: DataSkuPublic[]): string {
  const fromLine = row.skuProduct?.trim();
  if (fromLine) return fromLine;
  const skuId = row.skuId?.trim();
  if (!skuId) return "";
  const sku = catalogSkus.find((s) => s.skuId === skuId);
  return sku?.product?.trim() ?? skuId;
}

function supplierCells(
  line: Pick<
    ProjectAreaObjectPublic,
    "skuId" | "supplierOption" | "manualSupplier" | "manualSupplierSku"
  >,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): {
  supplier: string;
  supplierSku: string;
  model: string;
  link: string;
  catalogSkuId: string;
} {
  const catalogSkuId = line.skuId?.trim() ?? "";
  const row = resolveScopeLineSupplier(line, suppliersBySkuId);
  if (row) {
    return {
      supplier: row.supplier.trim(),
      supplierSku: line.manualSupplierSku?.trim() || row.supplierSku.trim(),
      model: row.model.trim(),
      link: row.link.trim(),
      catalogSkuId,
    };
  }
  const manual = line.manualSupplier?.trim();
  if (manual) {
    return {
      supplier: manual,
      supplierSku: line.manualSupplierSku?.trim() ?? "",
      model: "",
      link: "",
      catalogSkuId,
    };
  }
  return { supplier: "", supplierSku: "", model: "", link: "", catalogSkuId };
}

function pickSupplierCells(
  pick: ScopeLineSkuPick | null | undefined,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): {
  supplier: string;
  supplierSku: string;
  model: string;
  link: string;
  catalogSkuId: string;
} {
  if (!pick?.skuId) {
    return { supplier: "", supplierSku: "", model: "", link: "", catalogSkuId: "" };
  }
  const catalogSkuId = pick.skuId.trim();
  const suppliers = suppliersBySkuId[pick.skuId] ?? [];
  const row =
    suppliers.find((s) => s.supplierOption === pick.supplierOption) ??
    preferredSupplierForSku(suppliers);
  if (!row) {
    return {
      supplier: pick.supplier.trim(),
      supplierSku: "",
      model: pick.model.trim(),
      link: pick.link.trim(),
      catalogSkuId,
    };
  }
  return {
    supplier: row.supplier.trim(),
    supplierSku: row.supplierSku.trim(),
    model: row.model.trim() || pick.model.trim(),
    link: row.link.trim() || pick.link.trim(),
    catalogSkuId,
  };
}

function pushLine(
  lines: WbPurchasingListLine[],
  entry: WbPurchasingListLine,
): void {
  if (!entry.supplier && !entry.supplierSku && !entry.description && entry.price == null) {
    return;
  }
  lines.push(entry);
}

/**
 * Compact shopping-list report: supplier, supplier SKU, product description, unit price.
 * Same product universe as Export by supplier (primary, bundled, building/paint parts).
 */
export function buildWorkbenchPurchasingListReport(args: {
  project: ProjectPublic;
  projectAreas: ProjectAreaPublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  supplierDiscountByKey: SupplierDiscountByKey;
  buildingElementBySkuName: Map<string, DataBuildingElementPublic>;
  paintingElementBySkuName: Map<string, DataPaintingElementPublic>;
  objectsByProjectAreaDocId: Map<string, ProjectAreaObjectPublic[]>;
}): WbPurchasingListReportData {
  const {
    project,
    projectAreas,
    catalogSkus,
    suppliersBySkuId,
    supplierDiscountByKey,
    buildingElementBySkuName,
    paintingElementBySkuName,
    objectsByProjectAreaDocId,
  } = args;

  const lines: WbPurchasingListLine[] = [];
  const sortedAreas = [...projectAreas].sort(compareProjectAreasDisplayOrder);

  for (const pa of sortedAreas) {
    const areaLines = objectsByProjectAreaDocId.get(pa.id) ?? [];
    const { topLevel, bundledByParentId } = partitionAreaLines(areaLines);

    for (const row of topLevel) {
      if (!isIncluded(row)) continue;

      const cells = supplierCells(row, suppliersBySkuId);
      pushLine(lines, {
        supplier: cells.supplier,
        supplierSku: cells.supplierSku,
        description: lineSkuProduct(row, catalogSkus),
        model: cells.model,
        catalogSkuId: cells.catalogSkuId,
        link: cells.link,
        price: row.customumprice ?? null,
      });

      const element = findBuildingElementForLine(row, catalogSkus, buildingElementBySkuName);
      if (element) {
        for (const part of buildBuildingElementConsumptionRows(
          element,
          row,
          catalogSkus,
          suppliersBySkuId,
          supplierDiscountByKey,
        )) {
          const partCells = pickSupplierCells(part.skuPick, suppliersBySkuId);
          const discountedUnit =
            part.lineTotalExcGst != null && part.extendedQty > 0
              ? Math.round((part.lineTotalExcGst / part.extendedQty) * 100) / 100
              : part.skuPick?.priceExcGst ?? part.retailPriceExcGst ?? null;
          pushLine(lines, {
            supplier: partCells.supplier,
            supplierSku: partCells.supplierSku,
            description: part.skuProduct,
            model: partCells.model,
            catalogSkuId: partCells.catalogSkuId,
            link: partCells.link,
            price: discountedUnit,
          });
        }
      }

      const paintElement = findPaintingElementForLine(
        row,
        catalogSkus,
        paintingElementBySkuName,
      );
      if (paintElement) {
        for (const part of buildPaintingElementConsumptionRows(
          paintElement,
          row,
          catalogSkus,
          suppliersBySkuId,
          supplierDiscountByKey,
        )) {
          const partCells = pickSupplierCells(part.skuPick, suppliersBySkuId);
          const discountedUnit =
            part.lineTotalExcGst != null && part.extendedM2 > 0
              ? Math.round((part.lineTotalExcGst / part.extendedM2) * 100) / 100
              : part.skuPick?.priceExcGst ?? part.retailPriceExcGst ?? null;
          pushLine(lines, {
            supplier: partCells.supplier,
            supplierSku: partCells.supplierSku,
            description: part.skuProduct,
            model: partCells.model,
            catalogSkuId: partCells.catalogSkuId,
            link: partCells.link,
            price: discountedUnit,
          });
        }
      }

      for (const child of bundledByParentId.get(row.id) ?? []) {
        if (!isIncluded(child)) continue;
        const childCells = supplierCells(child, suppliersBySkuId);
        pushLine(lines, {
          supplier: childCells.supplier,
          supplierSku: childCells.supplierSku,
          description: lineSkuProduct(child, catalogSkus),
          model: childCells.model,
          catalogSkuId: childCells.catalogSkuId,
          link: childCells.link,
          price: child.customumprice ?? null,
        });
      }
    }
  }

  lines.sort((a, b) => {
    const supplierA = a.supplier.trim() || "\uffff";
    const supplierB = b.supplier.trim() || "\uffff";
    const supplierCmp = compareStrings(supplierA, supplierB);
    if (supplierCmp !== 0) return supplierCmp;
    const skuCmp = compareStrings(a.supplierSku, b.supplierSku);
    if (skuCmp !== 0) return skuCmp;
    return compareStrings(a.description, b.description);
  });

  const groupMap = new Map<string, WbPurchasingListLine[]>();
  for (const line of lines) {
    const key = line.supplier.trim() || "(No supplier)";
    const list = groupMap.get(key) ?? [];
    list.push(line);
    groupMap.set(key, list);
  }

  const groups: WbPurchasingListSupplierGroup[] = [...groupMap.entries()]
    .sort(([a], [b]) => {
      if (a === "(No supplier)") return 1;
      if (b === "(No supplier)") return -1;
      return compareStrings(a, b);
    })
    .map(([supplier, groupLines]) => {
      const totalExcGst =
        Math.round(
          groupLines.reduce((sum, line) => sum + (line.price ?? 0), 0) * 100,
        ) / 100;
      return {
        supplier,
        lines: groupLines,
        totalExcGst,
        itemCount: groupLines.length,
      };
    });

  const grandTotalExcGst =
    Math.round(groups.reduce((sum, g) => sum + g.totalExcGst, 0) * 100) / 100;

  return {
    projectName: project.projectname?.trim() || "Project",
    groups,
    lineCount: lines.length,
    grandTotalExcGst,
    printedAt: new Date(),
  };
}

export function wbPurchasingListReportHasContent(data: WbPurchasingListReportData): boolean {
  return data.lineCount > 0;
}
