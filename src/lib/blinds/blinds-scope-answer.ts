import { systemScopeObjectId } from "@/lib/system-scope-types";
import type { ScopeAnswerPublic } from "@/types/scope";

export function scopeAnswerHasSystemBlinds(answer: ScopeAnswerPublic): boolean {
  return (answer.attachedQuoteObjectIds ?? []).some(
    (id) => id.trim() === systemScopeObjectId("Blinds"),
  );
}

export function findScopeAnswer(
  scope: { answers: ScopeAnswerPublic[] },
  answerid: string,
): ScopeAnswerPublic | null {
  return scope.answers.find((a) => a.answerid === answerid) ?? null;
}

export function scopeSelectionUsesSystemBlinds(
  scope: { answers: ScopeAnswerPublic[] },
  answerid: string,
): boolean {
  if (!answerid) return false;
  const answer = findScopeAnswer(scope, answerid);
  return answer != null && scopeAnswerHasSystemBlinds(answer);
}
