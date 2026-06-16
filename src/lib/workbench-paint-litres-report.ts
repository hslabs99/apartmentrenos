import {
  buildPaintingElementConsumptionRows,
  findPaintingElementForLine,
  isPaintingParentPackageLine,
  paintingElementParentMultiplier,
  paintingElementSkuNameForLine,
} from "@/lib/client/painting-element-index";
import {
  paintingSiteFeeExcGst,
  paintingSiteFeeWithMarginExcGst,
  projectHasPaintConsumption,
  PAINTING_SITE_FEE_PRODUCT,
} from "@/lib/painting-site-fee";
import { projectLineObjectLabel, quoteObjectForProjectLine } from "@/lib/client/project-line-quote-object";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import type { AreaPublic } from "@/types/area";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";

export const WB_PAINT_LITRES_REPORT_ID = "paint-litres" as const;
export const WB_PAINT_LITRES_REPORT_LABEL = "Paint Ltrs";

export type WbPaintLitresDetailRow = {
  paintType: string;
  parentDescription: string;
  parentSkuProduct: string;
  parentMeasure: number;
  parentUom: string;
  unitM2: number;
  totalM2: number;
  litrePerM2: number | null;
  totalLitres: number | null;
};

export type WbPaintLitresAreaTotal = {
  paintType: string;
  totalM2: number;
  totalLitres: number;
};

export type WbPaintLitresParentLine = {
  lineId: string;
  description: string;
  skuProduct: string;
  measure: number;
  uom: string;
  elementSkuName: string | null;
  missingElement: boolean;
  detailRows: WbPaintLitresDetailRow[];
};

export type WbPaintLitresArea = {
  areaid: number;
  label: string;
  parentLines: WbPaintLitresParentLine[];
  totals: WbPaintLitresAreaTotal[];
  missingElementCount: number;
};

export type WbPaintLitresReportData = {
  projectName: string;
  areas: WbPaintLitresArea[];
  projectTotals: WbPaintLitresAreaTotal[];
  missingElementCount: number;
  /** Once per project when any paint litres are consumed. */
  siteFeeExcGst: number | null;
  siteFeeLabel: string;
  siteFeeWithMarginExcGst: number | null;
  marginPct: number;
  printedAt: Date;
};

function isIncludedLine(row: ProjectAreaObjectPublic): boolean {
  return row.included !== false;
}

function lineUom(row: ProjectAreaObjectPublic, quoteObjects: QuoteObjectPublic[]): string {
  const fromLine = row.customuom?.trim();
  if (fromLine) return fromLine;
  const q = quoteObjectForProjectLine(row, quoteObjects);
  return q?.uom?.trim() || "—";
}

function isPaintMaterialRow(
  row: ReturnType<typeof buildPaintingElementConsumptionRows>[number],
): boolean {
  return row.litrePerM2 != null && Number.isFinite(row.litrePerM2);
}

function addToAreaTotals(
  totals: Map<string, WbPaintLitresAreaTotal>,
  paintType: string,
  m2: number,
  litres: number,
): void {
  const key = paintType.trim().toLowerCase();
  const existing = totals.get(key);
  if (existing) {
    existing.totalM2 += m2;
    existing.totalLitres += litres;
    return;
  }
  totals.set(key, { paintType, totalM2: m2, totalLitres: litres });
}

function totalsMapToSortedArray(map: Map<string, WbPaintLitresAreaTotal>): WbPaintLitresAreaTotal[] {
  return [...map.values()].sort((a, b) =>
    a.paintType.localeCompare(b.paintType, undefined, { sensitivity: "base" }),
  );
}

/** Included painting parent package line (explodable via Painting Elements). */
export function lineQualifiesForPaintLitresReport(
  row: ProjectAreaObjectPublic,
  catalogSkus: DataSkuPublic[],
  paintingElementBySkuName?: Map<string, DataPaintingElementPublic>,
): boolean {
  if (!isIncludedLine(row)) return false;
  return isPaintingParentPackageLine(row, catalogSkus, paintingElementBySkuName);
}

export type BuildWorkbenchPaintLitresReportArgs = {
  project: ProjectPublic;
  projectAreas: ProjectAreaPublic[];
  areas: AreaPublic[];
  quoteObjects: QuoteObjectPublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  supplierDiscountByKey?: SupplierDiscountByKey;
  paintingElementBySkuName: Map<string, DataPaintingElementPublic>;
  objectsByProjectAreaDocId: Map<string, ProjectAreaObjectPublic[]>;
  contractLabourRates?: DataLabourRatePublic[];
  marginPct?: number;
};

