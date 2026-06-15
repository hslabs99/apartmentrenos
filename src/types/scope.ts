import type { ScopeToolType } from "@/lib/scope-tools";
import type { SystemScopeType } from "@/lib/system-scope-types";
import type { InheritMeasureSource } from "@/types/scope-metric";
import type { ScopeMetricPublic } from "@/types/scope-metric";

export type { ScopeToolType, SystemScopeType };

/** One answer option for a scope question; stable answerid for downstream use. */
export type ScopeAnswerPublic = {
  answerid: string;
  label: string;
  /**
   * Firestore `quote_objects` document ids — preferred; each selected row is attached explicitly.
   * Synthetic system objects use ids like `System:Blinds` (see system-scope-types).
   */
  attachedQuoteObjectIds: string[];
  /**
   * Quote object `objectname` values (legacy / denormalized). Runtime prefers `attachedQuoteObjectIds`.
   */
  attachedObjectNames: string[];
  /**
   * @deprecated Prefer `attachedObjectNames`. Legacy: ObjectCategory lookup values.
   */
  attachedCategories: string[];
  /**
   * Optional calculator per attached quote object (`attachedQuoteObjectIds` keys).
   * Values are `ScopeToolType` keys (e.g. BenchtopM2).
   */
  attachedObjectTools?: Partial<Record<string, ScopeToolType>>;
  /**
   * When true for a quote object id, checklist creates one scope line per matching SKU
   * instead of one line with a multi-SKU dropdown.
   */
  attachedObjectShowAll?: Partial<Record<string, boolean>>;
  /** When true, scope lines for this quote object import with $0 unit and line price. */
  attachedObjectNoCharge?: Partial<Record<string, boolean>>;
  /**
   * When true, the answer is disabled in the checklist unless this quote object has
   * at least one matching SKU at the project/area tier, style, and colour.
   */
  attachedObjectForce?: Partial<Record<string, boolean>>;
  /**
   * Per attached quote object: inherit measure source (apartment/area m² or scope metric).
   * Omitted keys inherit from the quote object template.
   */
  attachedObjectInheritM2Source?: Partial<Record<string, InheritMeasureSource>>;
  /**
   * When inheriting a scope metric: `false` lets checklist users override the default measure.
   * Omitted or `true` keeps the measure locked to the scope metric (default).
   */
  attachedObjectInheritMeasureLocked?: Partial<Record<string, boolean>>;
};

/** `header` / `footer` = section markers only (no answers); `question` = normal scope with answers. */
export type ScopeKind = "question" | "header" | "footer";

export type ScopePublic = {
  id: string;
  scopeid?: number | null;
  kind?: ScopeKind;
  /**
   * Template area document ids this scope appears in (questions may have many; headers/footers exactly one).
   */
  areaDocIds: string[];
  /** Per-template-area display order (Setup / checklist within that area). */
  sortOrderByAreaDocId: Record<string, number>;
  /** Display order — legacy single-area docs; also first area’s order when reading old data. */
  sortOrder?: number | null;
  /** Primary numeric area id (first template area by Setup → Areas order among tags). */
  areaid: number;
  /** Primary area doc id (same as first of `areaDocIds` when non-empty). */
  areaDocId: string;
  /** Primary area name. */
  areaname?: string;
  /** All tagged area names for table display (e.g. "Kitchen, Bathroom"). */
  areaNamesDisplay?: string;
  question: string;
  answers: ScopeAnswerPublic[];
  /** Up to 4 metrics (e.g. Tiled Area m²) shown on checklist when tagged answers are selected. */
  scopeMetrics?: ScopeMetricPublic[];
  /** When true, this scope is tagged for built-in system rules (see `systemScopeType`). */
  systemScope?: boolean;
  /** Rule set key when `systemScope` is true (e.g. Blinds). */
  systemScopeType?: SystemScopeType | null;
  /** When true, checklist shows a calculator tool after the scope is answered. */
  exposeTool?: boolean;
  /** Calculator tool key when `exposeTool` is true. */
  scopeToolType?: ScopeToolType | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
