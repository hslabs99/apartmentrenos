/**
 * Lightning-style underline tabs — shared with ProjectsTabs and Setup/System strips.
 */
export function sfUnderlineTabClass(active: boolean): string {
  return `inline-flex min-h-10 min-w-[44px] items-center border-b-2 px-3 py-2 text-sm font-normal transition md:min-h-11 md:px-4 ${
    active
      ? "border-sf-brand font-semibold text-sf-brand dark:border-[#58a9f5] dark:text-[#58a9f5]"
      : "border-transparent text-sf-text-secondary hover:border-sf-border hover:text-sf-text dark:border-transparent dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
  }`;
}

export const sfTabStripClass =
  "-mb-px flex flex-wrap justify-start gap-x-1 gap-y-0 border-b border-sf-border dark:border-zinc-700";
