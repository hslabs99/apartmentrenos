import {
  buildScopeLineSkuPicks,
  effectiveElevateLevelForLine,
  effectiveStyleColourForLine,
  matchingSkusForScopeLine,
  type ScopeLineSkuMatchOptions,
} from "@/lib/client/scope-line-sku-match";
import {
  countSkusMatchingBaseProductKey,
  dataSkuFilterPipeline,
  type DataSkuFilterPipelineStep,
} from "@/lib/sku/match-data-sku-filters";
import type { ColourLookupIndex } from "@/lib/sku/colour-lookup-index";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";

export type ScopeLineSkuMatchDiagnostic = {
  summary: string;
  failureKind:
    | "missing_quote_object"
    | "missing_quote_fields"
    | "no_catalog_rows"
    | "filter_no_match"
    | "lock_to_sku"
    | "no_supplier_rows"
    | "unknown";
  query: {
    category: string;
    productType: string;
    elevateLevel: string;
    style: string;
    colour: string;
    includeAllDimensionSkuRows: boolean;
    lockToSkuId: string | null;
  };
  filterSources: {
    elevateLevel: string;
    style: string;
    colour: string;
  };
  quoteObject: {
    id: string | null;
    objectid: number | null;
    category: string;
    objectname: string;
    uom: string;
  };
  catalogStats: {
    totalLoaded: number;
    currentCount: number;
    baseProductKeyCount: number;
  };
  pipeline: DataSkuFilterPipelineStep[];
  catalogMatchSkuIds: string[];
  pickCount: number;
  lockFilteredOut: boolean;
};

function filterSourceLabel(
  lineVal: string | null | undefined,
  areaVal: string | null | undefined,
  projectVal: string | null | undefined,
  field: string,
): string {
  if (lineVal?.trim()) return `${field} from line override: "${lineVal.trim()}"`;
  if (areaVal?.trim()) return `${field} from area: "${areaVal.trim()}"`;
  if (projectVal?.trim()) return `${field} from project default: "${projectVal.trim()}"`;
  return `${field} blank (filter skipped — matches any)`;
}

function elevateSourceLabel(
  line: ProjectAreaObjectPublic,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
  priceLevels: PriceLevelPublic[],
  cascades: CascadeRow[],
): string {
  const plId = line.pricelevelid ?? pa.pricelevelid ?? project?.defaultpricelevelid ?? null;
  if (line.pricelevelid != null) {
    const hit = priceLevels.find((p) => p.pricelevelid === line.pricelevelid);
    return `Price level from line (#${line.pricelevelid}${hit?.pricelevel ? `: ${hit.pricelevel}` : ""}), via cascades`;
  }
  if (pa.pricelevelid != null) {
    const hit = priceLevels.find((p) => p.pricelevelid === pa.pricelevelid);
    return `Price level from area (#${pa.pricelevelid}${hit?.pricelevel ? `: ${hit.pricelevel}` : ""}), via cascades`;
  }
  if (project?.defaultpricelevelid != null) {
    const hit = priceLevels.find((p) => p.pricelevelid === project.defaultpricelevelid);
    return `Price level from project (#${project.defaultpricelevelid}${hit?.pricelevel ? `: ${hit.pricelevel}` : ""}), via cascades`;
  }
  if (project?.projectfinish?.trim()) {
    return `No price level — project finish "${project.projectfinish.trim()}" via cascades`;
  }
  if (cascades.length === 0) return "No price level or project finish (elevate filter blank)";
  return "No price level set (elevate filter blank)";
}

