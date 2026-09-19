"use client";

import {
  missingQuoteObjectContext,
  missingQuoteObjectTitle,
} from "@/lib/health-check/orphan-refs";
import type { HealthCheckAnswerIssue, HealthCheckMissingObject } from "@/types/health-check";

const badgeClass =
  "rounded border border-red-300 bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200";

export function missingObjectBadgeLabel(count = 1): string {
  return count === 1 ? "Missing object" : `Missing objects (${count})`;
}

export function MissingObjectBadge({
  count = 1,
  onClick,
}: {
  count?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const label = missingObjectBadgeLabel(count);
  if (!onClick) {
    return <span className={badgeClass}>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${badgeClass} hover:bg-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 dark:hover:bg-red-900/70`}
      aria-label={`${label}. Show which quote objects are missing.`}
    >
      {label}
    </button>
  );
}

export function MissingQuoteObjectFacts({ item }: { item: HealthCheckMissingObject }) {
  const title = missingQuoteObjectTitle(item);
  const context = missingQuoteObjectContext(item);
  const id = item.id?.trim();
  const nameKnown = Boolean(item.name?.trim());
  return (
    <span className="min-w-0">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-red-900 dark:text-red-200">{title}</span>
        <MissingObjectBadge />
      </span>
      {context ? (
        <span className="mt-0.5 block text-xs text-red-800 dark:text-red-300">{context}</span>
      ) : null}
      {!nameKnown ? (
        <span className="mt-0.5 block text-xs text-red-800 dark:text-red-300">
          The original object name is no longer stored on this scope.
        </span>
      ) : null}
      {id ? (
        <span className="mt-0.5 block font-mono text-[11px] text-red-800/90 dark:text-red-300/90">
          Quote object ID: {id}
        </span>
      ) : null}
    </span>
  );
}

export function MissingScopeObjectsDialog({
  open,
  title,
  description,
  answers,
  editLabel,
  onEdit,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  answers: readonly HealthCheckAnswerIssue[];
  editLabel?: string;
  onEdit?: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-scope-objects-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="missing-scope-objects-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
          {description ??
            "These quote objects are attached to this scope but are no longer in Setup → Quote Objects. Remove or replace them, then save."}
        </p>
        {answers.length === 0 ? (
          <p className="mt-4 text-sm text-sf-text-secondary dark:text-zinc-400">
            No missing objects.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {answers.map((answer) => (
              <li key={answer.answerid}>
                <p className="text-sm font-medium text-sf-text dark:text-zinc-100">
                  Answer: {answer.answerLabel.trim() || "(untitled)"}
                </p>
                <ul className="mt-2 space-y-3">
                  {answer.missingItems.map((item, idx) => (
                    <li
                      key={`${answer.answerid}-${item.id ?? item.name ?? idx}`}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/40"
                    >
                      <MissingQuoteObjectFacts item={item} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
          >
            Close
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white hover:bg-sf-brand-hover"
            >
              {editLabel ?? "Edit answers"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
