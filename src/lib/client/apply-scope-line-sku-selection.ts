import { patchBodyForScopeLineSku } from "@/lib/client/scope-line-sku-patch";
import {
  resolveAppendChildSkuPicks,
  type ResolvedAppendChild,
} from "@/lib/client/resolve-append-child-sku-picks";
import type { ScopeLineSkuPick } from "@/lib/client/scope-line-sku-match";
import { quoteObjectCategory } from "@/lib/client/quote-object-category";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { isSkuYnUom, SKU_YN_UOM } from "@/lib/sku/sku-yn-uom";

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

function bundledChildrenForParent(
  allObjects: ProjectAreaObjectPublic[],
  parentLineId: string,
): ProjectAreaObjectPublic[] {
  return allObjects.filter(
    (o) => o.linesource === "bundled" && o.bundledFromLineId === parentLineId,
  );
}

function patchBodyForBundledChild(
  parentLine: ProjectAreaObjectPublic,
  pick: ScopeLineSkuPick,
  catalogSkus: DataSkuPublic[],
  measureForPricing?: number | null,
): Record<string, unknown> {
  const body = patchBodyForScopeLineSku(parentLine, pick, measureForPricing);
  const sku = catalogSkus.find((s) => s.skuId === pick.skuId);
  if (sku && isSkuYnUom(sku.uom)) {
    body.customuom = SKU_YN_UOM;
  }
  return body;
}

function patchBodyClearBundledSku(): Record<string, unknown> {
  return {
    skuId: null,
    skuProduct: null,
    supplierOption: null,
    customumprice: null,
    totalprice: null,
  };
}

function patchBodySyncBundledMeasure(parentLine: ProjectAreaObjectPublic): Record<string, unknown> {
  return {
    custommeasure: parentLine.custommeasure ?? null,
  };
}

function createBundledLineBody(
  parentLine: ProjectAreaObjectPublic,
  projectAreaDocId: string,
  resolved: ResolvedAppendChild,
): Record<string, unknown> | null {
  if (!resolved.quoteObjectDocId) return null;
  const body: Record<string, unknown> = {
    projectAreaDocId,
    quoteObjectDocId: resolved.quoteObjectDocId,
    bundledFromLineId: parentLine.id,
    bundledAppendSlot: resolved.slot,
    style: parentLine.style ?? null,
    colour: parentLine.colour ?? null,
    pricelevelid: parentLine.pricelevelid ?? null,
    custommeasure: parentLine.custommeasure ?? null,
  };
  if (resolved.pick) {
    const pick = resolved.pick;
    const measure = parentLine.custommeasure ?? 1;
    body.skuId = pick.skuId;
    body.skuProduct = pick.product;
    body.supplierOption = pick.supplierOption;
    if (pick.priceExcGst != null) {
      body.customumprice = pick.priceExcGst;
      body.custommeasure = parentLine.custommeasure ?? measure;
      body.totalprice = (parentLine.custommeasure ?? measure) * pick.priceExcGst;
    }
  }
  return body;
}

/**
 * Apply primary SKU to a scope/workbench line and sync bundled child lines from append slots.
 */
