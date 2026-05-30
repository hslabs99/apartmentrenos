import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopeAnswerPublic } from "@/types/scope";
import {
  isSystemScopeObjectId,
  systemScopeObjectLabel,
} from "@/lib/system-scope-types";

export type ScopeFormDraftAnswer = {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
};

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
}[] {
  return answers.map((a) => {
    const ids = [...new Set(a.attachedQuoteObjectIds.map((id) => id.trim()).filter(Boolean))];
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
    };
  });
}
