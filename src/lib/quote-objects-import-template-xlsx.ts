import { readApiJson } from "@/lib/client/read-api-json";
import { LOOKUP_TYPE_OBJECT_CATEGORY } from "@/lib/lookup-types";
import { sortPriceLevelsPublic } from "@/lib/sort-price-levels";
import type { AreaPublic } from "@/types/area";
import type { LookupPublic } from "@/types/lookup";
import type { PriceLevelPublic } from "@/types/price-level";

const UOM_OPTIONS = ["Unit", "M2", "M3", "LM", "LM-Runs", "Kg", "Ltr"] as const;

type TemplateFetch = {
  areas: AreaPublic[];
  priceLevels: (PriceLevelPublic & { pricelevelid: number; pricelevel: string })[];
  categories: string[];
};

async function fetchTemplateInputs(): Promise<TemplateFetch> {
  const [areasRes, priceLevelsRes, lookupsRes] = await Promise.all([
    fetch("/api/areas"),
    fetch("/api/price-levels"),
    fetch("/api/lookups"),
  ]);

  const areasData = await readApiJson<{ areas?: AreaPublic[]; error?: string }>(areasRes);
  if (!areasRes.ok) throw new Error(areasData.error ?? "Failed to load areas");

  const plData = await readApiJson<{ priceLevels?: PriceLevelPublic[]; error?: string }>(
    priceLevelsRes,
  );
  if (!priceLevelsRes.ok) throw new Error(plData.error ?? "Failed to load price levels");

  const lookupsData = await readApiJson<{ lookups?: LookupPublic[]; error?: string }>(lookupsRes);
  if (!lookupsRes.ok) throw new Error(lookupsData.error ?? "Failed to load lookups");

  const priceLevels = sortPriceLevelsPublic(plData.priceLevels ?? []).filter(
    (pl): pl is PriceLevelPublic & { pricelevelid: number; pricelevel: string } =>
      typeof pl.pricelevelid === "number" && Number.isInteger(pl.pricelevelid),
  );

  const categories = (lookupsData.lookups ?? [])
    .filter((l) => l.lookuptype === LOOKUP_TYPE_OBJECT_CATEGORY)
    .map((l) => l.lookupvalue)
    .filter((s) => s.trim().length > 0)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const areas = (areasData.areas ?? []).slice().sort((a, b) =>
    a.areaname.localeCompare(b.areaname, undefined, { sensitivity: "base" }),
  );

  return { areas, priceLevels, categories };
}

function listsSheetRows(input: TemplateFetch): (string | number | boolean | null)[][] {
  const maxRows = Math.max(
    UOM_OPTIONS.length,
    input.priceLevels.length,
    input.categories.length,
    input.areas.length,
    2,
  );

  const rows: (string | number | boolean | null)[][] = [];
  rows.push(["UOM", "PriceLevels", "Categories", "Areas", "TRUE/FALSE"]);
  for (let i = 0; i < maxRows; i++) {
    const uom = UOM_OPTIONS[i] ?? "";
    const pl = input.priceLevels[i]
      ? `#${input.priceLevels[i].pricelevelid} ${input.priceLevels[i].pricelevel}`
      : "";
    const cat = input.categories[i] ?? "";
    const area = input.areas[i]?.areaname ?? "";
    const tf = i === 0 ? "TRUE" : i === 1 ? "FALSE" : "";
    rows.push([uom, pl, cat, area, tf]);
  }
  return rows;
}

