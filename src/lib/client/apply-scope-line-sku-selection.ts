import {
  patchBodyForScopeLineSku,
  patchBodyClearScopeLineSku,
  customUomFromSkuPick,
} from "@/lib/client/scope-line-sku-patch";
import {
  resolveAppendChildSkuPicks,
  type ResolvedAppendChild,
} from "@/lib/client/resolve-append-child-sku-picks";
import { type ScopeLineSkuPick } from "@/lib/client/scope-line-sku-match";
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
  const customuom = customUomFromSkuPick(pick.uom || sku?.uom);
  if (customuom) body.customuom = customuom;
  return body;
}

function patchBodyClearBundledSku(): Record<string, unknown> {
  return patchBodyClearScopeLineSku();
}

function patchBodySyncBundledMeasure(parentLine: ProjectAreaObjectPublic): Record<string, unknown> {
  return {
    custommeasure: parentLine.custommeasure ?? null,
  };
}

function skuIdentityMatches(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption" | "customumprice">,
  pick: ScopeLineSkuPick,
): boolean {
  return (
    (line.skuId ?? "").trim() === pick.skuId &&
    line.supplierOption === pick.supplierOption
  );
}

/** Let the SKU dropdown paint before pricing / bundled-child work. */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Show the chosen SKU immediately; leave unit/total price for the server round-trip. */
function applyOptimisticSkuIdentity(
  onObjectsChange: (updater: (prev: ProjectAreaObjectPublic[]) => ProjectAreaObjectPublic[]) => void,
  lineId: string,
  pick: Pick<ScopeLineSkuPick, "skuId" | "product" | "supplierOption"> | null,
) {
  onObjectsChange((prev) =>
    prev.map((o) =>
      o.id !== lineId
        ? o
        : {
            ...o,
            skuId: pick ? pick.skuId : null,
            skuProduct: pick ? pick.product : null,
            supplierOption: pick ? pick.supplierOption : null,
          },
    ),
  );
}

/** Skip PATCH when SKU is already stored. Never overwrite a saved unit price. */
function shouldSkipSkuPatch(
  line: Pick<ProjectAreaObjectPublic, "skuId" | "supplierOption" | "customumprice">,
  pick: ScopeLineSkuPick,
): boolean {
  if (!skuIdentityMatches(line, pick)) return false;
  if (line.customumprice != null) return true;
  return pick.priceExcGst == null;
}

function mergeReturnedLine(
  onObjectsChange: (updater: (prev: ProjectAreaObjectPublic[]) => ProjectAreaObjectPublic[]) => void,
  line: ProjectAreaObjectPublic | undefined,
  id: string,
): boolean {
  if (!line) return false;
  onObjectsChange((prev) => prev.map((o) => (o.id === id ? line : o)));
  return true;
}

