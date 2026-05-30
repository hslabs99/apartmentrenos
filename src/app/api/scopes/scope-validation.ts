import {
  isSystemScopeType,
  normalizeSystemScopeFields,
} from "@/lib/system-scope-types";
import { z } from "zod";

const systemScopeTypeSchema = z.string().min(1).max(64).nullable().optional();

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

export const scopeAnswerSchema = z.object({
  answerid: z.string().uuid(),
  label: z.string().min(1).max(200),
  attachedQuoteObjectIds: z.array(z.string().min(1).max(128)).optional().default([]),
  attachedObjectNames: z.array(z.string().min(1).max(255)).optional().default([]),
  attachedCategories: z.array(z.string().min(1).max(120)).optional().default([]),
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
    kind: z.enum(["question", "header", "footer"]).optional(),
    answers: z.array(scopeAnswerSchema).optional(),
    /** When creating a section header, also create a paired footer row (default true). */
    pairFooter: z.boolean().optional(),
    /** Optional label stored on the paired footer (default “Footer”). */
    footerQuestion: z.string().min(1).max(200).optional(),
    /** Insert new scope(s) immediately after this document id within the same area (Setup → Scopes). */
    insertAfterScopeDocId: z.string().min(1).optional(),
    systemScope: z.boolean().optional(),
    systemScopeType: systemScopeTypeSchema,
  })
  .superRefine((data, ctx) => {
    refineSystemScopeFields(data, ctx);
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
    kind: z.enum(["question", "header", "footer"]).optional(),
    answers: z.array(scopeAnswerSchema).optional(),
    systemScope: z.boolean().optional(),
    systemScopeType: systemScopeTypeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.systemScope !== undefined || data.systemScopeType !== undefined) {
      refineSystemScopeFields(
        {
          systemScope: data.systemScope ?? false,
          systemScopeType: data.systemScopeType ?? null,
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

export function normalizeScopeAnswers(answers: ScopeAnswerInput[]): {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
  attachedObjectNames: string[];
  attachedCategories: string[];
}[] {
  return answers.map((a) => ({
    answerid: a.answerid,
    label: a.label,
    attachedQuoteObjectIds: normalizeIdList(a.attachedQuoteObjectIds ?? []),
    attachedObjectNames: normalizeObjectNameList(a.attachedObjectNames ?? []),
    attachedCategories: normalizeCategoryList(a.attachedCategories ?? []),
  }));
}
