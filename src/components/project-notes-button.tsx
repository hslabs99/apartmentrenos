"use client";

import { IconNotes } from "@/components/icons/lightning-icons";
import { ModalFrame } from "@/components/modal-frame";
import {
  ProjectNotesBrowser,
  type ProjectNoteAreaOption,
  type ProjectNoteObjectOption,
  type ProjectNotesBrowserProps,
} from "@/components/project-notes-browser";
import {
  clAreaHdrIconBtnClass,
  clAreaHdrIconGlyphClass,
  clProjectHdrIconBtnClass,
  clProjectHdrIconGlyphClass,
  clRowIconBtnClass,
  clRowIconGlyphClass,
} from "@/components/cl-checklist-layout";
import type { ProjectNoteTarget, ProjectNoteViewFilter } from "@/lib/project-note-filters";
import type { ProjectNotePublic } from "@/types/project-note";
import { useState } from "react";

export type { ProjectNoteAreaOption, ProjectNoteObjectOption } from "@/components/project-notes-browser";

/** 70% viewport — works on tablet (sm+) as a centered panel; dvh accounts for browser chrome. */
const NOTES_MODAL_PANEL =
  "!h-[70dvh] !max-h-[70dvh] !w-[70vw] !max-w-[70vw] sm:!max-w-[70vw]";

export type ProjectNotesButtonSize =
  | "default"
  | "compact"
  | "areaHeader"
  | "projectHeader"
  /** Match workbench ⋮ menus (h-8 / h-5 glyph). */
  | "workbench";

/** Same hit target as WbProjectHdrMenu / WbLineRowMenu / WbAreaHdrMenu / workbench calculator. */
export const WB_ICON_BTN_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-sf-border-strong bg-sf-surface text-sf-text-secondary shadow-sm transition hover:bg-sf-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sf-brand disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700";
export const WB_ICON_GLYPH_CLASS = "h-5 w-5";

type Props = {
  label: string;
  badgeNotes: ProjectNotePublic[];
  allProjectNotes: ProjectNotePublic[];
  projectid: number;
  createTarget: ProjectNoteTarget;
  defaultViewFilter: ProjectNoteViewFilter;
  areaOptions: ProjectNoteAreaOption[];
  objectOptionsForArea: (areaid: number | null) => ProjectNoteObjectOption[];
  areaLabelForNote: (areaid: number | null) => string;
  objectLabelForNote: (areaid: number | null, objectid: number | null) => string;
  noteTypeOptions: string[];
  authorFallback?: string;
  disabled?: boolean;
  /** @deprecated Prefer `size="compact"`. */
  compact?: boolean;
  /** Match paired ⋮ menus: compact (CL rows), workbench, areaHeader, projectHeader. */
  size?: ProjectNotesButtonSize;
  /** When set, controls modal visibility (e.g. open notes after escalating an area). */
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  initialDraftNotetype?: string;
  focusDraftOnMount?: boolean;
  onCreateNote: (
    target: ProjectNoteTarget,
    body: {
      notetype: string;
      trades: string[];
      author: string;
      note: string;
    },
  ) => Promise<void>;
  onUpdateNote?: (
    noteId: string,
    body: { notetype: string; trades: string[]; note: string },
  ) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
};

function resolveSize(
  size: ProjectNotesButtonSize | undefined,
  compact: boolean,
): ProjectNotesButtonSize {
  if (size) return size;
  return compact ? "compact" : "default";
}

export function ProjectNotesButton({
  label,
  badgeNotes,
  allProjectNotes,
  projectid,
  createTarget,
  defaultViewFilter,
  areaOptions,
  objectOptionsForArea,
  areaLabelForNote,
  objectLabelForNote,
  noteTypeOptions,
  authorFallback = "",
  disabled = false,
  compact = false,
  size,
  modalOpen,
  onModalOpenChange,
  initialDraftNotetype,
  focusDraftOnMount,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = modalOpen !== undefined;
  const open = isControlled ? modalOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (isControlled) onModalOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [saving, setSaving] = useState(false);
  const resolved = resolveSize(size, compact);

  const badgeCount = badgeNotes.length;
  const hasBadgeNotes = badgeCount > 0;

  const iconColor =
    resolved === "areaHeader"
      ? hasBadgeNotes
        ? "text-red-300"
        : "text-white/70"
      : hasBadgeNotes
        ? "text-sf-destructive dark:text-red-400"
        : "text-zinc-400 dark:text-zinc-500";

  const btnClass =
    resolved === "compact"
      ? `${clRowIconBtnClass} relative`
      : resolved === "workbench"
        ? `${WB_ICON_BTN_CLASS} relative`
        : resolved === "areaHeader"
          ? `${clAreaHdrIconBtnClass} relative`
          : resolved === "projectHeader"
            ? `${clProjectHdrIconBtnClass} relative`
            : "inline-flex shrink-0 items-center gap-0.5 rounded border border-sf-border-strong bg-sf-surface -ml-0.5 py-1 pl-1 pr-1.5 text-xs font-medium shadow-sm transition hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800";

  const glyphClass =
    resolved === "compact"
      ? clRowIconGlyphClass
      : resolved === "workbench"
        ? WB_ICON_GLYPH_CLASS
        : resolved === "areaHeader"
          ? clAreaHdrIconGlyphClass
          : resolved === "projectHeader"
            ? clProjectHdrIconGlyphClass
            : "h-4 w-4";

  const showInlineCount = hasBadgeNotes && resolved === "default";
  const showBadgeDot = hasBadgeNotes && resolved !== "default";

  const browserProps: ProjectNotesBrowserProps = {
    projectName: label,
    projectid,
    allProjectNotes,
    createTarget,
    initialViewFilter: defaultViewFilter,
    areaOptions,
    objectOptionsForArea,
    areaLabelForNote,
    objectLabelForNote,
    noteTypeOptions,
    authorFallback,
    disabled: disabled || saving,
    initialDraftNotetype,
    focusDraftOnMount,
    onCreateNote: async (_target, body) => {
      setSaving(true);
      try {
        await onCreateNote(createTarget, body);
      } finally {
        setSaving(false);
      }
    },
    onUpdateNote: onUpdateNote
      ? async (noteId, body) => {
          setSaving(true);
          try {
            await onUpdateNote(noteId, body);
          } finally {
            setSaving(false);
          }
        }
      : undefined,
    onDeleteNote,
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={btnClass}
        title={hasBadgeNotes ? `${badgeCount} note${badgeCount === 1 ? "" : "s"}` : "Add note"}
        aria-label={`Notes for ${label}`}
      >
        <IconNotes className={`${glyphClass} ${iconColor}`} />
        {showInlineCount ? (
          <span className={`tabular-nums ${iconColor}`}>({badgeCount})</span>
        ) : null}
        {showBadgeDot ? (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sf-destructive px-0.5 text-[9px] font-bold leading-none text-white">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <ModalFrame
          title={`Notes — ${label}`}
          description="Filter by area, object, and trade. Select a note on the left to view details."
          onClose={() => {
            if (saving) return;
            setOpen(false);
          }}
          panelClassName={NOTES_MODAL_PANEL}
          contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
          footer={
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                setOpen(false);
              }}
              disabled={saving}
              className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
            >
              Close
            </button>
          }
        >
          <ProjectNotesBrowser {...browserProps} className="min-h-0 flex-1 border-0 rounded-none" />
        </ModalFrame>
      ) : null}
    </>
  );
}
