import {
  buildBuildingElementConsumptionRows,
  findBuildingElementForLine,
} from "@/lib/client/building-element-index";
import {
  buildPaintingElementConsumptionRows,
  findPaintingElementForLine,
} from "@/lib/client/painting-element-index";
import { partitionAreaLines } from "@/lib/client/partition-area-lines";
import { projectLineObjectLabel } from "@/lib/client/project-line-quote-object";
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
import type { QuoteObjectPublic } from "@/types/quote-object";

export const WB_PURCHASING_LIST_REPORT_WINDOW_LABEL = "Purchasing List Report";

export type WbPurchasingListLine = {
  supplier: string;
  /** Supplier’s own SKU/code. */
  supplierSku: string;
  /** Catalog product description (fallback when model is empty). */
  description: string;
  /** Quote object name — shown as the item title. */
  objectType: string;
  /** Supplier model / description from the price book. */
  model: string;
  /** Catalog SKU id. */
  catalogSkuId: string;
  /** Product URL from the supplier row. */
  link: string;
  /** Unit price ex GST. */
  unitPrice: number | null;
  /** Quantity to order. */
  quantity: number | null;
  /** Unit of measure for quantity (LM, m², Ltr, ea, …). */
  uom: string;
  /** quantity × unit price ex GST. */
  subtotalExcGst: number | null;
};

export type WbPurchasingListSupplierGroup = {
  supplier: string;
  lines: WbPurchasingListLine[];
  /** Sum of line subtotals ex GST (null subtotals treated as 0). */
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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function finiteOrNull(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) ? n : null;
}

function subtotalFrom(quantity: number | null, unitPrice: number | null): number | null {
  if (quantity == null || unitPrice == null) return null;
  return roundMoney(quantity * unitPrice);
}

function unitPriceFromTotal(total: number | null, quantity: number): number | null {
  if (total == null || !(quantity > 0)) return null;
  return roundMoney(total / quantity);
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

function paintPurchaseQty(part: {
  litrePerM2: number | null;
  extendedLitres: number | null;
  extendedM2: number;
  lineUom: string;
}): { quantity: number; uom: string } {
  const litrePriced =
    part.litrePerM2 != null &&
    Number.isFinite(part.litrePerM2) &&
    part.extendedLitres != null &&
    Number.isFinite(part.extendedLitres);
  if (litrePriced && part.extendedLitres != null) {
    const raw = part.lineUom.trim();
    const upper = raw.toUpperCase();
    const litreUom =
      upper === "LTR" || upper === "L" || upper === "LITRE" || upper === "LITRES"
        ? raw
        : "Ltr";
    return { quantity: part.extendedLitres, uom: litreUom || "Ltr" };
  }
  return { quantity: part.extendedM2, uom: part.lineUom.trim() || "M2" };
}

function pushLine(lines: WbPurchasingListLine[], entry: WbPurchasingListLine): void {
  if (
    !entry.supplier &&
    !entry.supplierSku &&
    !entry.description &&
    !entry.objectType &&
    entry.unitPrice == null &&
    entry.quantity == null
  ) {
    return;
  }
  lines.push(entry);
}

/**
 * Compact shopping-list report: supplier product (SKU + model), unit price, quantity, subtotal.
 * Same product universe as Export by supplier (primary, bundled, building/paint parts).
 */
export function buildWorkbenchPurchasingListReport(args: {
  project: ProjectPublic;
  projectAreas: ProjectAreaPublic[];
  catalogSkus: DataSkuPublic[];
  quoteObjects: QuoteObjectPublic[];
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
    quoteObjects,
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

      const objectType = projectLineObjectLabel(row, quoteObjects, catalogSkus);
      const cells = supplierCells(row, suppliersBySkuId);
      const quantity = finiteOrNull(row.custommeasure);
      const unitPrice = finiteOrNull(row.customumprice);
      pushLine(lines, {
        supplier: cells.supplier,
        supplierSku: cells.supplierSku,
        description: lineSkuProduct(row, catalogSkus),
        objectType,
        model: cells.model,
        catalogSkuId: cells.catalogSkuId,
        link: cells.link,
        unitPrice,
        quantity,
        uom: row.customuom?.trim() ?? "",
        subtotalExcGst: subtotalFrom(quantity, unitPrice),
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
          const quantity = finiteOrNull(part.extendedQty);
          const unitPrice =
            unitPriceFromTotal(part.lineTotalExcGst, part.extendedQty) ??
            finiteOrNull(part.skuPick?.priceExcGst) ??
            finiteOrNull(part.retailPriceExcGst);
          const partTotal = finiteOrNull(part.lineTotalExcGst);
          const subtotalExcGst =
            partTotal != null ? roundMoney(partTotal) : subtotalFrom(quantity, unitPrice);
          pushLine(lines, {
            supplier: partCells.supplier,
            supplierSku: partCells.supplierSku,
            description: part.skuProduct,
            objectType,
            model: partCells.model,
            catalogSkuId: partCells.catalogSkuId,
            link: partCells.link,
            unitPrice,
            quantity,
            uom: part.lineUom.trim(),
            subtotalExcGst,
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
          const { quantity: paintQty, uom } = paintPurchaseQty(part);
          const quantity = finiteOrNull(paintQty);
          const unitPrice =
            unitPriceFromTotal(part.lineTotalExcGst, paintQty) ??
            finiteOrNull(part.skuPick?.priceExcGst) ??
            finiteOrNull(part.retailPriceExcGst);
          const paintTotal = finiteOrNull(part.lineTotalExcGst);
          const subtotalExcGst =
            paintTotal != null ? roundMoney(paintTotal) : subtotalFrom(quantity, unitPrice);
          pushLine(lines, {
            supplier: partCells.supplier,
            supplierSku: partCells.supplierSku,
            description: part.skuProduct,
            objectType,
            model: partCells.model,
            catalogSkuId: partCells.catalogSkuId,
            link: partCells.link,
            unitPrice,
            quantity,
            uom,
            subtotalExcGst,
          });
        }
      }

      for (const child of bundledByParentId.get(row.id) ?? []) {
        if (!isIncluded(child)) continue;
        const childCells = supplierCells(child, suppliersBySkuId);
        const quantity = finiteOrNull(child.custommeasure);
        const unitPrice = finiteOrNull(child.customumprice);
        pushLine(lines, {
          supplier: childCells.supplier,
          supplierSku: childCells.supplierSku,
          description: lineSkuProduct(child, catalogSkus),
          objectType: projectLineObjectLabel(child, quoteObjects, catalogSkus),
          model: childCells.model,
          catalogSkuId: childCells.catalogSkuId,
          link: childCells.link,
          unitPrice,
          quantity,
          uom: child.customuom?.trim() ?? "",
          subtotalExcGst: subtotalFrom(quantity, unitPrice),
        });
      }
    }
  }

  lines.sort((a, b) => {
    const supplierA = a.supplier.trim() || "\uffff";
    const supplierB = b.supplier.trim() || "\uffff";
    const supplierCmp = compareStrings(supplierA, supplierB);
    if (supplierCmp !== 0) return supplierCmp;
    const objectCmp = compareStrings(a.objectType, b.objectType);
    if (objectCmp !== 0) return objectCmp;
    const skuCmp = compareStrings(a.supplierSku, b.supplierSku);
    if (skuCmp !== 0) return skuCmp;
    return compareStrings(a.model || a.description, b.model || b.description);
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
          groupLines.reduce((sum, line) => sum + (line.subtotalExcGst ?? 0), 0) * 100,
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
