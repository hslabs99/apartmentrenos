import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

/** Calculator tools attachable to scope questions (Setup → Scopes). */
export const SCOPE_TOOL_TYPES = ["BenchtopM2", "WallM2"] as const;

export type ScopeToolType = (typeof SCOPE_TOOL_TYPES)[number];

export const DEFAULT_SCOPE_TOOL_TYPE: ScopeToolType = "BenchtopM2";

export function isScopeToolType(value: string): value is ScopeToolType {
  return (SCOPE_TOOL_TYPES as readonly string[]).includes(value);
}

export function scopeToolTypeLabel(type: ScopeToolType): string {
  switch (type) {
    case "BenchtopM2":
      return "Benchtop m²";
    case "WallM2":
      return "Wall m²";
    default:
      return type;
  }
}

export function normalizeScopeToolFields(input: {
  exposeTool?: boolean | null;
  scopeToolType?: string | null;
}): { exposeTool: boolean; scopeToolType: ScopeToolType | null } {
  const exposeTool = input.exposeTool === true;
  if (!exposeTool) {
    return { exposeTool: false, scopeToolType: null };
  }
  const raw = typeof input.scopeToolType === "string" ? input.scopeToolType.trim() : "";
  if (isScopeToolType(raw)) {
    return { exposeTool: true, scopeToolType: raw };
  }
  return { exposeTool: true, scopeToolType: DEFAULT_SCOPE_TOOL_TYPE };
}

export function readScopeToolFromFirestore(data: Record<string, unknown>): {
  exposeTool: boolean;
  scopeToolType: ScopeToolType | null;
} {
  return normalizeScopeToolFields({
    exposeTool: data.exposeTool === true,
    scopeToolType: typeof data.scopeToolType === "string" ? data.scopeToolType : null,
  });
}

/** cm × cm → m² */
export function cmRectToM2(lengthCm: number, widthCm: number): number {
  if (!Number.isFinite(lengthCm) || !Number.isFinite(widthCm)) return NaN;
  if (lengthCm < 0 || widthCm < 0) return NaN;
  return (lengthCm * widthCm) / 10_000;
}

/** Single wall: (width1 + width2) × stud height, all in cm → m² */
export function cmWallToM2(width1Cm: number, width2Cm: number, studHeightCm: number): number {
  if (
    !Number.isFinite(width1Cm) ||
    !Number.isFinite(width2Cm) ||
    !Number.isFinite(studHeightCm)
  ) {
    return NaN;
  }
  if (width1Cm < 0 || width2Cm < 0 || studHeightCm < 0) return NaN;
  return ((width1Cm + width2Cm) * studHeightCm) / 10_000;
}

export function roundScopeToolM2(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatScopeToolM2(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${roundScopeToolM2(value)} m²`;
}

/** Calculator configured on a scope answer for a catalog quote object line. */
export function scopeLineAttachedObjectTool(
  answer: { attachedObjectTools?: Partial<Record<string, ScopeToolType>> } | undefined,
  quoteObjectDocId: string | null | undefined,
): ScopeToolType | null {
  if (!answer?.attachedObjectTools || !quoteObjectDocId) return null;
  const raw = answer.attachedObjectTools[quoteObjectDocId];
  return raw && isScopeToolType(raw) ? raw : null;
}

/** Tool attached to this scope line’s quote object on the saved answer. */
export function resolveScopeLineMeasureTool(
  scope: ScopePublic,
  line: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
): ScopeToolType | null {
  if (line.linesource !== "scope" || !line.answerid) return null;
  const answer = scope.answers.find((a) => a.answerid === line.answerid);
  const qo = quoteObjects.find((o) => o.objectid === line.objectid);
  return scopeLineAttachedObjectTool(answer, qo?.id);
}
