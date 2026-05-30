"use client";

import { BlindsScopeFields } from "@/components/blinds-scope-fields";
import { ModalFrame } from "@/components/modal-frame";
import type { DataBlindPublic } from "@/types/data-blind-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

type Props = {
  open: boolean;
  line: ProjectAreaObjectPublic;
  blindsRows: DataBlindPublic[];
  disabled?: boolean;
  selectClassName: string;
  onClose: () => void;
  onPatch: (patch: {
    blindDropMm?: number | null;
    blindWidthMm?: number | null;
    blindType?: string | null;
    blindColour?: string | null;
  }) => void | Promise<void>;
};

export function BlindsScopeEditModal({
  open,
  line,
  blindsRows,
  disabled = false,
  selectClassName,
  onClose,
  onPatch,
}: Props) {
  if (!open) return null;

  return (
    <ModalFrame
      title="Blinds selection"
      description="Choose drop and width first — only styles with a price at that size are listed."
      onClose={disabled ? () => {} : onClose}
      wide
      footer={
        <button
          type="button"
          disabled={disabled}
          onClick={onClose}
          className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
        >
          Done
        </button>
      }
    >
      <BlindsScopeFields
        line={line}
        blindsRows={blindsRows}
        disabled={disabled}
        selectClassName={selectClassName}
        layout="stacked"
        showSkuSummary
        onPatch={onPatch}
      />
    </ModalFrame>
  );
}
