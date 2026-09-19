import { quoteObjectForProjectLine } from "@/lib/client/project-line-quote-object";
import {
  effectiveElevateLevelForLine,
  effectiveStyleColourForLine,
  matchingSkusForScopeLine,
  skuOptionLabel,
} from "@/lib/client/scope-line-sku-match";
import {
  expectedShowAllCatalogSkus,
  scopeObjectIsShowAll,
} from "@/lib/client/scope-show-all-expected";
import { uniqueNoteSkuOptionsBySkuId } from "@/lib/project-note-filters";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

export type ProjectNoteSkuOption = { skuId: string; label: string };

function catalogSkuLabel(catalogSkus: DataSkuPublic[], skuId: string): string {
  const sku = catalogSkus.find((s) => s.skuId === skuId);
  return sku ? skuOptionLabel(sku) : skuId;
}

function lineSkuLabel(line: ProjectAreaObjectPublic, catalogSkus: DataSkuPublic[]): string {
  const skuId = line.skuId?.trim() ?? "";
  const product = line.skuProduct?.trim();
  if (skuId && product) return `${skuId} · ${product}`;
  if (skuId) return catalogSkuLabel(catalogSkus, skuId);
  return product || skuId;
}

/**
 * SKU choices for notes: selected line SKUs, plus catalog matches for the object
 * even when the user has not picked a finish yet (e.g. Show All benchtop finishes).
 */
export function collectProjectNoteSkuOptions(args: {
  lines: ProjectAreaObjectPublic[];
  catalogSkus: DataSkuPublic[];
  extraSkuIds?: string[];
  quoteObjects?: QuoteObjectPublic[];
  projectAreas?: ProjectAreaPublic[];
  project?: ProjectPublic | null;
  priceLevels?: PriceLevelPublic[];
  cascades?: CascadeRow[];
  colourLookupIndex?: ColourLookupIndex | null;
  scopes?: ScopePublic[];
}): ProjectNoteSkuOption[] {
  const byId = new Map<string, ProjectNoteSkuOption>();
  const remember = (skuId: string, label: string) => {
    const id = skuId.trim();
    if (!id) return;
    const key = id.toLowerCase();
    if (byId.has(key)) return;
    byId.set(key, {
      skuId: id,
      label: label.trim() || catalogSkuLabel(args.catalogSkus, id),
    });
  };

  for (const line of args.lines) {
    const id = line.skuId?.trim();
    if (id) remember(id, lineSkuLabel(line, args.catalogSkus));
  }

  for (const extra of args.extraSkuIds ?? []) {
    const id = extra.trim();
    if (id) remember(id, catalogSkuLabel(args.catalogSkus, id));
  }

  const quoteObjects = args.quoteObjects ?? [];
  const projectAreas = args.projectAreas ?? [];
  const priceLevels = args.priceLevels ?? [];
  if (quoteObjects.length > 0 && projectAreas.length > 0 && priceLevels.length > 0) {
    const byObject = new Map<string, ProjectAreaObjectPublic[]>();
    for (const line of args.lines) {
      const key = `${line.areaid}:${line.objectid}`;
      const list = byObject.get(key) ?? [];
      list.push(line);
      byObject.set(key, list);
    }

    for (const objectLines of byObject.values()) {
      const line = objectLines[0];
      if (!line) continue;
      const pa =
        projectAreas.find((p) => p.id === (line.projectAreaDocId?.trim() ?? "")) ??
        projectAreas.find((p) => p.areaid === line.areaid);
      if (!pa) continue;
      const quoteObject = quoteObjectForProjectLine(line, quoteObjects);
      const { style, colour } = effectiveStyleColourForLine(pa, args.project ?? null, line);
      const elevateLevel = effectiveElevateLevelForLine(
        priceLevels,
        line,
        pa,
        args.project ?? null,
        args.cascades,
      );
      const filters = { elevateLevel, style, colour };
      const matchOptions = { colourLookupIndex: args.colourLookupIndex ?? null };
      for (const sku of matchingSkusForScopeLine(
        args.catalogSkus,
        quoteObject,
        filters,
        matchOptions,
      )) {
        remember(sku.skuId, skuOptionLabel(sku));
      }
      const scope = args.scopes?.find((s) => s.id === (line.scopeDocId?.trim() ?? ""));
      if (scopeObjectIsShowAll(objectLines, quoteObject, scope)) {
        for (const sku of expectedShowAllCatalogSkus(
          objectLines,
          quoteObject,
          args.catalogSkus,
          filters,
          args.colourLookupIndex ?? null,
        )) {
          remember(sku.skuId, skuOptionLabel(sku));
        }
      }
    }
  }

  return uniqueNoteSkuOptionsBySkuId([...byId.values()]).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

export function noteTargetSkuIdForLine(
  line: Pick<ProjectAreaObjectPublic, "skuId">,
): string | null {
  const id = line.skuId?.trim();
  return id || null;
}
