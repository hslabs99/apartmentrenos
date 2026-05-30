import type { QuoteObjectPublic } from "@/types/quote-object";

export type ScopeAnswerDraft = {
  answerid: string;
  label: string;
  attachObjects: boolean;
};

export function buildScopeAnswersPayload(
  answers: ScopeAnswerDraft[],
  attachQuoteObjectIds: string[],
  quoteById: Map<string, QuoteObjectPublic>,
): {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
  attachedObjectNames: string[];
}[] {
  const ids = [...new Set(attachQuoteObjectIds.map((id) => id.trim()).filter(Boolean))];
  const names: string[] = [];
  const seenNames = new Set<string>();
  for (const id of ids) {
    const q = quoteById.get(id);
    const n = q?.objectname?.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    names.push(n);
  }

  return answers.map((a) => ({
    answerid: a.answerid,
    label: a.label.trim(),
    attachedQuoteObjectIds: a.attachObjects ? ids : [],
    attachedObjectNames: a.attachObjects ? names : [],
  }));
}

export function defaultScopeAnswerDrafts(): ScopeAnswerDraft[] {
  const yesId = crypto.randomUUID();
  return [{ answerid: yesId, label: "Yes", attachObjects: true }];
}

/** One scope answer per quote object; label = object name, each answer attaches one object. */
export function buildScopeAnswersPerObject(
  quoteObjectIds: string[],
  quoteById: Map<string, QuoteObjectPublic>,
): {
  answerid: string;
  label: string;
  attachedQuoteObjectIds: string[];
  attachedObjectNames: string[];
}[] {
  const out: {
    answerid: string;
    label: string;
    attachedQuoteObjectIds: string[];
    attachedObjectNames: string[];
  }[] = [];

  for (const id of quoteObjectIds) {
    const trimmed = id.trim();
    if (!trimmed) continue;
    const q = quoteById.get(trimmed);
    const name = q?.objectname?.trim() || "Option";
    out.push({
      answerid: crypto.randomUUID(),
      label: name,
      attachedQuoteObjectIds: [trimmed],
      attachedObjectNames: q?.objectname?.trim() ? [q.objectname.trim()] : [],
    });
  }

  return out;
}