export function diagnoseScopeLineSkuMatch(args: {
  line: ProjectAreaObjectPublic;
  quoteObject: QuoteObjectPublic | undefined;
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  priceLevels: PriceLevelPublic[];
  cascades?: CascadeRow[];
  pa: ProjectAreaPublic;
  project: ProjectPublic | null;
  lockToSkuId?: string | null;
  colourLookupIndex?: ColourLookupIndex | null;
}): ScopeLineSkuMatchDiagnostic {
  const {
    line,
    quoteObject,
    catalogSkus,
    suppliersBySkuId,
    priceLevels,
    cascades = [],
    pa,
    project,
    lockToSkuId = null,
    colourLookupIndex = null,
  } = args;

  const skuMatchOptions: ScopeLineSkuMatchOptions = { colourLookupIndex };
  const filterOptions = {
    includeAllDimensionSkuRows: true as const,
    colourLookupIndex,
  };

  const { style, colour } = effectiveStyleColourForLine(pa, project, line);
  const elevateLevel = effectiveElevateLevelForLine(priceLevels, line, pa, project, cascades);
  const category = quoteObject?.category?.trim() ?? "";
  const productType = quoteObject?.objectname?.trim() ?? "";
  const locked = lockToSkuId?.trim() || null;

  const query = {
    category,
    productType,
    elevateLevel,
    style,
    colour,
    includeAllDimensionSkuRows: true,
    lockToSkuId: locked,
  };

  const currentCount = catalogSkus.filter((s) => s.isCurrent !== false).length;
  const baseProductKeyCount = countSkusMatchingBaseProductKey(catalogSkus, category, productType);

  const emptyPipeline: DataSkuFilterPipelineStep[] = [];
  const baseDiagnostic = {
    query,
    filterSources: {
      elevateLevel: elevateSourceLabel(line, pa, project, priceLevels, cascades),
      style: filterSourceLabel(line.style, pa.style, project?.defaultstyle, "Style"),
      colour: filterSourceLabel(line.colour, pa.colour, project?.defaultcolour, "Colour"),
    },
    quoteObject: {
      id: quoteObject?.id ?? null,
      objectid: quoteObject?.objectid ?? line.objectid ?? null,
      category,
      objectname: productType,
      uom: String(quoteObject?.uom ?? "").trim(),
    },
    catalogStats: {
      totalLoaded: catalogSkus.length,
      currentCount,
      baseProductKeyCount,
    },
    pipeline: emptyPipeline,
    catalogMatchSkuIds: [] as string[],
    pickCount: 0,
    lockFilteredOut: false,
  };

  if (!quoteObject) {
    return {
      ...baseDiagnostic,
      summary: "Quote object not found for this line (missing or wrong objectid / scope attachment).",
      failureKind: "missing_quote_object",
    };
  }

  if (!category || !productType) {
    const missing: string[] = [];
    if (!category) missing.push("category");
    if (!productType) missing.push("objectname (product type)");
    return {
      ...baseDiagnostic,
      summary: `Quote object is missing ${missing.join(" and ")} — SKU query requires both to match data_skus.`,
      failureKind: "missing_quote_fields",
    };
  }

  if (baseProductKeyCount === 0) {
    const pipeline = dataSkuFilterPipeline(catalogSkus, query, filterOptions);
    return {
      ...baseDiagnostic,
      pipeline,
      summary: `No current data_skus rows with category "${category}" and productType "${productType}".`,
      failureKind: "no_catalog_rows",
    };
  }

  let catalogMatches = matchingSkusForScopeLine(
    catalogSkus,
    quoteObject,
    {
      elevateLevel,
      style,
      colour,
    },
    skuMatchOptions,
  );
  const pipeline = dataSkuFilterPipeline(catalogSkus, query, filterOptions);

  let lockFilteredOut = false;
  if (locked) {
    const before = catalogMatches.length;
    catalogMatches = catalogMatches.filter((m) => m.skuId === locked);
    lockFilteredOut = before > 0 && catalogMatches.length === 0;
  }

  const picks = buildScopeLineSkuPicks(
    catalogMatches,
    suppliersBySkuId,
    false,
    line,
  );

  if (lockFilteredOut) {
    return {
      ...baseDiagnostic,
      pipeline,
      catalogMatchSkuIds: matchingSkusForScopeLine(
        catalogSkus,
        quoteObject,
        {
          elevateLevel,
          style,
          colour,
        },
        skuMatchOptions,
      ).map((s) => s.skuId),
      pickCount: 0,
      lockFilteredOut: true,
      summary: `Show All lock requires SKU "${locked}" but filters matched other SKU(s) only.`,
      failureKind: "lock_to_sku",
    };
  }

  if (catalogMatches.length === 0) {
    const failedStep = [...pipeline].reverse().find((s) => s.countOut === 0 && s.countIn > 0);
    const stepHint = failedStep
      ? ` Failed at ${failedStep.label}${failedStep.filterOpen ? " (open)" : `: filter "${failedStep.filterValue}"`}.`
      : "";
    return {
      ...baseDiagnostic,
      pipeline,
      catalogMatchSkuIds: [],
      pickCount: 0,
      lockFilteredOut: false,
      summary: `${baseProductKeyCount} catalog row(s) match category + product type, but 0 after tier/style/colour filters.${stepHint}`,
      failureKind: "filter_no_match",
    };
  }

  if (picks.length === 0) {
    return {
      ...baseDiagnostic,
      pipeline,
      catalogMatchSkuIds: catalogMatches.map((s) => s.skuId),
      pickCount: 0,
      lockFilteredOut: false,
      summary: `${catalogMatches.length} SKU(s) matched filters but none have a supplier row in data_sku_suppliers (priority 1–10).`,
      failureKind: "no_supplier_rows",
    };
  }

  return {
    ...baseDiagnostic,
    pipeline,
    catalogMatchSkuIds: catalogMatches.map((s) => s.skuId),
    pickCount: picks.length,
    lockFilteredOut: false,
    summary: `${picks.length} pick(s) available — unexpected empty state.`,
    failureKind: "unknown",
  };
}
