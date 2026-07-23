import {
  isQuoteObjectInheritM2Source,
  normalizeQuoteObjectInheritM2Source,
} from "@/lib/inherit-m2-source";
import { isInheritMeasureSource, isScopeMetricInheritSource, parseScopeMetricInheritId } from "@/lib/scope-metrics";
import type { InheritMeasureSource } from "@/types/scope-metric";
import type { QuoteObjectPublic } from "@/types/quote-object";
import {
  parseScopeToolType,
  type ScopeToolType,
} from "@/lib/scope-tools";import {
  isSystemScopeObjectId,
  systemScopeObjectLabel,
} from "@/lib/system-scope-types";
import type { ScopeAnswerPublic, ScopeShowAllDefaultQty } from "@/types/scope";
import { parseScopeShowAllDefaultQty } from "@/types/scope";

export type ScopeFormDraftAnswer = {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
  attachedObjectTools: Partial<Record<string, ScopeToolType>>;
  attachedObjectShowAll: Partial<Record<string, boolean>>;
  attachedObjectShowAllDefault: Partial<Record<string, ScopeShowAllDefaultQty>>;
  attachedObjectNoCharge: Partial<Record<string, boolean>>;
  attachedObjectForce: Partial<Record<string, boolean>>;
  attachedObjectInheritM2Source: Partial<Record<string, InheritMeasureSource>>;
  attachedObjectInheritMeasureLocked: Partial<Record<string, boolean>>;
  includeOnDemolitionReport: boolean;
};
function normalizeDraftTools(
  raw: Partial<Record<string, ScopeToolType>> | undefined,
  attachedIds: string[],
): Partial<Record<string, ScopeToolType>> {
  if (!raw) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, ScopeToolType>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    const parsed = value ? parseScopeToolType(value) : null;
    if (!id || !allowed.has(id) || !parsed) continue;
    out[id] = parsed;
  }
  return out;
}

function normalizeDraftFlags(
  raw: Partial<Record<string, boolean>> | undefined,
  attachedIds: string[],
): Partial<Record<string, boolean>> {
  if (!raw) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, boolean>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    if (!id || !allowed.has(id) || value !== true) continue;
    out[id] = true;
  }
  return out;
}

function normalizeDraftShowAllDefault(
  raw: Partial<Record<string, ScopeShowAllDefaultQty>> | undefined,
  attachedIds: string[],
  showAll: Partial<Record<string, boolean>>,
): Partial<Record<string, ScopeShowAllDefaultQty>> {
  if (!raw) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, ScopeShowAllDefaultQty>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    const parsed = parseScopeShowAllDefaultQty(value);
    if (!id || !allowed.has(id) || !showAll[id] || parsed == null) continue;
    out[id] = parsed;
  }
  return out;
}

function normalizeDraftInheritM2Sources(
  raw: Partial<Record<string, InheritMeasureSource>> | undefined,
  attachedIds: string[],
  quoteById: Map<string, QuoteObjectPublic>,
): Partial<Record<string, InheritMeasureSource>> {
  if (!raw) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, InheritMeasureSource>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    if (!id || !allowed.has(id) || !isInheritMeasureSource(value)) continue;
    if (parseScopeMetricInheritId(value)) {
      out[id] = value;
      continue;
    }
    if (!isQuoteObjectInheritM2Source(value)) continue;
    const q = quoteById.get(id);
    const objectDefault = normalizeQuoteObjectInheritM2Source(q);
    if (value === objectDefault) continue;
    out[id] = value;
  }
  return out;
}

function normalizeDraftInheritMeasureLocked(
  raw: Partial<Record<string, boolean>> | undefined,
  attachedIds: string[],
  inheritSources: Partial<Record<string, InheritMeasureSource>>,
  quoteById: Map<string, QuoteObjectPublic>,
): Partial<Record<string, boolean>> {
  if (!raw) return {};
  const allowed = new Set(attachedIds);
  const out: Partial<Record<string, boolean>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim();
    if (!id || !allowed.has(id) || value !== false) continue;
    const stored = inheritSources[id];
    const inheritSource =
      stored ??
      normalizeQuoteObjectInheritM2Source(quoteById.get(id));
    if (isScopeMetricInheritSource(inheritSource)) out[id] = false;
  }
  return out;
}