function dataSheetHeaders(input: TemplateFetch): string[] {
  const base = [
    "ObjectName",
    "Product",
    "ObjectType",
    "Category",
    "AreaTags",
    "UOM",
    "InheritAreaM2",
    "RunWidth",
    "DefaultAreaM2",
    "Measurement",
    "GeneralLoad",
    "PlumbingLoad",
    "ElecLoad",
    "PMLoad",
    "CntrLoad",
    "AssCntrLoad",
    "Notes1",
    "Notes2",
    "Tooltip",
  ];
  const tiers = input.priceLevels.flatMap((pl) => {
    const label = `PL#${pl.pricelevelid} ${pl.pricelevel}`;
    return [
      `${label} UOMPrice`,
      `${label} TotalPrice`,
      `${label} Spec1`,
      `${label} Spec2`,
      `${label} Spec3`,
    ];
  });
  return [...base, ...tiers];
}

function emptyRow(n: number): (string | number | boolean | null)[] {
  return Array.from({ length: n }, () => "");
}

function dataSheetRows(input: TemplateFetch): (string | number | boolean | null)[][] {
  const headers = dataSheetHeaders(input);
  const width = headers.length;

  const instruction1 =
    "Quote Objects Import Template — paste/import starts at row 10. Row 9 is headers. Row 8 is blank. Rows 1–7 are examples + instructions.";
  const instruction2 =
    "AreaTags: comma-separated area names; each must match exactly a value in Lists!D:D. Unknown areas will be ignored by importer (area blank) and logged.";
  const instruction3 =
    "UOM and Category should match the Lists tab values. Numeric fields: blank = null (no value).";
  const instruction4 =
    "Price levels: for each PL, fill UOMPrice/TotalPrice/Spec1-3 as needed. Leave blank for no override.";

  const rows: (string | number | boolean | null)[][] = [];
  rows.push([instruction1, ...emptyRow(width - 1)]);
  rows.push([instruction2, ...emptyRow(width - 1)]);
  rows.push([instruction3, ...emptyRow(width - 1)]);
  rows.push([instruction4, ...emptyRow(width - 1)]);

  // Example rows in rows 5–7 (before headers on row 9)
  const ex1 = emptyRow(width);
  ex1[0] = "Example — Minimal";
  ex1[1] = "Optional product line";
  ex1[2] = "";
  ex1[3] = input.categories[0] ?? "";
  ex1[4] = input.areas.slice(0, 2).map((a) => a.areaname).join(",");
  ex1[5] = "Unit";
  ex1[6] = "FALSE";
  rows.push(ex1);

  const ex2 = emptyRow(width);
  ex2[0] = "Example — M2 inherit";
  ex2[3] = input.categories[1] ?? input.categories[0] ?? "";
  ex2[4] = input.areas[0]?.areaname ?? "";
  ex2[5] = "M2";
  ex2[6] = "TRUE";
  ex2[9] = 1;
  rows.push(ex2);

  const ex3 = emptyRow(width);
  ex3[0] = "Example — LM-Runs";
  ex3[3] = input.categories[2] ?? input.categories[0] ?? "";
  ex3[4] = input.areas[0]?.areaname ?? "";
  ex3[5] = "LM-Runs";
  ex3[6] = "FALSE";
  ex3[7] = 3.2;
  ex3[8] = 25;
  rows.push(ex3);

  // Row 8 blank spacer
  rows.push(emptyRow(width));

  // Row 9 headers
  rows.push(headers);

  // Row 10 first data row (blank)
  rows.push(emptyRow(width));

  return rows;
}

export async function downloadQuoteObjectsImportTemplateXlsx(): Promise<void> {
  const input = await fetchTemplateInputs();
  const XLSX = await import("xlsx");

  const dataWs = XLSX.utils.aoa_to_sheet(dataSheetRows(input));
  const listsWs = XLSX.utils.aoa_to_sheet(listsSheetRows(input));

  // Helpful column widths (approx characters)
  dataWs["!cols"] = dataSheetHeaders(input).map((h) => ({ wch: Math.max(12, Math.min(40, h.length)) }));
  listsWs["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataWs, "Data");
  XLSX.utils.book_append_sheet(wb, listsWs, "Lists");

  XLSX.writeFile(wb, "quote-objects-import-template.xlsx", { bookType: "xlsx" });
}