export function buildWorkbenchPaintLitresReport(
  args: BuildWorkbenchPaintLitresReportArgs,
): WbPaintLitresReportData {
  const {
    project,
    projectAreas,
    areas,
    quoteObjects,
    catalogSkus,
    suppliersBySkuId,
    supplierDiscountByKey = new Map(),
    paintingElementBySkuName,
    objectsByProjectAreaDocId,
    contractLabourRates = [],
    marginPct = 0,
  } = args;

  const allObjects = [...objectsByProjectAreaDocId.values()].flat();

  const reportAreas: WbPaintLitresArea[] = [];
  const projectTotalsMap = new Map<string, WbPaintLitresAreaTotal>();
  let missingElementCount = 0;

  for (const pa of projectAreas) {
    const rows = objectsByProjectAreaDocId.get(pa.id) ?? [];
    const parentLines: WbPaintLitresParentLine[] = [];
    const areaTotalsMap = new Map<string, WbPaintLitresAreaTotal>();
    let areaMissing = 0;

    for (const row of rows) {
      if (!lineQualifiesForPaintLitresReport(row, catalogSkus, paintingElementBySkuName)) continue;

      const skuProduct = paintingElementSkuNameForLine(row, catalogSkus) ?? "—";
      const element = findPaintingElementForLine(row, catalogSkus, paintingElementBySkuName);
      const missingElement = !element;
      if (missingElement) {
        areaMissing += 1;
        missingElementCount += 1;
      }

      const measure = paintingElementParentMultiplier(row);
      const uom = lineUom(row, quoteObjects);
      const description = projectLineObjectLabel(row, quoteObjects, catalogSkus);

      const detailRows: WbPaintLitresDetailRow[] = [];
      if (element) {
        const consumption = buildPaintingElementConsumptionRows(
          element,
          row,
          catalogSkus,
          suppliersBySkuId,
          supplierDiscountByKey,
        );
        for (const part of consumption) {
          if (!isPaintMaterialRow(part)) continue;
          const litres = part.extendedLitres ?? 0;
          detailRows.push({
            paintType: part.skuProduct,
            parentDescription: description,
            parentSkuProduct: skuProduct,
            parentMeasure: measure,
            parentUom: uom,
            unitM2: part.unitM2Multiplier,
            totalM2: part.extendedM2,
            litrePerM2: part.litrePerM2,
            totalLitres: part.extendedLitres,
          });
          addToAreaTotals(areaTotalsMap, part.skuProduct, part.extendedM2, litres);
          addToAreaTotals(projectTotalsMap, part.skuProduct, part.extendedM2, litres);
        }
      }

      parentLines.push({
        lineId: row.id,
        description,
        skuProduct,
        measure,
        uom,
        elementSkuName: element?.skuName ?? null,
        missingElement,
        detailRows,
      });
    }

    if (parentLines.length === 0) continue;

    reportAreas.push({
      areaid: pa.areaid,
      label: projectAreaHeading(pa, areas),
      parentLines,
      totals: totalsMapToSortedArray(areaTotalsMap),
      missingElementCount: areaMissing,
    });
  }

  const hasConsumption = projectHasPaintConsumption({
    objects: allObjects,
    catalogSkus,
    paintingElementBySkuName,
    suppliersBySkuId,
    supplierDiscountByKey,
  });
  const siteFeeExcGst = hasConsumption ? paintingSiteFeeExcGst(contractLabourRates) : null;
  const siteFeeWithMargin =
    siteFeeExcGst != null ? paintingSiteFeeWithMarginExcGst(siteFeeExcGst, marginPct) : null;

  return {
    projectName: project.projectname?.trim() || "Project",
    areas: reportAreas,
    projectTotals: totalsMapToSortedArray(projectTotalsMap),
    missingElementCount,
    siteFeeExcGst,
    siteFeeLabel: PAINTING_SITE_FEE_PRODUCT,
    siteFeeWithMarginExcGst: siteFeeWithMargin,
    marginPct,
    printedAt: new Date(),
  };
}

export function wbPaintLitresReportHasContent(data: WbPaintLitresReportData): boolean {
  return data.areas.length > 0;
}
