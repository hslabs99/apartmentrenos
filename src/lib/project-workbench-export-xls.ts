import {
  buildBuildingElementConsumptionRows,
  buildBuildingElementIndex,
  findBuildingElementForLine,
} from "@/lib/client/building-element-index";
import {
  buildPaintingElementConsumptionRows,
  buildPaintingElementIndex,
  findPaintingElementForLine,
} from "@/lib/client/painting-element-index";
import { loadCatalogSkuData } from "@/lib/client/load-catalog-sku-data";
import { partitionAreaLines } from "@/lib/client/partition-area-lines";
import { isBlindsSystemLine } from "@/lib/blinds/blinds-data-utils";
import {
  projectLineObjectLabel,
  quoteObjectForProjectLine,
} from "@/lib/client/project-line-quote-object";
import {
  preferredSupplierForSku,
  resolveScopeLineSupplier,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import { supplierDiscountByKeyFromRows } from "@/lib/client/supplier-discount-price";
import { WB_WORKBENCH_LABOUR_SILO_HEADERS } from "@/lib/labour-silo";
import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import { marginPercentFromSettings } from "@/lib/settings-margin";
import type { AreaPublic } from "@/types/area";
import type { DataBuildingElementPublic } from "@/types/data-building-element-public";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { SettingPublic } from "@/types/setting";

type ExportCell = string | number | boolean | null;

export type WorkbenchXlsSortMode = "by-area" | "by-supplier";

function compareExportStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function lineObjectType(
  row: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): string {
  if (isBlindsSystemLine(row)) return "Blinds";
  const q = quoteObjectForProjectLine(row, quoteObjects);
  const t = q?.objecttype?.trim();
  if (t) return t;
  return "(No object type)";
}

function sortTopLevelByObjectType(
  topLevel: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
): ProjectAreaObjectPublic[] {
  return [...topLevel].sort((a, b) => {
    const typeCmp = compareExportStrings(
      lineObjectType(a, quoteObjects),
      lineObjectType(b, quoteObjects),
    );
    if (typeCmp !== 0) return typeCmp;
    const labelCmp = compareExportStrings(
      projectLineObjectLabel(a, quoteObjects, catalogSkus),
      projectLineObjectLabel(b, quoteObjects, catalogSkus),
    );
    if (labelCmp !== 0) return labelCmp;
    return compareExportStrings(a.id, b.id);
  });
}

type SortableExportEntry = {
  cells: ExportCell[];
  supplier: string;
  objectType: string;
  areaName: string;
  description: string;
};

function sortExportEntriesBySupplier(entries: SortableExportEntry[]): SortableExportEntry[] {
  return [...entries].sort((a, b) => {
    const supplierA = a.supplier.trim() || "\uffff";
    const supplierB = b.supplier.trim() || "\uffff";
    const supplierCmp = compareExportStrings(supplierA, supplierB);
    if (supplierCmp !== 0) return supplierCmp;
    const typeCmp = compareExportStrings(a.objectType, b.objectType);
    if (typeCmp !== 0) return typeCmp;
    const areaCmp = compareExportStrings(a.areaName, b.areaName);
    if (areaCmp !== 0) return areaCmp;
    return compareExportStrings(a.description, b.description);
  });
}

async function readApiJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

function safeFileBase(name: string): string {
  const t = name.trim().replace(/[^\w\s-]+/g, "").replace(/\s+/g, "-");
  return t.slice(0, 80) || "project";
}

function lineSourceLabel(row: ProjectAreaObjectPublic): string {
  const s = row.linesource;
  if (s === "scope") return "Scope";
  if (s === "manual") return "Manual";
  if (s === "manual2") return "Manual2";
  if (s === "bundled") return "Bundled";
  return "Default";
}

function lineFinalPrice(row: ProjectAreaObjectPublic, marginPct: number): number | null {
  if (row.included === false) return null;
  const t = row.totalprice;
  if (t == null || !Number.isFinite(t)) return null;
  return t * (1 + marginPct / 100);
}

function areaTemplateName(pa: ProjectAreaPublic, areas: AreaPublic[]): string {
  const area = areas.find((a) => a.areaid === pa.areaid);
  return area?.areaname?.trim() ?? `Area #${pa.areaid}`;
}

function roomLabel(pa: ProjectAreaPublic): string {
  return pa.displayName?.trim() ?? "";
}

function elevateLabel(
  row: ProjectAreaObjectPublic,
  pa: ProjectAreaPublic,
  project: ProjectPublic,
  priceLevels: PriceLevelPublic[],
): string {
  const plId = row.pricelevelid ?? pa.pricelevelid ?? project.defaultpricelevelid ?? null;
  if (plId == null) return "";
  const pl = priceLevels.find((p) => p.pricelevelid === plId);
  return pl?.pricelevel?.trim() ?? String(plId);
}

function lineSkuProduct(row: ProjectAreaObjectPublic, catalogSkus: DataSkuPublic[]): string {
  const fromLine = row.skuProduct?.trim();
  if (fromLine) return fromLine;
  const skuId = row.skuId?.trim();
  if (!skuId) return "";
  const sku = catalogSkus.find((s) => s.skuId === skuId);
  return sku?.product?.trim() ?? skuId;
}

function lineNotes(row: ProjectAreaObjectPublic): string {
  return [row.notes1, row.notes2].filter(Boolean).join("\n");
}

/** Supplier name, model, and supplier SKU code for ordering (from line’s supplier option). */
function supplierOrderCells(
  line: Pick<
    ProjectAreaObjectPublic,
    "skuId" | "supplierOption" | "manualSupplier" | "manualSupplierSku"
  >,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): [string, string, string] {
  const row = resolveScopeLineSupplier(line, suppliersBySkuId);
  if (row) {
    const code = line.manualSupplierSku?.trim() || row.supplierSku.trim();
    return [row.supplier.trim(), row.model.trim(), code];
  }
  const manual = line.manualSupplier?.trim();
  if (manual) {
    return [manual, "", line.manualSupplierSku?.trim() ?? ""];
  }
  return ["", "", ""];
}

function pickSupplierOrderCells(
  pick: ScopeLineSkuPick | null | undefined,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): [string, string, string] {
  if (!pick?.skuId) return ["", "", ""];
  const suppliers = suppliersBySkuId[pick.skuId] ?? [];
  const row =
    suppliers.find((s) => s.supplierOption === pick.supplierOption) ??
    preferredSupplierForSku(suppliers);
  if (!row) {
    return [pick.supplier.trim(), "", ""];
  }
  return [row.supplier.trim(), row.model.trim(), row.supplierSku.trim()];
}

function labourCells(row: ProjectAreaObjectPublic): ExportCell[] {
  return WB_WORKBENCH_LABOUR_SILO_HEADERS.map(({ key }) => row[key] ?? "");
}

const LABOUR_HEADERS = WB_WORKBENCH_LABOUR_SILO_HEADERS.map((h) => `${h.label} hours`);

const HEADER: string[] = [
  "Type",
  "Area",
  "Room",
  "Parent product",
  "Category",
  "Included",
  "Description",
  "Source",
  "Elevate",
  "Style",
  "Colour",
  "Product / SKU",
  "SKU ID",
  "Supplier",
  "Model",
  "SKU",
  "Measure",
  "UOM",
  "Unit price",
  "Line total",
  ...LABOUR_HEADERS,
  "Final price",
  "Notes/Actions",
];

/** Export by area: drop Type, Room, Included (marked for removal). */
const AREA_EXPORT_EXCLUDE = new Set(["Type", "Room", "Included"]);
const AREA_EXPORT_HEADER = HEADER.filter((label) => !AREA_EXPORT_EXCLUDE.has(label));
const AREA_EXPORT_COLUMN_INDICES = AREA_EXPORT_HEADER.map((label) => HEADER.indexOf(label));

function toAreaExportRow(cells: ExportCell[]): ExportCell[] {
  return AREA_EXPORT_COLUMN_INDICES.map((i) => cells[i] ?? "");
}

/** Export by supplier (buying): columns kept, in display order (supplier first). */
const SUPPLIER_BUYING_HEADER: string[] = [
  "Supplier",
  "Area",
  "Parent product",
  "Category",
  "Style",
  "Product / SKU",
  "SKU ID",
  "Model",
  "SKU",
  "Measure",
  "UOM",
  "Unit price",
  "Line total",
];

const SUPPLIER_BUYING_COLUMN_INDICES = SUPPLIER_BUYING_HEADER.map((label) => HEADER.indexOf(label));

function toSupplierBuyingRow(cells: ExportCell[]): ExportCell[] {
  return SUPPLIER_BUYING_COLUMN_INDICES.map((i) => cells[i] ?? "");
}

type RowContext = {
  areaName: string;
  roomName: string;
};

function primaryExportRow(
  row: ProjectAreaObjectPublic,
  ctx: RowContext,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus: DataSkuPublic[],
  pa: ProjectAreaPublic,
  project: ProjectPublic,
  priceLevels: PriceLevelPublic[],
  marginPct: number,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
  options?: { bundled?: boolean },
): ExportCell[] {
  const description = options?.bundled
    ? `↳ ${projectLineObjectLabel(row, quoteObjects, catalogSkus)}`
    : projectLineObjectLabel(row, quoteObjects, catalogSkus);
  const [supplier, model, supplierSku] = supplierOrderCells(row, suppliersBySkuId);

  return [
    "Primary",
    ctx.areaName,
    ctx.roomName,
    "",
    "",
    row.included !== false,
    description,
    lineSourceLabel(row),
    elevateLabel(row, pa, project, priceLevels),
    row.style?.trim() ?? "",
    row.colour?.trim() ?? "",
    lineSkuProduct(row, catalogSkus),
    row.skuId?.trim() ?? "",
    supplier,
    model,
    supplierSku,
    row.custommeasure ?? "",
    row.customuom ?? "",
    row.customumprice ?? "",
    row.totalprice ?? "",
    ...labourCells(row),
    lineFinalPrice(row, marginPct) ?? "",
    lineNotes(row),
  ];
}

function partsExportRow(
  sourceLabel: string,
  parentLine: ProjectAreaObjectPublic,
  part: {
    category: string;
    skuProduct: string;
    lineUom: string;
    extendedQty: number;
    skuPick: ScopeLineSkuPick | null;
    retailPriceExcGst: number | null;
    lineTotalExcGst: number | null;
  },
  ctx: RowContext,
  parentProduct: string,
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>,
): ExportCell[] {
  const pick = part.skuPick;
  const discountedUnit =
    part.lineTotalExcGst != null && part.extendedQty > 0
      ? Math.round((part.lineTotalExcGst / part.extendedQty) * 100) / 100
      : pick?.priceExcGst ?? part.retailPriceExcGst ?? "";
  const [supplier, model, supplierSku] = pickSupplierOrderCells(pick, suppliersBySkuId);

  return [
    sourceLabel,
    ctx.areaName,
    ctx.roomName,
    parentProduct,
    part.category || "",
    parentLine.included !== false,
    part.skuProduct,
    "Parts",
    "",
    "",
    "",
    part.skuProduct,
    pick?.skuId ?? "",
    supplier,
    model,
    supplierSku,
    part.extendedQty,
    part.lineUom || "",
    discountedUnit,
    part.lineTotalExcGst ?? "",
    ...WB_WORKBENCH_LABOUR_SILO_HEADERS.map(() => ""),
    "",
    "",
  ];
}

/**
 * Fetches workbench data and downloads a row-based .xls workbook.
 * Primary rows mirror workbench lines; building/painting element components export as Parts rows.
 */
export async function downloadProjectWorkbenchXls(
  projectDocId: string,
  projectDisplayName: string,
  sortMode: WorkbenchXlsSortMode = "by-area",
): Promise<void> {
  const [
    projectRes,
    paRes,
    objRes,
    areasRes,
    qoRes,
    settingsRes,
    priceLevelsRes,
    buildingElementsRes,
    paintingElementsRes,
    supplierDiscRes,
    catalog,
  ] = await Promise.all([
    fetch(`/api/projects/${encodeURIComponent(projectDocId)}`),
    fetch(`/api/projectareas?projectDocId=${encodeURIComponent(projectDocId)}`),
    fetch(`/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId)}`),
    fetch("/api/areas"),
    fetch("/api/quote-objects"),
    fetch("/api/settings"),
    fetch("/api/price-levels"),
    fetch("/api/building-elements"),
    fetch("/api/painting-elements"),
    fetch("/api/supplier-discounts"),
    loadCatalogSkuData(),
  ]);

  const projectData = await readApiJson<{ project?: ProjectPublic; error?: string }>(projectRes);
  if (!projectRes.ok || !projectData.project) {
    throw new Error(projectData.error ?? "Failed to load project");
  }
  const project = projectData.project;
  const numericProjectId =
    typeof project.projectid === "number" && Number.isInteger(project.projectid)
      ? project.projectid
      : null;
  if (numericProjectId == null) {
    throw new Error(
      "This project needs a numeric ID before the workbench can be exported. Save the project once or run Assign missing numeric IDs.",
    );
  }

  const paData = await readApiJson<{ projectAreas?: ProjectAreaPublic[]; error?: string }>(paRes);
  if (!paRes.ok) throw new Error(paData.error ?? "Failed to load project areas");

  const objData = await readApiJson<{
    projectAreaObjects?: ProjectAreaObjectPublic[];
    error?: string;
  }>(objRes);
  if (!objRes.ok) throw new Error(objData.error ?? "Failed to load line items");

  const areasData = await readApiJson<{ areas?: AreaPublic[]; error?: string }>(areasRes);
  if (!areasRes.ok) throw new Error(areasData.error ?? "Failed to load areas");

  const qoData = await readApiJson<{ quoteObjects?: QuoteObjectPublic[]; error?: string }>(qoRes);
  if (!qoRes.ok) throw new Error(qoData.error ?? "Failed to load quote objects");

  const settingsData = await readApiJson<{ settings?: SettingPublic[]; error?: string }>(
    settingsRes,
  );
  const settings = settingsRes.ok ? (settingsData.settings ?? []) : [];
  const marginPct = marginPercentFromSettings(settings);

  const priceLevelsData = await readApiJson<{ priceLevels?: PriceLevelPublic[]; error?: string }>(
    priceLevelsRes,
  );
  const priceLevels = priceLevelsRes.ok ? (priceLevelsData.priceLevels ?? []) : [];

  const buildingElementsData = await readApiJson<{
    items?: DataBuildingElementPublic[];
    error?: string;
  }>(buildingElementsRes);
  const buildingElements = buildingElementsRes.ok
    ? (buildingElementsData.items ?? [])
    : [];

  const paintingElementsData = await readApiJson<{
    items?: DataPaintingElementPublic[];
    error?: string;
  }>(paintingElementsRes);
  const paintingElements = paintingElementsRes.ok
    ? (paintingElementsData.items ?? [])
    : [];

  const supplierDiscData = await readApiJson<{
    items?: DataSupplierDiscountPublic[];
  }>(supplierDiscRes);
  const supplierDiscountByKey = supplierDiscRes.ok
    ? supplierDiscountByKeyFromRows(supplierDiscData.items ?? [])
    : new Map();

  const areas = areasData.areas ?? [];
  const quoteObjects = qoData.quoteObjects ?? [];
  const projectAreas = [...(paData.projectAreas ?? [])].sort(compareProjectAreasDisplayOrder);
  const allObjects = objData.projectAreaObjects ?? [];
  const { skus: catalogSkus, suppliersBySkuId } = catalog;
  const buildingElementBySkuName = buildBuildingElementIndex(buildingElements);
  const paintingElementBySkuName = buildPaintingElementIndex(paintingElements);

  const objectsByProjectAreaDocId = new Map<string, ProjectAreaObjectPublic[]>();
  for (const row of allObjects) {
    let key = row.projectAreaDocId?.trim() ?? "";
    if (!key) {
      const sole = projectAreas.filter((pa) => pa.areaid === row.areaid);
      key = sole.length === 1 ? sole[0].id : `__orphan__${row.id}`;
    }
    const list = objectsByProjectAreaDocId.get(key) ?? [];
    list.push(row);
    objectsByProjectAreaDocId.set(key, list);
  }

  const sortModeLabel =
    sortMode === "by-supplier" ? "By supplier, then object type" : "By area, then object type";

  const exportHeader = sortMode === "by-supplier" ? SUPPLIER_BUYING_HEADER : AREA_EXPORT_HEADER;

  const rows: ExportCell[][] = [
    [`Workbench — ${project.projectname || projectDisplayName}`],
    [`Margin % (from settings): ${marginPct}`],
    [`Sort: ${sortModeLabel}`],
    [],
    exportHeader,
  ];

  const supplierSortEntries: SortableExportEntry[] = [];

  if (projectAreas.length === 0) {
    rows.push(["No areas on this project yet."]);
  } else {
    for (const pa of projectAreas) {
      const lineRows = objectsByProjectAreaDocId.get(pa.id) ?? [];
      const ctx: RowContext = {
        areaName: areaTemplateName(pa, areas),
        roomName: roomLabel(pa),
      };
      const { topLevel, bundledByParentId } = partitionAreaLines(lineRows);
      const orderedTopLevel =
        sortMode === "by-area"
          ? sortTopLevelByObjectType(topLevel, quoteObjects, catalogSkus)
          : topLevel;

      if (orderedTopLevel.length === 0) {
        if (sortMode === "by-area") {
          rows.push(
            toAreaExportRow([
              "Primary",
              ctx.areaName,
              ctx.roomName,
              "",
              "",
              "",
              "No objects in this area yet.",
              ...Array(HEADER.length - 7).fill(""),
            ]),
          );
        }
        continue;
      }

      for (const row of orderedTopLevel) {
        const objectType = lineObjectType(row, quoteObjects);
        const primaryCells = primaryExportRow(
          row,
          ctx,
          quoteObjects,
          catalogSkus,
          pa,
          project,
          priceLevels,
          marginPct,
          suppliersBySkuId,
        );
        const primaryDescription = String(primaryCells[6] ?? "");

        if (sortMode === "by-supplier") {
          const [supplier] = supplierOrderCells(row, suppliersBySkuId);
          supplierSortEntries.push({
            cells: primaryCells,
            supplier,
            objectType,
            areaName: ctx.areaName,
            description: primaryDescription,
          });
        } else {
          rows.push(toAreaExportRow(primaryCells));
        }

        const element = findBuildingElementForLine(row, catalogSkus, buildingElementBySkuName);
        if (element) {
          const parentProduct = lineSkuProduct(row, catalogSkus);
          const partRows = buildBuildingElementConsumptionRows(
            element,
            row,
            catalogSkus,
            suppliersBySkuId,
            supplierDiscountByKey,
          );
          for (const part of partRows) {
            const partCells = partsExportRow(
              "Parts",
              row,
              {
                category: part.category,
                skuProduct: part.skuProduct,
                lineUom: part.lineUom,
                extendedQty: part.extendedQty,
                skuPick: part.skuPick,
                retailPriceExcGst: part.retailPriceExcGst,
                lineTotalExcGst: part.lineTotalExcGst,
              },
              ctx,
              parentProduct,
              suppliersBySkuId,
            );
            const [partSupplier] = pickSupplierOrderCells(part.skuPick, suppliersBySkuId);
            const partDescription = String(partCells[6] ?? "");
            const partObjectType = part.category?.trim() || objectType;

            if (sortMode === "by-supplier") {
              supplierSortEntries.push({
                cells: partCells,
                supplier: partSupplier,
                objectType: partObjectType,
                areaName: ctx.areaName,
                description: partDescription,
              });
            } else {
              rows.push(toAreaExportRow(partCells));
            }
          }
        }

        const paintElement = findPaintingElementForLine(row, catalogSkus, paintingElementBySkuName);
        if (paintElement) {
          const parentProduct = lineSkuProduct(row, catalogSkus);
          const paintPartRows = buildPaintingElementConsumptionRows(
            paintElement,
            row,
            catalogSkus,
            suppliersBySkuId,
            supplierDiscountByKey,
          );
          for (const part of paintPartRows) {
            const partCells = partsExportRow(
              "Paint Parts",
              row,
              {
                category: part.category,
                skuProduct: part.skuProduct,
                lineUom: part.lineUom,
                extendedQty: part.extendedM2,
                skuPick: part.skuPick,
                retailPriceExcGst: part.retailPriceExcGst,
                lineTotalExcGst: part.lineTotalExcGst,
              },
              ctx,
              parentProduct,
              suppliersBySkuId,
            );
            const [partSupplier] = pickSupplierOrderCells(part.skuPick, suppliersBySkuId);
            const partDescription = String(partCells[6] ?? "");
            const partObjectType = part.category?.trim() || objectType;

            if (sortMode === "by-supplier") {
              supplierSortEntries.push({
                cells: partCells,
                supplier: partSupplier,
                objectType: partObjectType,
                areaName: ctx.areaName,
                description: partDescription,
              });
            } else {
              rows.push(toAreaExportRow(partCells));
            }
          }
        }

        for (const child of bundledByParentId.get(row.id) ?? []) {
          const childObjectType = lineObjectType(child, quoteObjects);
          const bundledCells = primaryExportRow(
            child,
            ctx,
            quoteObjects,
            catalogSkus,
            pa,
            project,
            priceLevels,
            marginPct,
            suppliersBySkuId,
            { bundled: true },
          );
          const bundledDescription = String(bundledCells[6] ?? "");

          if (sortMode === "by-supplier") {
            const [childSupplier] = supplierOrderCells(child, suppliersBySkuId);
            supplierSortEntries.push({
              cells: bundledCells,
              supplier: childSupplier,
              objectType: childObjectType,
              areaName: ctx.areaName,
              description: bundledDescription,
            });
          } else {
            rows.push(toAreaExportRow(bundledCells));
          }
        }
      }
    }

    if (sortMode === "by-supplier") {
      if (supplierSortEntries.length === 0) {
        rows.push(["No exportable lines on this project yet."]);
      } else {
        for (const entry of sortExportEntriesBySupplier(supplierSortEntries)) {
          rows.push(toSupplierBuyingRow(entry.cells));
        }
      }
    }
  }

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Workbench");
  const base = safeFileBase(project.projectname || projectDisplayName);
  const suffix = sortMode === "by-supplier" ? "workbench-by-supplier" : "workbench-by-area";
  XLSX.writeFile(wb, `${base}-${suffix}.xls`, { bookType: "xls" });
}
