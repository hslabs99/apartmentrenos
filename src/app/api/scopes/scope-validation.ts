import { isInheritMeasureSource, isScopeMetricInheritSource } from "@/lib/scope-metrics";
import { parseScopeToolType } from "@/lib/scope-tools";
import type { ScopeToolType } from "@/lib/scope-tools";
import type { InheritMeasureSource } from "@/types/scope-metric";
import type { ScopeMetricPublic } from "@/types/scope-metric";
import { MAX_SCOPE_METRICS } from "@/types/scope-metric";
import {
  parseScopeShowAllDefaultQty,
  type ScopeShowAllDefaultQty,
} from "@/types/scope";
import {
  isSystemScopeType,
  normalizeSystemScopeFields,
} from "@/lib/system-scope-types";
import { z } from "zod";

const systemScopeTypeSchema = z.string().min(1).max(64).nullable().optional();
const scopeToolTypeSchema = z.string().min(1).max(64).nullable().optional();

function refineScopeToolFields(
  data: { exposeTool?: boolean; scopeToolType?: string | null },
  ctx: z.RefinementCtx,
  pathPrefix: "" | "scopeToolType" = "",
) {
  if (data.exposeTool === true) {
    const raw = typeof data.scopeToolType === "string" ? data.scopeToolType.trim() : "";
    if (!raw || !parseScopeToolType(raw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a tool",
        path: pathPrefix ? [pathPrefix] : ["scopeToolType"],
      });
    }
  } else if (data.scopeToolType != null && data.scopeToolType !== "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scopeToolType requires exposeTool to be true",
      path: pathPrefix ? [pathPrefix] : ["scopeToolType"],
    });
  }
}

function refineSystemScopeFields(
  data: { systemScope?: boolean; systemScopeType?: string | null },
  ctx: z.RefinementCtx,
  pathPrefix: "" | "systemScopeType" = "",
) {
  if (data.systemScope === true) {
    const raw =
      typeof data.systemScopeType === "string" ? data.systemScopeType.trim() : "";
    if (!raw || !isSystemScopeType(raw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a system scope type",
        path: pathPrefix ? [pathPrefix] : ["systemScopeType"],
      });
    }
  } else if (data.systemScopeType != null && data.systemScopeType !== "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "systemScopeType requires systemScope to be true",
      path: pathPrefix ? [pathPrefix] : ["systemScopeType"],
    });
  }
}

export { normalizeSystemScopeFields };

function refineAtMostOneDefaultToTrue(
  answers: { defaultToTrue?: boolean }[] | undefined,
  ctx: z.RefinementCtx,
) {
  if (!answers?.length) return;
  const indexes = answers
    .map((a, i) => (a.defaultToTrue === true ? i : -1))
    .filter((i) => i >= 0);
  if (indexes.length <= 1) return;
  for (const i of indexes.slice(1)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only one answer can be Default to true",
      path: ["answers", i, "defaultToTrue"],
    });
  }
}

export const scopeAnswerSchema = z.object({
  answerid: z.string().uuid(),
  label: z.string().min(1).max(200),
  attachedQuoteObjectIds: z.array(z.string().min(1).max(128)).optional().default([]),
  attachedObjectNames: z.array(z.string().min(1).max(255)).optional().default([]),
  attachedCategories: z.array(z.string().min(1).max(120)).optional().default([]),
  attachedObjectTools: z.record(z.string().min(1).max(128), z.string().min(1).max(64)).optional(),
  attachedObjectShowAll: z.record(z.string().min(1).max(128), z.boolean()).optional(),
  attachedObjectShowAllDefault: z
    .record(z.string().min(1).max(128), z.union([z.number(), z.enum(["one", "zero"])]))
    .optional(),
  attachedObjectNoCharge: z.record(z.string().min(1).max(128), z.boolean()).optional(),
  attachedObjectForce: z.record(z.string().min(1).max(128), z.boolean()).optional(),
  attachedObjectInheritM2Source: z
    .record(z.string().min(1).max(128), z.string().min(1).max(128))
    .optional(),
  attachedObjectInheritMeasureLocked: z
    .record(z.string().min(1).max(128), z.boolean())
    .optional(),
  includeOnDemolitionReport: z.boolean().optional(),
  defaultToTrue: z.boolean().optional(),
  suppressZeroSkuRows: z.boolean().optional(),
});

export const scopeMetricSchema = z.object({
  metricid: z.string().uuid(),
  label: z.string().min(1).max(120),
  uom: z.string().min(1).max(32),
  answerids: z.array(z.string().uuid()).optional().default([]),
});

