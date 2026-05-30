"use client";

import { ModalFrame } from "@/components/modal-frame";
import {
  defaultScopeAnswerDrafts,
  type ScopeAnswerDraft,
} from "@/lib/client/build-scope-answers-payload";
import {
  createScopesFromSelection,
  validateCreateScopesInput,
  type CreateScopesMode,
} from "@/lib/client/create-scopes-from-data-objects";
import type { ScopeBuilderRow } from "@/lib/client/scope-builder-selection";
import { sfPrimaryToolbarButton } from "@/lib/sf-layout";
import type { AreaPublic } from "@/types/area";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import { useEffect, useMemo, useState } from "react";

const inputClass =
  "min-h-10 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950";

type Props = {
  open: boolean;
  selectionRows: ScopeBuilderRow[];
  quoteObjects: QuoteObjectPublic[];
  areas: AreaPublic[];
  onClose: () => void;
  onCreated: (scopes: ScopePublic[]) => void;
};

export function CreateScopesFromDataObjectsModal({
  open,
  selectionRows,
  quoteObjects,
  areas,
  onClose,
  onCreated,
}: Props) {
  const [mode, setMode] = useState<CreateScopesMode>("perObject");
  const [areaDocIds, setAreaDocIds] = useState<string[]>([]);
  const [areaPickerKey, setAreaPickerKey] = useState(0);
  const [customQuestion, setCustomQuestion] = useState("");
  const [answers, setAnswers] = useState<ScopeAnswerDraft[]>(() => defaultScopeAnswerDrafts());
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = selectionRows.length;

  useEffect(() => {
    if (!open) return;
    setMode(count > 1 ? "oneScopeAnswersPerObject" : "perObject");
    setAreaDocIds([]);
    setAreaPickerKey((k) => k + 1);
    setCustomQuestion("");
    setAnswers(defaultScopeAnswerDrafts());
    setError(null);
    setProgress(null);
  }, [open, count]);

  const areasToAdd = useMemo(
    () => areas.filter((a) => !areaDocIds.includes(a.id)),
    [areas, areaDocIds],
  );

  const preview = useMemo(() => {
    if (mode === "perObject") {
      return `Create ${count} scope(s). Each question is the object name. Objects attach on the flagged answer only.`;
    }
    if (mode === "oneScopeAnswersPerObject") {
      const names = selectionRows.map((r) => r.displayLabel).join(", ");
      return `Create 1 scope with ${count} answer(s) — one per object (${names}).`;
    }
    const names = selectionRows.map((r) => r.displayLabel).join(", ");
    return `Create 1 scope with ${count} object(s) on the flagged answer (${names}).`;
  }, [mode, count, selectionRows]);

  const validationError = useMemo(
    () =>
      validateCreateScopesInput({
        selectionRows,
        quoteObjects,
        mode,
        areaDocIds,
        customQuestion,
        answers,
      }),
    [selectionRows, quoteObjects, mode, areaDocIds, customQuestion, answers],
  );

  const usesCustomQuestion =
    mode === "single" || mode === "oneScopeAnswersPerObject";
  const showYesNoAnswers = mode === "perObject" || mode === "single";

  function setAttachAnswer(answerid: string) {
    setAnswers((prev) =>
      prev.map((a) => ({ ...a, attachObjects: a.answerid === answerid })),
    );
  }

  function updateAnswerLabel(answerid: string, label: string) {
    setAnswers((prev) => prev.map((a) => (a.answerid === answerid ? { ...a, label } : a)));
  }

  function addAnswer() {
    const id = crypto.randomUUID();
    setAnswers((prev) => [
      ...prev,
      { answerid: id, label: `Option ${prev.length + 1}`, attachObjects: false },
    ]);
  }

  function removeAnswer(answerid: string) {
    setAnswers((prev) => {
      const next = prev.filter((a) => a.answerid !== answerid);
      if (next.length === 0) return defaultScopeAnswerDrafts();
      if (!next.some((a) => a.attachObjects)) {
        next[0]!.attachObjects = true;
      }
      return next;
    });
  }

  function removeAreaTag(id: string) {
    setAreaDocIds((prev) => prev.filter((x) => x !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    const total =
      mode === "single" || mode === "oneScopeAnswersPerObject" ? 1 : count;
    setProgress({ done: 0, total });
    try {
      const result = await createScopesFromSelection(
        {
          selectionRows,
          quoteObjects,
          mode,
          areaDocIds,
          customQuestion,
          answers,
        },
        (done, t) => setProgress({ done, total: t }),
      );
      if (result.failed > 0 && result.errors.length) {
        setError(
          `${result.created} created, ${result.failed} failed. ${result.errors.slice(0, 3).join("; ")}`,
        );
      }
      if (result.created > 0) {
        onCreated(result.scopes);
        if (result.failed === 0) onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scopes");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  if (!open) return null;

  return (
    <ModalFrame
      wide
      panelClassName="sm:max-w-2xl"
      title="Create scopes"
      description={`${count} selected object(s).`}
      onClose={saving ? () => {} : onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="min-h-10 rounded-lg border border-sf-border px-4 py-2 text-sm hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-scopes-from-data-objects-form"
            disabled={saving || Boolean(validationError)}
            className={sfPrimaryToolbarButton}
          >
            {saving && progress
              ? `Creating… ${progress.done}/${progress.total}`
              : "Create scopes"}
          </button>
        </div>
      }
    >
      <form
        id="create-scopes-from-data-objects-form"
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5"
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-sf-text dark:text-zinc-200">
            Scope layout
          </legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="scope-layout"
              checked={mode === "perObject"}
              onChange={() => setMode("perObject")}
              disabled={saving}
              className="mt-1"
            />
            <span>
              <span className="font-medium">One scope per object</span>
              <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                Question = object name for each row ({count} scope{count === 1 ? "" : "s"}).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="scope-layout"
              checked={mode === "single"}
              onChange={() => setMode("single")}
              disabled={saving}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Single scope — one answer for all objects</span>
              <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                One question; all selected objects attach to the flagged answer (e.g. benchtop
                bundle).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="scope-layout"
              checked={mode === "oneScopeAnswersPerObject"}
              onChange={() => setMode("oneScopeAnswersPerObject")}
              disabled={saving}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Single scope — one answer per object</span>
              <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                One question (e.g. Blinds); each answer is an object name and attaches that object
                only.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="space-y-2 rounded-lg border border-sf-border bg-sf-page/40 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <span className="block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Template areas
          </span>
          <p className="text-xs text-sf-text-weak dark:text-zinc-400">
            Scope appears in these Setup → Areas (e.g. Kitchen, Bathroom).
          </p>
          {areaDocIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {areaDocIds.map((id) => {
                const label = areas.find((a) => a.id === id)?.areaname?.trim() || id;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-sf-surface px-2.5 py-1 text-sm shadow-sm dark:bg-zinc-800"
                  >
                    {label}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => removeAreaTag(id)}
                      className="rounded-full p-0.5 hover:bg-sf-border/50"
                      aria-label={`Remove ${label}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
          <select
            key={areaPickerKey}
            className={`${inputClass} max-w-md`}
            defaultValue=""
            disabled={saving || areas.length === 0}
            aria-label="Add template area"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setAreaDocIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
              setAreaPickerKey((k) => k + 1);
            }}
          >
            <option value="">— Add area…</option>
            {areasToAdd.map((a) => (
              <option key={a.id} value={a.id}>
                {a.areaname}
              </option>
            ))}
          </select>
        </div>

        {usesCustomQuestion ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
              Question
            </span>
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              disabled={saving}
              maxLength={200}
              placeholder={
                mode === "oneScopeAnswersPerObject"
                  ? "e.g. Blinds"
                  : "e.g. Select shower components"
              }
              className={inputClass}
            />
          </label>
        ) : (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            Question for each scope: <span className="font-medium text-sf-text">object name</span>{" "}
            (e.g. {selectionRows[0]?.displayLabel || "—"}
            {count > 1 ? ", …" : ""}).
          </p>
        )}

        {mode === "oneScopeAnswersPerObject" ? (
          <div className="space-y-2">
            <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
              Answers (auto)
            </span>
            <p className="text-xs text-sf-text-weak dark:text-zinc-400">
              One answer per selected object; each answer attaches only that object.
            </p>
            <ul className="max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-sm text-sf-text-secondary dark:text-zinc-400">
              {selectionRows.map((row) => (
                <li key={row.selectionId}>{row.displayLabel}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {showYesNoAnswers ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                Answers
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={addAnswer}
                className="text-xs font-medium text-sf-brand hover:underline dark:text-[#58a9f5]"
              >
                + Add answer
              </button>
            </div>
            <p className="text-xs text-sf-text-weak dark:text-zinc-400">
              Exactly one answer is flagged for object attachment (default: Yes).
            </p>
            <ul className="space-y-2">
              {answers.map((a) => (
                <li
                  key={a.answerid}
                  className="flex flex-wrap items-center gap-2 rounded border border-sf-border/80 px-2 py-2 dark:border-zinc-700"
                >
                  <input
                    type="radio"
                    name="attach-answer"
                    checked={a.attachObjects}
                    onChange={() => setAttachAnswer(a.answerid)}
                    disabled={saving}
                    title="Objects attach to this answer"
                    aria-label={`Attach objects to ${a.label || "answer"}`}
                  />
                  <input
                    type="text"
                    value={a.label}
                    onChange={(e) => updateAnswerLabel(a.answerid, e.target.value)}
                    disabled={saving}
                    className={`${inputClass} min-h-9 flex-1 min-w-[8rem]`}
                    placeholder="Answer label"
                  />
                  {answers.length > 1 ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => removeAnswer(a.answerid)}
                      className="text-xs text-red-700 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg border border-dashed border-sf-border px-3 py-2 text-xs text-sf-text-secondary dark:border-zinc-600 dark:text-zinc-400">
          {preview}
          <ul className="mt-2 max-h-28 list-inside list-disc space-y-0.5 overflow-y-auto">
            {selectionRows.map((row) => (
              <li key={row.selectionId}>{row.displayLabel}</li>
            ))}
          </ul>
        </div>

        {error ? (
          <p className="text-sm text-red-800 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        {validationError && !error ? (
          <p className="text-sm text-amber-800 dark:text-amber-300" role="status">
            {validationError}
          </p>
        ) : null}
      </form>
    </ModalFrame>
  );
}
