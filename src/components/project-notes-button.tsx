"use client";

import { IconNotes } from "@/components/icons/lightning-icons";
import { ModalFrame } from "@/components/modal-frame";
import {
  ProjectNotesBrowser,
  type ProjectNoteAreaOption,
  type ProjectNoteObjectOption,
  type ProjectNotesBrowserProps,
} from "@/components/project-notes-browser";
import type { ProjectNoteTarget, ProjectNoteViewFilter } from "@/lib/project-note-filters";
import type { ProjectNotePublic } from "@/types/project-note";
import { useState } from "react";

export type { ProjectNoteAreaOption, ProjectNoteObjectOption } from "@/components/project-notes-browser";

const NOTES_MODAL_PANEL =
  "!h-[70vh] !max-h-[70vh] !w-[70vw] !max-w-[70vw] sm:!max-w-[70vw]";

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
  compact?: boolean;
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

  const badgeCount = badgeNotes.length;
  const hasBadgeNotes = badgeCount > 0;

  const iconColor = hasBadgeNotes
    ? "text-sf-destructive dark:text-red-400"
    : "text-zinc-400 dark:text-zinc-500";

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
        className={
          compact
            ? "inline-flex shrink-0 items-center gap-0.5 rounded border border-transparent -ml-1 py-0.5 pl-0 pr-0.5 text-xs transition hover:bg-sf-page disabled:opacity-50 dark:hover:bg-zinc-800"
            : "inline-flex shrink-0 items-center gap-0.5 rounded border border-sf-border-strong bg-sf-surface -ml-0.5 py-1 pl-1 pr-1.5 text-xs font-medium shadow-sm transition hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        }
        title={hasBadgeNotes ? `${badgeCount} note${badgeCount === 1 ? "" : "s"}` : "Add note"}
        aria-label={`Notes for ${label}`}
      >
        <IconNotes className={`h-4 w-4 ${iconColor}`} />
        {hasBadgeNotes ? (
          <span className={`tabular-nums ${iconColor}`}>({badgeCount})</span>
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
