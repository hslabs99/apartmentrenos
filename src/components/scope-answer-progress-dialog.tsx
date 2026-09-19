"use client";

export type ScopeAnswerProgress = {
  question: string;
  answerLabel: string | null;
  /** `saving` = server is replacing items; `refreshing` = checklist is catching up. */
  phase: "saving" | "refreshing";
};

const SELECT_STEPS = [
  "Remove previous items",
  "Load items for this answer",
  "Update the checklist",
];

const CLEAR_STEPS = ["Remove items", "Update the checklist"];

function StepMark({
  done,
  current,
}: {
  done: boolean;
  current: boolean;
}) {
  if (done) {
    return (
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base font-bold text-green-600 dark:text-green-400" aria-hidden>
        ✓
      </span>
    );
  }
  if (current) {
    return (
      <span
        className="mt-0.5 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sf-brand border-t-transparent dark:border-[#58a9f5] dark:border-t-transparent"
        aria-hidden
      />
    );
  }
  return <span className="inline-block h-5 w-5 shrink-0" aria-hidden />;
}

export function ScopeAnswerProgressDialog({
  progress,
}: {
  progress: ScopeAnswerProgress | null;
}) {
  if (!progress) return null;

  const clearing = progress.answerLabel == null;
  const steps = clearing ? CLEAR_STEPS : SELECT_STEPS;
  const last = steps.length - 1;
  const refreshing = progress.phase === "refreshing";
  const currentStep = refreshing ? last : 0;
  const message = refreshing
    ? "Updating the checklist…"
    : clearing
      ? "Removing items from this question…"
      : "Loading items for this answer…";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="scope-answer-progress-title"
      aria-describedby="scope-answer-progress-desc"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-block h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-sf-brand border-t-transparent dark:border-[#58a9f5] dark:border-t-transparent"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 id="scope-answer-progress-title" className="text-lg font-semibold text-sf-text dark:text-zinc-50">
              Please wait
            </h2>
            <p className="mt-1 text-sm text-sf-text-secondary dark:text-zinc-400">
              Please don’t click elsewhere until this finishes.
            </p>
          </div>
        </div>

        <div id="scope-answer-progress-desc" className="mt-5 space-y-1">
          <p className="text-sm font-medium text-sf-text dark:text-zinc-100">{progress.question}</p>
          {clearing ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Clearing this answer</p>
          ) : (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              Selected: <span className="font-medium text-sf-text dark:text-zinc-100">{progress.answerLabel}</span>
            </p>
          )}
        </div>

        <p className="mt-4 text-sm font-medium text-sf-brand dark:text-[#58a9f5]" aria-live="polite">
          {message}
        </p>

        <ol className="mt-3 space-y-2">
          {steps.map((label, i) => {
            const done = refreshing ? i < last : false;
            const current = i === currentStep || (!refreshing && !clearing && i === 1);
            const working = !done && current;
            return (
              <li key={label} className="flex items-start gap-2 text-sm">
                <StepMark done={done} current={working} />
                <span
                  className={
                    done
                      ? "text-sf-text dark:text-zinc-100"
                      : working
                        ? "font-medium text-sf-text dark:text-zinc-100"
                        : "text-sf-text-weak dark:text-zinc-500"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
