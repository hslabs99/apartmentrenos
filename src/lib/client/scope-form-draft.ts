import {
  isScopeToolType,
  type ScopeToolType,
} from "@/lib/scope-tools";
import {
  isSystemScopeObjectId,
  systemScopeObjectLabel,
} from "@/lib/system-scope-types";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopeAnswerPublic } from "@/types/scope";

export type ScopeFormDraftAnswer = {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
  attachedObjectTools: Partial<Record<string, ScopeToolType>>;
  attachedObjectShowAll: Partial<Record<string, boolean>>;
  attachedObjectNoCharge: Partial<Record<string, boolean>>;
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
    if (!id || !allowed.has(id) || !value || !isScopeToolType(value)) continue;
    out[id] = value;
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
      attachedObjectNoCharge: normalizeDraftFlags(a.attachedObjectNoCharge, ids),
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
  attachedObjectNoCharge: Record<string, boolean>;
}[] {
  return answers.map((a) => {
    const ids = [...new Set(a.attachedQuoteObjectIds.map((id) => id.trim()).filter(Boolean))];
    const attachedObjectTools = normalizeDraftTools(a.attachedObjectTools, ids) as Record<
      string,
      ScopeToolType
    >;
    const attachedObjectShowAll = normalizeDraftFlags(a.attachedObjectShowAll, ids) as Record<
      string,
      boolean
    >;
    const attachedObjectNoCharge = normalizeDraftFlags(a.attachedObjectNoCharge, ids) as Record<
      string,
      boolean
    >;
    const names: string[] = [];
    const seenNames = new Set<string>();
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
      attachedObjectNoCharge,
    };
  });
}