export const scopeWriteSchema = z
  .object({
    /** Single template area (required for header/footer; optional for questions if `areaDocIds` or `tagAllAreas`). */
    areaDocId: z.string().min(1).optional(),
    /** Multiple template areas (questions only). Ignored when `tagAllAreas` is true. */
    areaDocIds: z.array(z.string().min(1)).optional(),
    /** Snapshot all current template areas at save time (questions only). */
    tagAllAreas: z.boolean().optional(),
    question: z.string().min(1).max(200),
    /** Optional checklist guidance under the question (question scopes only). */
    explanation: z.string().max(500).optional().nullable(),
    kind: z.enum(["question", "header", "footer"]).optional(),
    answers: z.array(scopeAnswerSchema).optional(),
    scopeMetrics: z.array(scopeMetricSchema).max(MAX_SCOPE_METRICS).optional(),
    /** When creating a section header, also create a paired footer row (default true). */
    pairFooter: z.boolean().optional(),
    /** Optional label stored on the paired footer (default “Footer”). */
    footerQuestion: z.string().min(1).max(200).optional(),
    /** Insert new scope(s) immediately after this document id within the same area (Setup → Scopes). */
    insertAfterScopeDocId: z.string().min(1).optional(),
    systemScope: z.boolean().optional(),
    systemScopeType: systemScopeTypeSchema,
    exposeTool: z.boolean().optional(),
    scopeToolType: scopeToolTypeSchema,
  })
  .superRefine((data, ctx) => {
    refineSystemScopeFields(data, ctx);
    refineScopeToolFields(data, ctx);
    refineAtMostOneDefaultToTrue(data.answers, ctx);
    const k = data.kind ?? "question";
    const hasSingle = Boolean(data.areaDocId?.trim());
    const hasMulti = (data.areaDocIds?.length ?? 0) > 0;
    const all = data.tagAllAreas === true;
    if (k === "header" || k === "footer") {
      if (!hasSingle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select an area for this section marker",
          path: ["areaDocId"],
        });
      }
      if (all || hasMulti) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Headers and footers apply to one template area only",
          path: ["areaDocIds"],
        });
      }
      if (data.answers != null && data.answers.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Section headers and footers cannot include answers",
          path: ["answers"],
        });
      }
    } else if (!data.answers || data.answers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one answer for a scope question",
        path: ["answers"],
      });
    } else if (!hasSingle && !hasMulti && !all) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select one or more areas, or use “All template areas”",
        path: ["areaDocIds"],
      });
    }
    if (data.kind === "footer" && data.pairFooter !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pairFooter is only used when kind is header",
        path: ["pairFooter"],
      });
    }
    if (data.kind === "footer" && data.footerQuestion !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "footerQuestion is only used when kind is header",
        path: ["footerQuestion"],
      });
    }
  });

export const scopePatchSchema = z
  .object({
    areaDocId: z.string().min(1).optional(),
    areaDocIds: z.array(z.string().min(1)).optional(),
    tagAllAreas: z.boolean().optional(),
    question: z.string().min(1).max(200).optional(),
    explanation: z.string().max(500).optional().nullable(),
    kind: z.enum(["question", "header", "footer"]).optional(),
    answers: z.array(scopeAnswerSchema).optional(),
    scopeMetrics: z.array(scopeMetricSchema).max(MAX_SCOPE_METRICS).optional(),
    systemScope: z.boolean().optional(),
    systemScopeType: systemScopeTypeSchema,
    exposeTool: z.boolean().optional(),
    scopeToolType: scopeToolTypeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.answers !== undefined) {
      refineAtMostOneDefaultToTrue(data.answers, ctx);
    }
    if (data.systemScope !== undefined || data.systemScopeType !== undefined) {
      refineSystemScopeFields(
        {
          systemScope: data.systemScope ?? false,
          systemScopeType: data.systemScopeType ?? null,
        },
        ctx,
      );
    }
    if (data.exposeTool !== undefined || data.scopeToolType !== undefined) {
      refineScopeToolFields(
        {
          exposeTool: data.exposeTool ?? false,
          scopeToolType: data.scopeToolType ?? null,
        },
        ctx,
      );
    }
  });

export type ScopeAnswerInput = z.infer<typeof scopeAnswerSchema>;
export type ScopeWriteInput = z.infer<typeof scopeWriteSchema>;

function normalizeCategoryList(categories: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of categories) {
    const c = raw.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function normalizeIdList(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeObjectNameList(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function normalizeAttachedObjectTools(
  raw: Record<string, string> | undefined,
  attachedIds: string[],
): Record<string, ScopeToolType> {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set(attachedIds);
  const out: Record<string, ScopeToolType> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    const tool = typeof value === "string" ? value.trim() : "";
    const parsed = tool ? parseScopeToolType(tool) : null;
    if (!id || !allowed.has(id) || !parsed) continue;
    out[id] = parsed;
  }
  return out;
}

function normalizeAttachedObjectFlags(
  raw: Record<string, boolean> | undefined,
  attachedIds: string[],
): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set(attachedIds);
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    if (!id || !allowed.has(id) || value !== true) continue;
    out[id] = true;
  }
  return out;
}

