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
): Record<string, unknown> {
  const body = patchBodyForScopeLineSku(parentLine, pick);
  return body;
}

function createBundledLineBody(
  parentLine: ProjectAreaObjectPublic,
  projectAreaDocId: string,
  resolved: ResolvedAppendChild,
): Record<string, unknown> | null {
  if (!resolved.quoteObjectDocId || !resolved.pick) return null;
  const pick = resolved.pick;
  const measure = parentLine.custommeasure ?? 1;
  const body: Record<string, unknown> = {
    projectAreaDocId,
    quoteObjectDocId: resolved.quoteObjectDocId,
    bundledFromLineId: parentLine.id,
    bundledAppendSlot: resolved.slot,
    skuId: pick.skuId,
    skuProduct: pick.product,
    supplierOption: pick.supplierOption,
    style: parentLine.style ?? null,
    colour: parentLine.colour ?? null,
    pricelevelid: parentLine.pricelevelid ?? null,
    custommeasure: parentLine.custommeasure ?? null,
  };
  if (pick.priceExcGst != null) {
    body.customumprice = pick.priceExcGst;
    body.custommeasure = parentLine.custommeasure ?? measure;
    body.totalprice = (parentLine.custommeasure ?? measure) * pick.priceExcGst;
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
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  allObjects: ProjectAreaObjectPublic[];
  onObjectsChange: (updater: (prev: ProjectAreaObjectPublic[]) => ProjectAreaObjectPublic[]) => void;
  reloadLineItems: () => Promise<void>;
  setError: (msg: string | null) => void;
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
          quoteObjects: args.quoteObjects,
          preferredSupplierOption: args.pick.supplierOption,
        })
      : [];

  const parentPatch = patchBodyForScopeLineSku(args.parentLine, args.pick);
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
  const slotsNeeded = new Set(resolved.map((r) => r.slot));

  for (const child of existingChildren) {
    const slot = child.bundledAppendSlot;
    const stillNeeded =
      slot != null && slotsNeeded.has(slot) && resolved.some((r) => r.slot === slot && r.pick);
    if (!stillNeeded) {
      const delRes = await fetch(`/api/projectareaobjects/${child.id}`, { method: "DELETE" });
      const delData = await readApiResponse<{ error?: string }>(delRes);
      if (!delRes.ok) throw new Error(delData.error ?? "Failed to remove bundled line");
      args.onObjectsChange((prev) => prev.filter((o) => o.id !== child.id));
    }
  }

  for (const item of resolved) {
    if (!item.pick || !item.quoteObjectDocId) continue;
    const existing = existingChildren.find((c) => c.bundledAppendSlot === item.slot);
    if (existing) {
      const patch = patchBodyForBundledChild(args.parentLine, item.pick);
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
  }

  await args.reloadLineItems();
}
