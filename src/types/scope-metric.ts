import type { QuoteObjectInheritM2Source } from "@/types/quote-object";

/** Max scope metrics per scope question (checklist row space). */
export const MAX_SCOPE_METRICS = 4;

export const SCOPE_METRIC_INHERIT_PREFIX = "scope_metric:" as const;

/** Template metric defined on a scope — collected on checklist when a tagged answer is chosen. */
export type ScopeMetricPublic = {
  metricid: string;
  label: string;
  uom: string;
  /** Answer ids that show this metric row on the checklist. */
  answerids: string[];
};

/** Inherit measure from quote-object sources or a scope metric. */
export type InheritMeasureSource =
  | QuoteObjectInheritM2Source
  | `${typeof SCOPE_METRIC_INHERIT_PREFIX}${string}`;

/** Saved metric value on a project area scope instance. */
export type ProjectAreaScopeMetricValuePublic = {
  scopeDocId: string;
  scopeInstanceId?: string | null;
  metricid: string;
  value: number | null;
};

/** UOM choices when defining a scope metric in Setup. */
export const SCOPE_METRIC_UOM_OPTIONS = ["M2", "LM-Runs", "LM", "Unit"] as const;
