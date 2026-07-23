import { applyLookupLabourToProjectLine } from "@/lib/client/apply-lookup-labour-to-line";
import { projectLineObjectLabel } from "@/lib/client/project-line-quote-object";
import {
  isLabourLookupManuallyOverridden,
  LOOKUP_LABOUR_SILO_KEYS,
  normalizeLabourHourValue,
  type LabourLookupManualOverrides,
} from "@/lib/labour-silo";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { QuoteObjectPublic } from "@/types/quote-object";

function lookupHoursEqual(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  return normalizeLabourHourValue(a) === normalizeLabourHourValue(b);
}

/** True when the silo has a stored hour value (including 0). */
function hasStoredLookupHours(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Product type for Object Labour Rates = workbench Description
 * (quote objectname / line snapshot / SKU productType).
 */
export function labourLookupObjectName(
  line: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  catalogSkus?: DataSkuPublic[],
): string {
  const label = projectLineObjectLabel(line, quoteObjects, catalogSkus).trim();
  if (label && !/^Object #\d+$/i.test(label)) return label;
  const q = quoteObjects.find((qo) => qo.objectid === line.objectid);
  return q?.objectname?.trim() || line.objectname?.trim() || "";
}

export type LookupLabourLinePatch = Partial<
  Record<(typeof LOOKUP_LABOUR_SILO_KEYS)[number], number | null>
> & {
  labourLookupManualOverrides?: LabourLookupManualOverrides | null;
};

/**
 * Patch lookup silos from the Object Labour Rates table.
 *
 * Keep a silo as "manual" only when it is overridden AND its hours differ from the
 * table (a real user edit). Override + null (or hours that already match the table)
 * is treated as a stuck flag from the old sync bug — clear it and re-apply type labour.
 */
export function lookupLabourPatchForLine(
  line: ProjectAreaObjectPublic,
  expected: ProjectAreaObjectPublic,
): LookupLabourLinePatch | null {
  const hourPatch: Partial<
    Record<(typeof LOOKUP_LABOUR_SILO_KEYS)[number], number | null>
  > = {};
  const clearOverrideKeys: (typeof LOOKUP_LABOUR_SILO_KEYS)[number][] = [];
  let changed = false;

  for (const k of LOOKUP_LABOUR_SILO_KEYS) {
    const overridden = isLabourLookupManuallyOverridden(
      line.labourLookupManualOverrides,
      k,
    );
    const current = line[k];
    const tableHours = expected[k];

    // Genuine user edit: override on + hours that disagree with the table.
    const keepManual =
      overridden &&
      hasStoredLookupHours(current) &&
      !lookupHoursEqual(current, tableHours);

    if (keepManual) continue;

    if (!lookupHoursEqual(current, tableHours)) {
      hourPatch[k] = tableHours;
      changed = true;
    }
    if (overridden) clearOverrideKeys.push(k);
  }

  if (!changed && clearOverrideKeys.length === 0) return null;

  const patch: LookupLabourLinePatch = { ...hourPatch };
  if (clearOverrideKeys.length > 0) {
    const next: LabourLookupManualOverrides = {
      ...(line.labourLookupManualOverrides ?? {}),
    };
    for (const k of clearOverrideKeys) delete next[k];
    const hasAny = LOOKUP_LABOUR_SILO_KEYS.some((k) => next[k] === true);
    // Always send the field so Firestore deletes the stuck override map when empty.
    patch.labourLookupManualOverrides = hasAny ? next : null;
  }
  return patch;
}

export function expectedLookupLabourLine(
  line: ProjectAreaObjectPublic,
  quoteObjects: QuoteObjectPublic[],
  objectLabourRates: DataObjectLabourRatePublic[],
  catalogSkus?: DataSkuPublic[],
): ProjectAreaObjectPublic {
  const objectName = labourLookupObjectName(line, quoteObjects, catalogSkus);
  // Always compute pure table hours — ignore stuck manual override flags on the line.
  // lookupLabourPatchForLine decides which silos to keep vs re-apply.
  return applyLookupLabourToProjectLine(
    { ...line, labourLookupManualOverrides: null },
    line.custommeasure ?? null,
    objectName,
    objectLabourRates,
    line.customuom,
  );
}

export type LookupLabourLineUpdate = {
  id: string;
  patch: LookupLabourLinePatch;
  expected: ProjectAreaObjectPublic;
};

/** Lines whose lookup silos differ from the current object labour rates table. */
export function lookupLabourUpdatesForLines(
  lines: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
  objectLabourRates: DataObjectLabourRatePublic[],
  catalogSkus?: DataSkuPublic[],
): LookupLabourLineUpdate[] {
  if (objectLabourRates.length === 0) return [];
  const updates: LookupLabourLineUpdate[] = [];
  for (const line of lines) {
    const expected = expectedLookupLabourLine(
      line,
      quoteObjects,
      objectLabourRates,
      catalogSkus,
    );
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
  const byId = new Map(updates.map((u) => [u.id, u]));
  return lines.map((line) => {
    const u = byId.get(line.id);
    if (!u) return line;
    const nextOverrides =
      u.patch.labourLookupManualOverrides !== undefined
        ? u.patch.labourLookupManualOverrides
        : u.expected.labourLookupManualOverrides;
    return {
      ...u.expected,
      ...Object.fromEntries(
        LOOKUP_LABOUR_SILO_KEYS.filter((k) => k in u.patch).map((k) => [k, u.patch[k]]),
      ),
      labourLookupManualOverrides: nextOverrides,
    };
  });
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
 * Product type (= Description); Product only when it matches the line SKU.
 */
export async function persistWorkbenchLookupLabour(
  lines: ProjectAreaObjectPublic[],
  quoteObjects: QuoteObjectPublic[],
  objectLabourRates: DataObjectLabourRatePublic[],
  catalogSkus?: DataSkuPublic[],
): Promise<ProjectAreaObjectPublic[]> {
  const updates = lookupLabourUpdatesForLines(
    lines,
    quoteObjects,
    objectLabourRates,
    catalogSkus,
  );
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
