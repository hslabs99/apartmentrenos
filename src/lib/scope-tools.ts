import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

/** Calculator tools attachable to scope questions (Setup → Scopes). */
export const SCOPE_TOOL_TYPES = ["M2", "WallM2"] as const;

export type ScopeToolType = (typeof SCOPE_TOOL_TYPES)[number];

export const DEFAULT_SCOPE_TOOL_TYPE: ScopeToolType = "M2";

const LEGACY_SCOPE_TOOL_TYPES: Record<string, ScopeToolType> = {
  BenchtopM2: "M2",
};

export function isScopeToolType(value: string): value is ScopeToolType {
  return (SCOPE_TOOL_TYPES as readonly string[]).includes(value);
}

/** Accepts current and legacy stored tool keys; returns the canonical type. */
export function parseScopeToolType(value: string): ScopeToolType | null {
  const trimmed = value.trim();
  if (isScopeToolType(trimmed)) return trimmed;
  return LEGACY_SCOPE_TOOL_TYPES[trimmed] ?? null;
}

export function scopeToolTypeLabel(type: ScopeToolType): string {
  switch (type) {
    case "M2":
      return "M² calculator";
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
  const parsed = raw ? parseScopeToolType(raw) : null;
  if (parsed) {
    return { exposeTool: true, scopeToolType: parsed };
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

/** One rectangular section saved on a scope line (mm). */
export type ScopeToolBenchSection = {
  id: string;
  lengthMm: number;
  widthMm: number;
};

/** Wall calculator inputs saved on a scope line (mm). */
export type ScopeToolWallMm = {
  width1Mm: number;
  width2Mm: number;
  studHeightMm: number;
};

export type ScopeToolApplyPayload = {
  m2: number;
  scopeToolBenchSections?: ScopeToolBenchSection[] | null;
  scopeToolWallMm?: ScopeToolWallMm | null;
};

function positiveMm(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return v;
}

function sectionId(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** mm × mm → m² */
export function mmRectToM2(lengthMm: number, widthMm: number): number {
  if (!Number.isFinite(lengthMm) || !Number.isFinite(widthMm)) return NaN;
  if (lengthMm < 0 || widthMm < 0) return NaN;
  return (lengthMm * widthMm) / 1_000_000;
}

/** Single wall: (width1 + width2) × stud height, all in mm → m² */
export function mmWallToM2(width1Mm: number, width2Mm: number, studHeightMm: number): number {
  if (
    !Number.isFinite(width1Mm) ||
    !Number.isFinite(width2Mm) ||
    !Number.isFinite(studHeightMm)
  ) {
    return NaN;
  }
  if (width1Mm < 0 || width2Mm < 0 || studHeightMm < 0) return NaN;
  return ((width1Mm + width2Mm) * studHeightMm) / 1_000_000;
}

export function benchSectionM2(section: Pick<ScopeToolBenchSection, "lengthMm" | "widthMm">): number {
  return mmRectToM2(section.lengthMm, section.widthMm);
}

export function benchSectionsTotalM2(sections: ScopeToolBenchSection[]): number | null {
  if (sections.length === 0) return null;
  let sum = 0;
  for (const section of sections) {
    const v = benchSectionM2(section);
    if (!Number.isFinite(v)) return null;
    sum += v;
  }
  return sum;
}

export function formatBenchSectionDims(section: Pick<ScopeToolBenchSection, "lengthMm" | "widthMm">): string {
  return `${section.lengthMm} × ${section.widthMm} mm`;
}

export function readScopeToolBenchSections(raw: unknown): ScopeToolBenchSection[] | null {
  if (!Array.isArray(raw)) return null;
  const sections: ScopeToolBenchSection[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const lengthMm = positiveMm(row.lengthMm);
    const widthMm = positiveMm(row.widthMm);
    if (lengthMm == null || widthMm == null) return;
    sections.push({
      id: sectionId(row.id, `section-${index}`),
      lengthMm,
      widthMm,
    });
  });
  return sections.length > 0 ? sections : null;
}

export function readScopeToolWallMm(raw: unknown): ScopeToolWallMm | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const width1Mm = positiveMm(row.width1Mm);
  const width2Mm = positiveMm(row.width2Mm);
  const studHeightMm = positiveMm(row.studHeightMm);
  if (width1Mm == null || width2Mm == null || studHeightMm == null) return null;
  return { width1Mm, width2Mm, studHeightMm };
}

export function newBenchSectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bench-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  return raw ? parseScopeToolType(raw) : null;
}

function quoteObjectLineUom(
  line: Pick<ProjectAreaObjectPublic, "objectid" | "customuom">,
  quoteObjects: QuoteObjectPublic[],
): string {
  const qo = quoteObjects.find((o) => o.objectid === line.objectid);
  return String(qo?.uom ?? line.customuom ?? "").trim();
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
  const attached = scopeLineAttachedObjectTool(answer, qo?.id);
  if (attached) return attached;
  if (quoteObjectLineUom(line, quoteObjects) === "M2") return DEFAULT_SCOPE_TOOL_TYPE;
  return null;
}

/** Checklist line calculator: explicit scope tool, else standard M² calculator for M2 UOM. */
export function resolveLineMeasureTool(
  line: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  scope?: ScopePublic | null,
): ScopeToolType | null {
  if (scope && line.linesource === "scope" && line.answerid) {
    return resolveScopeLineMeasureTool(scope, line, quoteObjects);
  }
  if (quoteObjectLineUom(line, quoteObjects) === "M2") return DEFAULT_SCOPE_TOOL_TYPE;
  return null;
}
