import {
  buildScopeAnswersPayload,
  buildScopeAnswersPerObject,
  type ScopeAnswerDraft,
} from "@/lib/client/build-scope-answers-payload";
import { readApiJson } from "@/lib/client/read-api-json";
import type { ScopeBuilderRow } from "@/lib/client/scope-builder-selection";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

export type CreateScopesMode = "perObject" | "single" | "oneScopeAnswersPerObject";

export type CreateScopesFromSelectionInput = {
  selectionRows: ScopeBuilderRow[];
  quoteObjects: QuoteObjectPublic[];
  mode: CreateScopesMode;
  areaDocIds: string[];
  customQuestion: string;
  answers: ScopeAnswerDraft[];
};

export type CreateScopesFromDataObjectsResult = {
  created: number;
  failed: number;
  errors: string[];
  scopes: ScopePublic[];
};

/** @deprecated Use CreateScopesFromSelectionInput */
export type CreateScopesFromDataObjectsInput = CreateScopesFromSelectionInput;

export function validateCreateScopesInput(
  input: CreateScopesFromSelectionInput,
): string | null {
  if (input.selectionRows.length === 0) return "Select at least one row.";
  for (const row of input.selectionRows) {
    if (!row.quoteObjectDocId.trim()) {
      return `“${row.displayLabel}” has no quote object.`;
    }
  }
  if (input.areaDocIds.length === 0) return "Select at least one template area.";
  if (input.mode === "oneScopeAnswersPerObject") {
    const q = input.customQuestion.trim();
    if (!q) return "Enter a question for the scope.";
    if (q.length > 200) return "Question must be 200 characters or less.";
    return null;
  }
  const validAnswers = input.answers.filter((a) => a.label.trim());
  if (validAnswers.length === 0) return "Add at least one answer.";
  const attachCount = validAnswers.filter((a) => a.attachObjects).length;
  if (attachCount !== 1) return "Choose exactly one answer for object attachment.";
  if (input.mode === "single") {
    const q = input.customQuestion.trim();
    if (!q) return "Enter a question for the scope.";
    if (q.length > 200) return "Question must be 200 characters or less.";
  } else if (input.selectionRows.length > 1) {
    for (const row of input.selectionRows) {
      const pt = row.perObjectQuestion.trim();
      if (!pt) return "Each selected row needs a name for the scope question.";
      if (pt.length > 200) {
        return `Name is too long for a scope question: ${pt.slice(0, 40)}…`;
      }
    }
  }
  return null;
}

export async function createScopesFromSelection(
  input: CreateScopesFromSelectionInput,
  onProgress?: (done: number, total: number) => void,
): Promise<CreateScopesFromDataObjectsResult> {
  const validationError = validateCreateScopesInput(input);
  if (validationError) throw new Error(validationError);

  const quoteById = new Map(input.quoteObjects.map((q) => [q.id, q]));
  const validAnswers = input.answers.filter((a) => a.label.trim());
  const createdScopes: ScopePublic[] = [];
  let failed = 0;
  const errors: string[] = [];

  if (input.mode === "oneScopeAnswersPerObject") {
    const quoteIds = input.selectionRows.map((r) => r.quoteObjectDocId);
    const payload = {
      areaDocIds: input.areaDocIds,
      question: input.customQuestion.trim(),
      answers: buildScopeAnswersPerObject(quoteIds, quoteById),
    };
    onProgress?.(0, 1);
    try {
      const res = await fetch("/api/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<{ scope?: ScopePublic; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to create scope");
      if (data.scope) createdScopes.push(data.scope);
      onProgress?.(1, 1);
    } catch (e) {
      failed += 1;
      errors.push(e instanceof Error ? e.message : "Failed to create scope");
      onProgress?.(1, 1);
    }
    return { created: createdScopes.length, failed, errors, scopes: createdScopes };
  }

  if (input.mode === "single") {
    const quoteIds = input.selectionRows.map((r) => r.quoteObjectDocId);
    const payload = {
      areaDocIds: input.areaDocIds,
      question: input.customQuestion.trim(),
      answers: buildScopeAnswersPayload(validAnswers, quoteIds, quoteById),
    };
    onProgress?.(0, 1);
    try {
      const res = await fetch("/api/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<{ scope?: ScopePublic; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to create scope");
      if (data.scope) createdScopes.push(data.scope);
      onProgress?.(1, 1);
    } catch (e) {
      failed += 1;
      errors.push(e instanceof Error ? e.message : "Failed to create scope");
      onProgress?.(1, 1);
    }
    return { created: createdScopes.length, failed, errors, scopes: createdScopes };
  }

  const total = input.selectionRows.length;
  for (let i = 0; i < input.selectionRows.length; i++) {
    const row = input.selectionRows[i]!;
    const payload = {
      areaDocIds: input.areaDocIds,
      question: row.perObjectQuestion.trim(),
      answers: buildScopeAnswersPayload(validAnswers, [row.quoteObjectDocId], quoteById),
    };
    try {
      const res = await fetch("/api/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson<{ scope?: ScopePublic; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to create scope");
      if (data.scope) createdScopes.push(data.scope);
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : "Failed";
      if (errors.length < 5) {
        errors.push(`${row.displayLabel}: ${msg}`);
      }
    }
    onProgress?.(i + 1, total);
  }

  return {
    created: createdScopes.length,
    failed,
    errors,
    scopes: createdScopes,
  };
}

/** @deprecated Use createScopesFromSelection */
export const createScopesFromDataObjects = createScopesFromSelection;
