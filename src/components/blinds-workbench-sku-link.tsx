"use client";

import { blindsSummaryLabel } from "@/lib/blinds/blinds-data-utils";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

type Props = {
  line: ProjectAreaObjectPublic;
  disabled?: boolean;
  onOpen: () => void;
};

export function BlindsWorkbenchSkuLink({ line, disabled = false, onOpen }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      className="block w-full min-w-0 text-left text-xs text-sf-brand underline decoration-sf-brand/40 underline-offset-2 hover:decoration-sf-brand disabled:opacity-50 dark:text-[#58a9f5]"
      title="Edit blinds selection"
    >
      {blindsSummaryLabel(line)}
    </button>
  );
}
