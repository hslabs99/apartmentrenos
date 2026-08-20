import type { ScopePublic } from "@/types/scope";

/**
 * When a scope has exactly one answer and its label is "Yes" (case-insensitive),
 * checklist / project areas can show a checkbox instead of a one-option dropdown.
 */
export function singleYesAnswerId(scope: ScopePublic): string | null {
  if (scope.kind === "header" || scope.kind === "footer") return null;
  if (scope.answers.length !== 1) return null;
  const a = scope.answers[0];
  if (!a || a.label.trim().toLowerCase() !== "yes") return null;
  return a.answerid;
}

/**
 * Answer marked Default to true in Setup. Only one answer per scope should have this.
 */
export function defaultTrueAnswerId(scope: ScopePublic): string | null {
  if (scope.kind === "header" || scope.kind === "footer") return null;
  const hit = scope.answers.find((a) => a.defaultToTrue === true);
  return hit?.answerid ?? null;
}
