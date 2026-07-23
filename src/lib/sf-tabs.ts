/**
 * Shared section tabs (project, setup, system, import, modals).
 * Square-edged — no top radius so tabs meet section headers cleanly.
 */
export function sfUnderlineTabClass(active: boolean): string {
  return `relative inline-flex h-9 items-center rounded-none px-4 text-sm font-medium transition-all ${
    active
      ? "bg-sf-page text-sf-brand shadow-[inset_0_-2px_0_0_var(--color-sf-accent)]"
      : "text-white/65 hover:bg-white/10 hover:text-white"
  }`;
}

export const sfTabStripClass =
  "flex flex-wrap items-end gap-1 border-0 bg-sf-brand px-5 pt-0";
