/** UOM price, total price, and specs for one System → Price Levels tier. */
export type QuoteObjectPriceLevelRowPublic = {
  pricelevelid: number;
  uomprice: number | null;
  totalprice: number | null;
  spec1: string;
  spec2: string;
  spec3: string;
};

export const QUOTE_OBJECT_INHERIT_M2_SOURCES = [
  "none",
  "apartment_total_m2",
  "apartment_soft_m2",
  "apartment_hard_m2",
  "area_m2",
] as const;
export type QuoteObjectInheritM2Source = (typeof QUOTE_OBJECT_INHERIT_M2_SOURCES)[number];

export const QUOTE_OBJECT_INHERIT_M2_LABELS: Record<QuoteObjectInheritM2Source, string> = {
  none: "None (use default measurement)",
  apartment_total_m2: "Apartment m² (project total)",
  apartment_soft_m2: "Apartment M2 (Soft Floor)",
  apartment_hard_m2: "Apartment M2 (Hard Floor)",
  area_m2: "Area m² (room)",
};

export type QuoteObjectPublic = {
  id: string;
  sortOrder?: number | null;
  objectid?: number | null;
  objectname: string;
  /** Product line text; legacy Firestore used `description`. */
  product: string;
  objecttype: string;
  /** Display value from System Lookups (`lookuptype` = ObjectCategory). */
  category: string;
  /**
   * Setup → Areas template document IDs. Tags this quote object to one or more areas
   * (e.g. Kitchen, Bathroom) for filtering and reporting.
   */
  areaTagIds: string[];
  uom: string;
  /**
   * When set and UOM is M2, new checklist/quote lines can use a project/apartment or area M2
   * as measurement instead of the default template `measurement`. Ignored for other UOMs.
   */
  inheritM2Source?: QuoteObjectInheritM2Source;
  /** Legacy boolean (kept for backwards compatibility); prefer `inheritM2Source`. */
  inheritAreaM2?: boolean;
  /**
   * Carpet roll width (m) for UOM `LM-Runs`: lineal metres ≈ ceil(√areaM² / runWidth) × √areaM²
   * when checklist area m² is set; otherwise template `measurement` (LM), often derived from
   * `defaultAreaM2` and this width in Setup.
   */
  runWidth?: number | null;
  /**
   * For UOM `LM-Runs`: nominal room area (m²) used in Setup to derive `measurement` (LM) from
   * run width; on the checklist, checklist `aream2` replaces this for the same formula.
   */
  defaultAreaM2?: number | null;
  measurement?: number | null;
  /**
   * Denormalized from the lowest price-level row that has data (for seeding / legacy UIs).
   * Prefer `priceLevelRows` when editing tiers.
   */
  uomprice?: number | null;
  totalprice?: number | null;
  spec1: string;
  spec2: string;
  spec3: string;
  /** Per price level; sparse in Firestore (omitted tiers = no override). */
  priceLevelRows: QuoteObjectPriceLevelRowPublic[];
  /** Template labour hours (not from object labour rates). */
  generalHours?: number | null;
  projectManagerHours?: number | null;
  paintingHours?: number | null;
  plasteringHours?: number | null;
  notes1: string;
  notes2: string;
  /** Guidance for measure/UOM on checklist (used when no area-object tool tip applies). */
  tooltip: string;
  /**
   * When set (e.g. `"Blinds"`), scope/quote SKU resolution can treat this template as a
   * non-catalog object. Stored as Firestore `systemObject`.
   */
  systemObject?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
