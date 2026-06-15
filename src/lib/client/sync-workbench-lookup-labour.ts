import { applyLookupLabourToProjectLine } from "@/lib/client/apply-lookup-labour-to-line";
import {
  isLabourLookupManuallyOverridden,
  LOOKUP_LABOUR_SILO_KEYS,
  normalizeLabourHourValue,
  type LabourSiloKey,
} from "@/lib/labour-silo";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";

function lookupHoursEqual(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  return normalizeLabourHourValue(a) === normalizeLabourHourValue(b);
}

/** Patch body for lookup silos when table-derived hours differ from the line. */
export function lookupLabourPatchForLine(
  line: ProjectAreaObjectPublic,
  expected: ProjectAreaObjectPublic,
): Partial<Record<(typeof LOOKUP_LABOUR_SILO_KEYS)[number], number | null>> | null {
  const patch: Partial<Record<(typeof LOOKUP_LABOUR_SILO_KEYS)[number], number | null>> = {};
  let changed = false;
  for (const k of LOOKUP_LABOUR_SILO_KEYS) {
    if (isLabourLookupManuallyOverridden(line.labourLookupManualOverrides, k)) continue;
    if (!lookupHoursEqual(line[k], expected[k])) {
      patch[k] = expected[k];
      changed = true;
    }
  }
  return changed ? patch : null;
}

export function expectedLookupLabourLine(
  line: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  objectLabourRates: DataObjectLabourRatePublic[],
): ProjectAreaObjectPublic {
  const q = quoteObjects.find((qo) => qo.objectid === line.objectid);
  const objectName = q?.objectname?.trim() ?? "";
  return applyLookupLabourToProjectLine(
    line,
    line.custommeasure ?? null,
    objectName,
    objectLabourRates,
    line.customuom,
  );
}

export type LookupLabourLineUpdate = {
  id: string;
  patch: Partial<Record<(typeof LOOKUP_LABOUR_SILO_KEYS)[number], number | null>>;
  expected: ProjectAreaObjectPublic;
};

/** Lines whose lookup silos differ from the current object labour rates table. */
export function lookupLabourUpdatesForLines(
  lines: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
  objectLabourRates: DataObjectLabourRatePublic[],
): LookupLabourLineUpdate[] {
  const updates: LookupLabourLineUpdate[] = [];
  for (const line of lines) {
    const expected = expectedLookupLabourLine(line, quoteObjects, objectLabourRates);
    const patch = lookupLabourPatchForLine(line, expected);
    if (patch) updates.push({ id: line.id, patch, expected });
  }
  return updates;
}

export function mergeLookupLabourIntoLines(
  lines: ProjectAreaObjectPublic[],
  updates: LookupLabourLineUpdate[],
): ProjectAreaObjectPublic[] {
  if (updates.length === 0) return lines;
  const byId = new Map(updates.map((u) => [u.id, u.expected]));
  return lines.map((line) => byId.get(line.id) ?? line);
}

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

/**
 * Persist lookup silo hours from the object labour rates table for workbench lines.
 * Returns the merged line list (optimistic merge + server responses when available).
 */
export async function persistWorkbenchLookupLabour(
  lines: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
  objectLabourRates: DataObjectLabourRatePublic[],
): Promise<ProjectAreaObjectPublic[]> {
  const updates = lookupLabourUpdatesForLines(lines, quoteObjects, objectLabourRates);
  if (updates.length === 0) return lines;

  let merged = mergeLookupLabourIntoLines(lines, updates);

  const results = await Promise.all(
    updates.map(async ({ id, patch }) => {
      const res = await fetch(`/api/projectareaobjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await readApiResponse<{
        projectAreaObject?: ProjectAreaObjectPublic;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to sync labour hours");
      return { id, row: data.projectAreaObject ?? null };
    }),
  );

  for (const { id, row } of results) {
    if (row) merged = merged.map((line) => (line.id === id ? row : line));
  }

  return merged;
}