export function publicAnswersToDraft(
  answers: ScopeAnswerPublic[],
  quoteById: Map<string, QuoteObjectPublic>,
): ScopeFormDraftAnswer[] {
  return answers.map((a) => {
    let ids = [...(a.attachedQuoteObjectIds ?? [])];
    if (ids.length === 0 && (a.attachedObjectNames?.length ?? 0) > 0) {
      const names = new Set(
        a.attachedObjectNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
      );
      for (const q of quoteById.values()) {
        const n = q.objectname.trim().toLowerCase();
        if (n && names.has(n)) ids.push(q.id);
      }
      for (const name of a.attachedObjectNames ?? []) {
        const trimmed = name.trim();
        if (isSystemScopeObjectId(trimmed)) ids.push(trimmed);
      }
      ids = [...new Set(ids)];
    }
    return {
      answerid: a.answerid,
      label: a.label,
      attachedQuoteObjectIds: ids,
      attachedObjectTools: normalizeDraftTools(a.attachedObjectTools, ids),
      attachedObjectShowAll: normalizeDraftFlags(a.attachedObjectShowAll, ids),
      attachedObjectShowAllDefault: normalizeDraftShowAllDefault(
        a.attachedObjectShowAllDefault,
        ids,
        normalizeDraftFlags(a.attachedObjectShowAll, ids),
      ),
      attachedObjectNoCharge: normalizeDraftFlags(a.attachedObjectNoCharge, ids),
      attachedObjectForce: normalizeDraftFlags(a.attachedObjectForce, ids),
      attachedObjectInheritM2Source: normalizeDraftInheritM2Sources(
        a.attachedObjectInheritM2Source,
        ids,
        quoteById,
      ),
      attachedObjectInheritMeasureLocked: normalizeDraftInheritMeasureLocked(
        a.attachedObjectInheritMeasureLocked,
        ids,
        normalizeDraftInheritM2Sources(a.attachedObjectInheritM2Source, ids, quoteById),
        quoteById,
      ),
      includeOnDemolitionReport: a.includeOnDemolitionReport === true,
    };
  });
}

export function draftToPayload(
  answers: ScopeFormDraftAnswer[],
  quoteById: Map<string, QuoteObjectPublic>,
): {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
  attachedObjectNames: string[];
  attachedObjectTools: Record<string, ScopeToolType>;
  attachedObjectShowAll: Record<string, boolean>;
  attachedObjectShowAllDefault: Record<string, ScopeShowAllDefaultQty>;
  attachedObjectNoCharge: Record<string, boolean>;
  attachedObjectForce: Record<string, boolean>;
  attachedObjectInheritM2Source: Record<string, InheritMeasureSource>;
  attachedObjectInheritMeasureLocked: Record<string, boolean>;
  includeOnDemolitionReport: boolean;
}[] {
  return answers.map((a) => {    const ids = [...new Set(a.attachedQuoteObjectIds.map((id) => id.trim()).filter(Boolean))];
    const attachedObjectTools = normalizeDraftTools(a.attachedObjectTools, ids) as Record<
      string,
      ScopeToolType
    >;
    const attachedObjectShowAll = normalizeDraftFlags(a.attachedObjectShowAll, ids) as Record<
      string,
      boolean
    >;
    const attachedObjectShowAllDefault = normalizeDraftShowAllDefault(
      a.attachedObjectShowAllDefault,
      ids,
      attachedObjectShowAll,
    ) as Record<string, ScopeShowAllDefaultQty>;
    const attachedObjectNoCharge = normalizeDraftFlags(a.attachedObjectNoCharge, ids) as Record<
      string,
      boolean
    >;
    const attachedObjectForce = normalizeDraftFlags(a.attachedObjectForce, ids) as Record<
      string,
      boolean
    >;
    const attachedObjectInheritM2Source = normalizeDraftInheritM2Sources(
      a.attachedObjectInheritM2Source,
      ids,
      quoteById,
    ) as Record<string, InheritMeasureSource>;
    const attachedObjectInheritMeasureLocked = normalizeDraftInheritMeasureLocked(
      a.attachedObjectInheritMeasureLocked,
      ids,
      attachedObjectInheritM2Source,
      quoteById,
    ) as Record<string, boolean>;
    const names: string[] = [];    const seenNames = new Set<string>();
    for (const id of ids) {
      if (isSystemScopeObjectId(id)) {
        const label = systemScopeObjectLabel(id);
        const key = label.toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        names.push(label);
        continue;
      }
      const q = quoteById.get(id);
      const n = q?.objectname.trim();
      if (!n) continue;
      const key = n.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      names.push(n);
    }
    return {
      answerid: a.answerid,
      label: a.label,
      attachedQuoteObjectIds: ids,
      attachedObjectNames: names,
      attachedObjectTools,
      attachedObjectShowAll,
      attachedObjectShowAllDefault,
      attachedObjectNoCharge,
      attachedObjectForce,
      attachedObjectInheritM2Source,
      attachedObjectInheritMeasureLocked,
      includeOnDemolitionReport: a.includeOnDemolitionReport === true,
    };
  });
}
