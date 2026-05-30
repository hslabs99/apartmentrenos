"use client";

import { useViewMode, type ViewMode } from "@/lib/view-mode";

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-md px-3 text-sm font-medium transition ${
        active
          ? "bg-sf-brand text-white shadow-sm"
          : "text-sf-text-secondary hover:bg-sf-page dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode();

  const set = (m: ViewMode) => () => setViewMode(m);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-sf-border bg-sf-surface p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
      <ToggleButton active={viewMode === "admin"} onClick={set("admin")}>
        Admin
      </ToggleButton>
      <ToggleButton active={viewMode === "sales"} onClick={set("sales")}>
        Sales
      </ToggleButton>
      <ToggleButton active={viewMode === "purchasing"} onClick={set("purchasing")}>
        Purchasing
      </ToggleButton>
    </div>
  );
}