function normalizeAttachedObjectShowAllDefault(
  raw: Record<string, unknown> | undefined,
  attachedIds: string[],
  showAll: Record<string, boolean>,
): Record<string, ScopeShowAllDefaultQty> {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set(attachedIds);
  const out: Record<string, ScopeShowAllDefaultQty> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    const parsed = parseScopeShowAllDefaultQty(value);
    if (!id || !allowed.has(id) || !showAll[id] || parsed == null) continue;
    out[id] = parsed;
  }
  return out;
}

function normalizeAttachedObjectInheritM2Sources(
  raw: Record<string, string> | undefined,
  attachedIds: string[],
): Record<string, InheritMeasureSource> {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set(attachedIds);
  const out: Record<string, InheritMeasureSource> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    const src = typeof value === "string" ? value.trim() : "";
    if (!id || !allowed.has(id) || !isInheritMeasureSource(src)) continue;
    out[id] = src;
  }
  return out;
}

function normalizeAttachedObjectInheritMeasureLocked(
  raw: Record<string, boolean> | undefined,
  attachedIds: string[],
  inheritSources: Record<string, InheritMeasureSource>,
): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set(attachedIds);
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    if (!id || !allowed.has(id) || value !== false) continue;
    const inherit = inheritSources[id];
    if (inherit && isScopeMetricInheritSource(inherit)) out[id] = false;
  }
  return out;
}

export function normalizeScopeMetrics(
  raw: z.infer<typeof scopeMetricSchema>[] | undefined,
  answerIds: Set<string>,
): ScopeMetricPublic[] {
  if (!raw?.length) return [];
  const out: ScopeMetricPublic[] = [];
  const seen = new Set<string>();
  for (const m of raw.slice(0, MAX_SCOPE_METRICS)) {
    const metricid = m.metricid.trim();
    const label = m.label.trim();
    const uom = m.uom.trim();
    if (!metricid || !label || !uom || seen.has(metricid)) continue;
    seen.add(metricid);
    const answerids = [...new Set((m.answerids ?? []).map((id) => id.trim()).filter(Boolean))].filter(
      (id) => answerIds.has(id),
    );
    out.push({ metricid, label, uom, answerids });
  }
  return out;
}

export function normalizeScopeAnswers(answers: ScopeAnswerInput[]): {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
  attachedObjectNames: string[];
  attachedCategories: string[];
  attachedObjectTools: Record<string, ScopeToolType>;
  attachedObjectShowAll: Record<string, boolean>;
  attachedObjectShowAllDefault: Record<string, ScopeShowAllDefaultQty>;
  attachedObjectNoCharge: Record<string, boolean>;
  attachedObjectForce: Record<string, boolean>;
  attachedObjectInheritM2Source: Record<string, InheritMeasureSource>;
  attachedObjectInheritMeasureLocked: Record<string, boolean>;
  includeOnDemolitionReport: boolean;
  defaultToTrue: boolean;
  suppressZeroSkuRows: boolean;
}[] {
  const defaultTrueId = answers.find((a) => a.defaultToTrue === true)?.answerid ?? null;
  return answers.map((a) => {
    const attachedQuoteObjectIds = normalizeIdList(a.attachedQuoteObjectIds ?? []);
    const attachedObjectTools = normalizeAttachedObjectTools(
      a.attachedObjectTools,
      attachedQuoteObjectIds,
    );
    const attachedObjectShowAll = normalizeAttachedObjectFlags(
      a.attachedObjectShowAll,
      attachedQuoteObjectIds,
    );
    const attachedObjectShowAllDefault = normalizeAttachedObjectShowAllDefault(
      a.attachedObjectShowAllDefault,
      attachedQuoteObjectIds,
      attachedObjectShowAll,
    );
    const attachedObjectNoCharge = normalizeAttachedObjectFlags(
      a.attachedObjectNoCharge,
      attachedQuoteObjectIds,
    );
    const attachedObjectForce = normalizeAttachedObjectFlags(
      a.attachedObjectForce,
      attachedQuoteObjectIds,
    );
    const attachedObjectInheritM2Source = normalizeAttachedObjectInheritM2Sources(
      a.attachedObjectInheritM2Source,
      attachedQuoteObjectIds,
    );
    const attachedObjectInheritMeasureLocked = normalizeAttachedObjectInheritMeasureLocked(
      a.attachedObjectInheritMeasureLocked,
      attachedQuoteObjectIds,
      attachedObjectInheritM2Source,
    );
    return {
      answerid: a.answerid,
      label: a.label,
      attachedQuoteObjectIds,
      attachedObjectNames: normalizeObjectNameList(a.attachedObjectNames ?? []),
      attachedCategories: normalizeCategoryList(a.attachedCategories ?? []),
      attachedObjectTools,
      attachedObjectShowAll,
      attachedObjectShowAllDefault,
      attachedObjectNoCharge,
      attachedObjectForce,
      attachedObjectInheritM2Source,
      attachedObjectInheritMeasureLocked,
      includeOnDemolitionReport: a.includeOnDemolitionReport === true,
      defaultToTrue: defaultTrueId != null && a.answerid === defaultTrueId,
      suppressZeroSkuRows: a.suppressZeroSkuRows === true,
    };
  });
}
