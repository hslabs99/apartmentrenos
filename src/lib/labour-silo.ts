/** Eight labour hour silos on quote objects and project lines (all values are hours). */

export const LABOUR_SILO_KEYS = [
  "constructionAssistantHours",
  "leadContractorHours",
  "electricianHours",
  "plumberHours",
  "generalHours",
  "projectManagerHours",
  "paintingHours",
  "plasteringHours",
] as const;

export type LabourSiloKey = (typeof LABOUR_SILO_KEYS)[number];

export type LabourHours = Record<LabourSiloKey, number | null>;

/** Silos populated from `data_objectlabourrates` at project consumption. */
export const LOOKUP_LABOUR_SILO_KEYS = [
  "constructionAssistantHours",
  "leadContractorHours",
  "electricianHours",
  "plumberHours",
] as const satisfies readonly LabourSiloKey[];

/** Silos copied from `quote_objects` only (never from object labour rates). */
export const TEMPLATE_LABOUR_SILO_KEYS = [
  "generalHours",
  "projectManagerHours",
  "paintingHours",
  "plasteringHours",
] as const satisfies readonly LabourSiloKey[];

/** `data_labourrates.product` for Contract labour rows (Hour rates). */
export const LABOUR_SILO_RATE_PRODUCT: Record<LabourSiloKey, string> = {
  constructionAssistantHours: "Construction Assistant",
  leadContractorHours: "Lead Contractor",
  electricianHours: "Electrician",
  plumberHours: "Plumber",
  generalHours: "General",
  projectManagerHours: "Project Manager",
  paintingHours: "Painting",
  plasteringHours: "Plastering",
};

export const LABOUR_RATE_CATEGORY = "Labour";
export const LABOUR_RATE_PRODUCT_TYPE = "Contract labour";

export const WB_LABOUR_SILO_HEADERS: { key: LabourSiloKey; label: string; title: string }[] =
  [
    {
      key: "constructionAssistantHours",
      label: "CA",
      title: "Construction assistant (hours)",
    },
    { key: "leadContractorHours", label: "LC", title: "Lead contractor (hours)" },
    { key: "electricianHours", label: "Elec", title: "Electrician (hours)" },
    { key: "plumberHours", label: "Plumb", title: "Plumber (hours)" },
    { key: "generalHours", label: "Gen", title: "General (hours)" },
    { key: "projectManagerHours", label: "PM", title: "Project manager (hours)" },
    { key: "paintingHours", label: "Paint", title: "Painting (hours)" },
    { key: "plasteringHours", label: "Plast", title: "Plastering (hours)" },
  ];

/** Workbench columns: lookup silos only (Gen/PM/Paint/Plast live on quote objects). */
export const WB_WORKBENCH_LABOUR_SILO_HEADERS = WB_LABOUR_SILO_HEADERS.filter((h) =>
  (LOOKUP_LABOUR_SILO_KEYS as readonly LabourSiloKey[]).includes(h.key),
);

export function emptyLabourHours(): LabourHours {
  return {
    constructionAssistantHours: null,
    leadContractorHours: null,
    electricianHours: null,
    plumberHours: null,
    generalHours: null,
    projectManagerHours: null,
    paintingHours: null,
    plasteringHours: null,
  };
}

export function normalizeLabourHourValue(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

export function formatLabourHours(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export const OBJECT_LABOUR_DUPLICATE_TOOLTIP =
  "Warning: more than one Object Labour Rate row matches this line after Product Type and SKU product rules. The dollar amount uses the first match only.";

export const LABOUR_RATE_MISSING_TOOLTIP =
  "Warning: this line has labour hours but there is no hourly contract rate for this trade in Labour Rates (Import Master Prices → Labour Rates tab). The cost cannot be calculated until a rate exists.";
