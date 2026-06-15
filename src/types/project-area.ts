import type { ProjectAreaScopeMetricValuePublic } from "@/types/scope-metric";
import type { ScopeToolBenchSection } from "@/lib/scope-tools";

/** Checklist / workbench area completion state. */
export type ProjectAreaStatus = "completed" | "escalated";

/** Saved choice for a Setup → Scopes question on this project area. */
export type ProjectAreaScopeAnswerPublic = {
  scopeDocId: string;
  answerid: string;
  /** When set, a cloned copy of the same scope question on this project area. */
  scopeInstanceId?: string | null;
};

export type ProjectAreaPublic = {
  id: string;
  projectid: number;
  areaid: number;
  /**
   * Optional label for this instance (e.g. "Master bedroom"). When empty, the Setup → Areas
   * template name is shown.
   */
  displayName?: string | null;
  /** Copied from template area at add time; drives list order with Setup → Areas. */
  sortOrder?: number | null;
  areanotes1: string;
  areanotes2: string;
  /** Completed or escalated; unset when the area has no status. */
  areaStatus?: ProjectAreaStatus | null;
  aream2?: number | null;
  /** Saved floor-area calculator sections (mm rectangles) for this area. */
  aream2calcsections?: ScopeToolBenchSection[] | null;
  /** Optional override of project ceiling height (m); null = use project default. */
  ceilingheightm?: number | null;
  areafinish: string;
  /** Optional override of project default price level for this area (null = use project default). */
  pricelevelid?: number | null;
  /** Optional override of project default Style for this area (null = use project default). */
  style?: string | null;
  /** Optional override of project default Colour for this area (null = use project default). */
  colour?: string | null;
  /** User’s scope answers; lines are materialized separately via scope-answer API. */
  scopeAnswers?: ProjectAreaScopeAnswerPublic[];
  /** User-entered scope metric values (keyed by scope + instance + metric). */
  scopeMetricValues?: ProjectAreaScopeMetricValuePublic[];
  /**
   * Optional Setup → Scopes document ids to include on this project area only (in addition to
   * scopes tagged for the template area). Lets users pull in extra questions on the checklist.
   */
  extraScopeDocIds?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
};
