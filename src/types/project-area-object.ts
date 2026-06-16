import type { LabourLookupManualOverrides } from "@/lib/labour-silo";
import type { ScopeToolBenchSection, ScopeToolWallMm } from "@/lib/scope-tools";

export type ProjectAreaObjectLineSource = "default" | "scope" | "manual" | "manual2" | "bundled";

/** Built-in system object lines (not catalog quote_objects). */
export type ProjectAreaObjectSystemKind = "blinds";

export type ProjectAreaObjectPublic = {
  id: string;
  projectid: number;
  /** Firestore doc id of the parent row in `projectareas` (scopes lines to one area instance). */
  projectAreaDocId?: string | null;
  objectid: number;
  /** Explicit display order within `projectAreaDocId` (10, 20, 30…). Legacy rows omit this. */
  lineSortOrder?: number | null;
  /** Workbench: this manual line was inserted directly below another line (display grouping). */
  insertedAfterLineId?: string | null;
  /** Quote object display name at line creation (kept when Setup object is removed). */
  objectname?: string | null;
  areaid: number;
  /** How the line was created (legacy rows treated as default). */
  linesource?: ProjectAreaObjectLineSource;
  /** Present when linesource === "scope". */
  scopeDocId?: string | null;
  /** Cloned scope instance on this project area (primary instance omits this field). */
  scopeInstanceId?: string | null;
  /** System pathway (e.g. blinds matrix pricing) — not a quote_objects row. */
  systemObjectKind?: ProjectAreaObjectSystemKind | null;
  /** Blinds style / type (`data_blinds.type`). */
  blindType?: string | null;
  blindDropMm?: number | null;
  blindWidthMm?: number | null;
  /** Generic colour placeholder until supplier colours are wired. */
  blindColour?: string | null;
  /** Parent checklist/workbench line when this row was auto-added from append slots. */
  bundledFromLineId?: string | null;
  /** Append slot (1–3) on the parent SKU when linesource === "bundled". */
  bundledAppendSlot?: 1 | 2 | 3 | null;
  answerid?: string | null;
  scopeid?: number | null;
  /** When false, line is excluded from area/project subtotals (default true for legacy docs). */
  included: boolean;
  /**
   * Optional tier override for template pricing. When null/absent, uses the area’s effective
   * price level (area override or project default).
   */
  pricelevelid?: number | null;
  /** Optional Style override for this line (null/absent uses area/project effective Style). */
  style?: string | null;
  /** Optional Colour override for this line (null/absent uses area/project effective Colour). */
  colour?: string | null;
  /** Resolved from `data_skus` when a scope line is materialized (category + objectname + header filters). */
  skuId?: string | null;
  /** Product name from the matched SKU row. */
  skuProduct?: string | null;
  /** Scope line expanded from Show All — SKU is fixed to one catalog row. */
  scopeShowAllSku?: boolean;
  /** Scope line tagged No Charge in Setup — prices stay at $0. */
  scopeNoCharge?: boolean;
  /** Supplier priority (1–10) used for unit price on this line; default P1 when absent. */
  supplierOption?: number | null;
  /** Free-text supplier on manual lines when not resolved from catalog supplier rows. */
  manualSupplier?: string | null;
  /** Free-text supplier SKU/code on manual lines when not resolved from catalog supplier rows. */
  manualSupplierSku?: string | null;
  dateadded?: string | null;
  custommeasure?: number | null;
  /** M² calculator sections (mm) saved for this scope line. */
  scopeToolBenchSections?: ScopeToolBenchSection[] | null;
  /** Wall calculator inputs (mm) saved for this scope line. */
  scopeToolWallMm?: ScopeToolWallMm | null;
  customuom: string;
  customumprice?: number | null;
  totalprice?: number | null;
  notes1: string;
  notes2: string;
  /** From Setup → Quote Objects; copied onto the line when created; backfilled when empty on read. */
  tooltip: string;
  /** Per-line labour hours (2 decimals). Lookup silos from object labour rates at consumption. */
  constructionAssistantHours: number | null;
  leadContractorHours: number | null;
  electricianHours: number | null;
  plumberHours: number | null;
  generalHours: number | null;
  projectManagerHours: number | null;
  paintingHours: number | null;
  plasteringHours: number | null;
  /** Lookup silos typed over in workbench — preserved when measure/SKU changes. */
  labourLookupManualOverrides?: LabourLookupManualOverrides | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
