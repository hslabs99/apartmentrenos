import type { SystemScopeType } from "@/lib/system-scope-types";

export type { SystemScopeType };

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
  /** When true, this scope is tagged for built-in system rules (see `systemScopeType`). */
  systemScope?: boolean;
  /** Rule set key when `systemScope` is true (e.g. Blinds). */
  systemScopeType?: SystemScopeType | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
