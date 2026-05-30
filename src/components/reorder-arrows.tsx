"use client";

type ReorderArrowsProps = {
  onUp: () => void;
  onDown: () => void;
  disabledUp?: boolean;
  disabledDown?: boolean;
  /** Used for the control group’s accessible name */
  itemLabel: string;
  /** Smaller buttons for nested tables */
  dense?: boolean;
};

export function ReorderArrows({
  onUp,
  onDown,
  disabledUp,
  disabledDown,
  itemLabel,
  dense,
}: ReorderArrowsProps) {
  const btn =
    dense
      ? "flex h-7 min-h-7 w-7 min-w-7 items-center justify-center rounded border border-sf-border-strong bg-sf-page text-sm font-semibold leading-none text-sf-text transition hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      : "flex h-9 min-h-9 w-9 min-w-9 items-center justify-center rounded border border-sf-border-strong bg-sf-page text-base font-semibold leading-none text-sf-text transition hover:bg-sf-page disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <div
      className="flex shrink-0 flex-row items-center gap-1"
      role="group"
      aria-label={`Reorder ${itemLabel}`}
    >
      <button
        type="button"
        className={btn}
        onClick={onUp}
        disabled={disabledUp}
        aria-label={`Move ${itemLabel} up`}
      >
        ↑
      </button>
      <button
        type="button"
        className={btn}
        onClick={onDown}
        disabled={disabledDown}
        aria-label={`Move ${itemLabel} down`}
      >
        ↓
      </button>
    </div>
  );
}