export async function applyScopeLineSkuWithBundledChildren(args: {
  parentLine: ProjectAreaObjectPublic;
  pick: ScopeLineSkuPick;
  projectAreaDocId: string;
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  quoteObjects: QuoteObjectPublic[];
  priceLevels: PriceLevelPublic[];
  cascades?: CascadeRow[];
  supplierDiscountByKey?: SupplierDiscountByKey;
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  allObjects: ProjectAreaObjectPublic[];
  onObjectsChange: (updater: (prev: ProjectAreaObjectPublic[]) => ProjectAreaObjectPublic[]) => void;
  reloadLineItems: () => Promise<void>;
  setError: (msg: string | null) => void;
  measureForPricing?: number | null;
  colourLookupIndex?: ColourLookupIndex | null;
}): Promise<void> {
  const parentSku = args.catalogSkus.find((s) => s.skuId === args.pick.skuId);
  const category = quoteObjectCategory(args.parentLine, args.quoteObjects);

  const resolved =
    parentSku && category
      ? resolveAppendChildSkuPicks({
          parentSku,
          parentCategory: category,
          catalogSkus: args.catalogSkus,
          suppliersBySkuId: args.suppliersBySkuId,
          line: args.parentLine,
          pa: args.pa,
          project: args.project,
          priceLevels: args.priceLevels,
          cascades: args.cascades,
          quoteObjects: args.quoteObjects,
          preferredSupplierOption: args.pick.supplierOption,
          supplierDiscountByKey: args.supplierDiscountByKey,
          colourLookupIndex: args.colourLookupIndex ?? null,
        })
      : [];

  const parentPatch = patchBodyForScopeLineSku(
    args.parentLine,
    args.pick,
    args.measureForPricing,
  );
  if (parentSku && isSkuYnUom(parentSku.uom)) {
    parentPatch.customuom = SKU_YN_UOM;
  }
  const parentRes = await fetch(`/api/projectareaobjects/${args.parentLine.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parentPatch),
  });
  const parentData = await readApiResponse<{
    projectAreaObject?: ProjectAreaObjectPublic;
    error?: string;
  }>(parentRes);
  if (!parentRes.ok) throw new Error(parentData.error ?? "Save failed");
  if (parentData.projectAreaObject) {
    args.onObjectsChange((prev) =>
      prev.map((o) => (o.id === args.parentLine.id ? parentData.projectAreaObject! : o)),
    );
  }

  const existingChildren = bundledChildrenForParent(args.allObjects, args.parentLine.id);
  const slotsNeeded = new Set(
    resolved.filter((r) => r.quoteObjectDocId).map((r) => r.slot),
  );

  for (const child of existingChildren) {
    const slot = child.bundledAppendSlot;
    const stillNeeded = slot != null && slotsNeeded.has(slot);
    if (!stillNeeded) {
      const delRes = await fetch(`/api/projectareaobjects/${child.id}`, { method: "DELETE" });
      const delData = await readApiResponse<{ error?: string }>(delRes);
      if (!delRes.ok) throw new Error(delData.error ?? "Failed to remove bundled line");
      args.onObjectsChange((prev) => prev.filter((o) => o.id !== child.id));
    }
  }

  for (const item of resolved) {
    if (!item.quoteObjectDocId) continue;
    const existing = existingChildren.find((c) => c.bundledAppendSlot === item.slot);
    if (item.pick) {
      if (existing) {
        const patch = patchBodyForBundledChild(
          args.parentLine,
          item.pick,
          args.catalogSkus,
          args.measureForPricing,
        );
        const res = await fetch(`/api/projectareaobjects/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await readApiResponse<{
          projectAreaObject?: ProjectAreaObjectPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to update bundled line");
        if (data.projectAreaObject) {
          args.onObjectsChange((prev) =>
            prev.map((o) => (o.id === existing.id ? data.projectAreaObject! : o)),
          );
        }
      } else {
        const createBody = createBundledLineBody(args.parentLine, args.projectAreaDocId, item);
        if (!createBody) continue;
        const res = await fetch("/api/projectareaobjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        });
        const data = await readApiResponse<{ id?: string; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to add bundled line");
        if (data.id) {
          const getRes = await fetch(`/api/projectareaobjects/${data.id}`);
          const getData = await readApiResponse<{
            projectAreaObject?: ProjectAreaObjectPublic;
            error?: string;
          }>(getRes);
          if (getRes.ok && getData.projectAreaObject) {
            args.onObjectsChange((prev) => [...prev, getData.projectAreaObject!]);
          }
        }
      }
    } else if (item.resolveError) {
      if (existing) {
        const patch = {
          ...patchBodyClearBundledSku(),
          ...patchBodySyncBundledMeasure(args.parentLine),
        };
        const res = await fetch(`/api/projectareaobjects/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await readApiResponse<{
          projectAreaObject?: ProjectAreaObjectPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to update bundled line");
        if (data.projectAreaObject) {
          args.onObjectsChange((prev) =>
            prev.map((o) => (o.id === existing.id ? data.projectAreaObject! : o)),
          );
        }
      } else {
        const createBody = createBundledLineBody(args.parentLine, args.projectAreaDocId, item);
        if (!createBody) continue;
        const res = await fetch("/api/projectareaobjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        });
        const data = await readApiResponse<{ id?: string; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to add bundled line");
        if (data.id) {
          const getRes = await fetch(`/api/projectareaobjects/${data.id}`);
          const getData = await readApiResponse<{
            projectAreaObject?: ProjectAreaObjectPublic;
            error?: string;
          }>(getRes);
          if (getRes.ok && getData.projectAreaObject) {
            args.onObjectsChange((prev) => [...prev, getData.projectAreaObject!]);
          }
        }
      }
    } else {
      if (existing) {
        const res = await fetch(`/api/projectareaobjects/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBodySyncBundledMeasure(args.parentLine)),
        });
        const data = await readApiResponse<{
          projectAreaObject?: ProjectAreaObjectPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to update bundled line");
        if (data.projectAreaObject) {
          args.onObjectsChange((prev) =>
            prev.map((o) => (o.id === existing.id ? data.projectAreaObject! : o)),
          );
        }
      } else {
        const createBody = createBundledLineBody(args.parentLine, args.projectAreaDocId, item);
        if (!createBody) continue;
        const res = await fetch("/api/projectareaobjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        });
        const data = await readApiResponse<{ id?: string; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to add bundled line");
        if (data.id) {
          const getRes = await fetch(`/api/projectareaobjects/${data.id}`);
          const getData = await readApiResponse<{
            projectAreaObject?: ProjectAreaObjectPublic;
            error?: string;
          }>(getRes);
          if (getRes.ok && getData.projectAreaObject) {
            args.onObjectsChange((prev) => [...prev, getData.projectAreaObject!]);
          }
        }
      }
    }
  }

  await args.reloadLineItems();
}
