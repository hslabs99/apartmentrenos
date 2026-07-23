"use client";

import { useViewMode, type ViewMode } from "@/lib/view-mode";

function ToggleButton({
  active,
  children,
  onClick,
  emphasis,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? emphasis
            ? "bg-sf-accent text-white hover:bg-sf-accent-hover"
            : "bg-white/15 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/** Management-only preview switcher — stays visible while previewing Sales or Admin. */
export function ViewModeToggle() {
  const { viewMode, setViewMode, canPreviewViewModes } = useViewMode();

  if (!canPreviewViewModes) return null;

  const set = (m: ViewMode) => () => setViewMode(m);

  return (
    <div
      className="flex items-center gap-0.5"
      title="Preview UI as another user type"
    >
      <ToggleButton active={viewMode === "sales"} onClick={set("sales")}>
        Sales
      </ToggleButton>
      <ToggleButton active={viewMode === "admin"} onClick={set("admin")}>
        Admin
      </ToggleButton>
      <ToggleButton
        active={viewMode === "management"}
        onClick={set("management")}
        emphasis
      >
        Manage
      </ToggleButton>
    </div>
  );
}