function mergeCreatedLine(
  onObjectsChange: (updater: (prev: ProjectAreaObjectPublic[]) => ProjectAreaObjectPublic[]) => void,
  line: ProjectAreaObjectPublic | undefined,
): boolean {
  if (!line) return false;
  onObjectsChange((prev) => (prev.some((o) => o.id === line.id) ? prev : [...prev, line]));
  return true;
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
    const customuom = customUomFromSkuPick(pick.uom);
    if (customuom) body.customuom = customuom;
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
  /**
   * Reload only this project area when a write succeeded but the response body
   * was missing — never used to throw away a successful merge.
   */
  reloadAreaLines: () => Promise<void>;
  setError: (msg: string | null) => void;
  measureForPricing?: number | null;
  colourLookupIndex?: ColourLookupIndex | null;
}): Promise<void> {
  if (!skuIdentityMatches(args.parentLine, args.pick)) {
    applyOptimisticSkuIdentity(args.onObjectsChange, args.parentLine.id, args.pick);
  }
  await yieldToPaint();

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
          pickAppendSlots: args.pick.appendSlots,
        })
      : [];

  const existingChildren = bundledChildrenForParent(args.allObjects, args.parentLine.id);
  const slotsNeeded = new Set(
    resolved.filter((r) => r.quoteObjectDocId).map((r) => r.slot),
  );
  const existingSlots = new Set(
    existingChildren
      .map((c) => c.bundledAppendSlot)
      .filter((s): s is 1 | 2 | 3 => s === 1 || s === 2 || s === 3),
  );
  const slotsAlreadyMatch =
    existingSlots.size === slotsNeeded.size &&
    [...slotsNeeded].every((s) => existingSlots.has(s));

  const parentPatch = patchBodyForScopeLineSku(
    args.parentLine,
    args.pick,
    args.measureForPricing,
  );
  const catalogUom = customUomFromSkuPick(parentSku?.uom);
  if (catalogUom) parentPatch.customuom = catalogUom;
  const skipParentPatch = shouldSkipSkuPatch(args.parentLine, args.pick);
  if (skipParentPatch && slotsAlreadyMatch) {
    return;
  }

  let needsAreaRefresh = false;

  if (!skipParentPatch) {
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
    if (
      !mergeReturnedLine(args.onObjectsChange, parentData.projectAreaObject, args.parentLine.id)
    ) {
      needsAreaRefresh = true;
    }
  }

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
        if (shouldSkipSkuPatch(existing, item.pick)) continue;
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
        if (!mergeReturnedLine(args.onObjectsChange, data.projectAreaObject, existing.id)) {
          needsAreaRefresh = true;
        }
      } else {
        const created = await createBundledChildLine(
          args.parentLine,
          args.projectAreaDocId,
          item,
        );
        if (created.wrote && !mergeCreatedLine(args.onObjectsChange, created.line)) {
          needsAreaRefresh = true;
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
        if (!mergeReturnedLine(args.onObjectsChange, data.projectAreaObject, existing.id)) {
          needsAreaRefresh = true;
        }
      } else {
        const created = await createBundledChildLine(
          args.parentLine,
          args.projectAreaDocId,
          item,
        );
        if (created.wrote && !mergeCreatedLine(args.onObjectsChange, created.line)) {
          needsAreaRefresh = true;
        }
      }
    } else if (existing) {
      const parentMeasure = args.parentLine.custommeasure ?? null;
      if (existing.custommeasure === parentMeasure) continue;
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
      if (!mergeReturnedLine(args.onObjectsChange, data.projectAreaObject, existing.id)) {
        needsAreaRefresh = true;
      }
    } else {
      const created = await createBundledChildLine(
        args.parentLine,
        args.projectAreaDocId,
        item,
      );
      if (created.wrote && !mergeCreatedLine(args.onObjectsChange, created.line)) {
        needsAreaRefresh = true;
      }
    }
  }

  if (needsAreaRefresh) {
    await args.reloadAreaLines();
  }
}

async function createBundledChildLine(
  parentLine: ProjectAreaObjectPublic,
  projectAreaDocId: string,
  item: ResolvedAppendChild,
): Promise<{ wrote: boolean; line?: ProjectAreaObjectPublic }> {
  const createBody = createBundledLineBody(parentLine, projectAreaDocId, item);
  if (!createBody) return { wrote: false };
  const res = await fetch("/api/projectareaobjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  const data = await readApiResponse<{ id?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? "Failed to add bundled line");
  if (!data.id) return { wrote: true };
  const getRes = await fetch(`/api/projectareaobjects/${data.id}`);
  const getData = await readApiResponse<{
    projectAreaObject?: ProjectAreaObjectPublic;
    error?: string;
  }>(getRes);
  if (getRes.ok && getData.projectAreaObject) {
    return { wrote: true, line: getData.projectAreaObject };
  }
  return { wrote: true };
}

/**
 * Clear the line’s SKU (back to “Select…”) and remove bundled children that came from it.
 */
export async function clearScopeLineSkuWithBundledChildren(args: {
  parentLine: ProjectAreaObjectPublic;
  allObjects: ProjectAreaObjectPublic[];
  onObjectsChange: (updater: (prev: ProjectAreaObjectPublic[]) => ProjectAreaObjectPublic[]) => void;
  reloadAreaLines: () => Promise<void>;
}): Promise<void> {
  applyOptimisticSkuIdentity(args.onObjectsChange, args.parentLine.id, null);
  await yieldToPaint();

  let needsAreaRefresh = false;
  const parentRes = await fetch(`/api/projectareaobjects/${args.parentLine.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patchBodyClearScopeLineSku()),
  });
  const parentData = await readApiResponse<{
    projectAreaObject?: ProjectAreaObjectPublic;
    error?: string;
  }>(parentRes);
  if (!parentRes.ok) throw new Error(parentData.error ?? "Save failed");
  if (
    !mergeReturnedLine(args.onObjectsChange, parentData.projectAreaObject, args.parentLine.id)
  ) {
    needsAreaRefresh = true;
  }

  const existingChildren = bundledChildrenForParent(args.allObjects, args.parentLine.id);
  for (const child of existingChildren) {
    const delRes = await fetch(`/api/projectareaobjects/${child.id}`, { method: "DELETE" });
    const delData = await readApiResponse<{ error?: string }>(delRes);
    if (!delRes.ok) throw new Error(delData.error ?? "Failed to remove bundled line");
    args.onObjectsChange((prev) => prev.filter((o) => o.id !== child.id));
  }

  if (needsAreaRefresh) {
    await args.reloadAreaLines();
  }
}
