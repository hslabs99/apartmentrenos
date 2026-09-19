"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconPlus, IconTrash } from "@/components/icons/lightning-icons";
import {
  ProjectNotesPrintReport,
  projectNotesFilterLabel,
} from "@/components/project-notes-print-report";
import { getCurrentUsername } from "@/lib/client/current-user";
import { formatProjectNoteDate, noteIndexPreview } from "@/lib/project-note-display";
import type { ProjectNoteSkuOption } from "@/lib/client/project-note-sku-options";
import {
  countObjectAndSkuNotes,
  filterNotesForView,
  noteSkuId,
  projectNoteListKey,
  sortNotesNewestFirst,
  uniqueNoteAreaOptionsByAreaId,
  uniqueNoteObjectOptionsByObjectId,
  uniqueNoteSkuOptionsBySkuId,
  uniqueProjectNotes,
  type ProjectNoteTarget,
  type ProjectNoteViewFilter,
} from "@/lib/project-note-filters";
import {
  formatProjectNoteTrades,
  PROJECT_NOTE_TRADE_TAGS,
} from "@/lib/project-note-trades";
import {
  DEFAULT_NOTE_TYPE,
  ESCALATION_NOTE_TYPE,
  isRetiredNoteType,
} from "@/lib/project-note-types";
import type { ProjectNotePublic, ProjectNoteUpdateBody } from "@/types/project-note";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ProjectNoteAreaOption = { areaid: number; label: string };
export type ProjectNoteObjectOption = { objectid: number; label: string };
export type { ProjectNoteSkuOption };

const inputLong =
  "w-full min-w-0 rounded-lg border border-sf-border bg-sf-surface px-2 py-2 text-sm outline-none focus:border-sf-accent focus:ring-2 focus:ring-sf-accent/30 dark:border-zinc-600 dark:bg-zinc-950";
const selectBase =
  "rounded-lg border border-sf-border bg-sf-surface px-1 py-1 text-sm outline-none focus:border-sf-accent focus:ring-2 focus:ring-sf-accent/30 dark:border-zinc-600 dark:bg-zinc-950";

const tradeTagOffClass =
  "rounded-full border border-sf-border bg-sf-surface px-3 py-1 text-xs font-medium text-sf-text-secondary transition hover:border-sf-brand hover:text-sf-brand dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
const tradeTagOnClass =
  "rounded-full border border-sf-brand bg-sf-brand px-3 py-1 text-xs font-medium text-white shadow-sm transition dark:border-sf-brand dark:bg-sf-brand";
const tradeTagEditOnClass =
  "rounded-full border border-sf-accent bg-sf-accent px-3 py-1 text-xs font-medium text-white shadow-sm transition";

function tradesSortedEqual(a: Iterable<string>, b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

export type ProjectNotesBrowserProps = {
  projectName: string;
  projectid: number;
  allProjectNotes: ProjectNotePublic[];
  createTarget: ProjectNoteTarget;
  /** When set, new notes attach to the current area/object filter instead of `createTarget`. */
  attachNotesToFilter?: boolean;
  initialViewFilter?: ProjectNoteViewFilter;
  areaOptions: ProjectNoteAreaOption[];
  objectOptionsForArea: (areaid: number | null) => ProjectNoteObjectOption[];
  skuOptionsForObject: (areaid: number | null, objectid: number | null) => ProjectNoteSkuOption[];
  areaLabelForNote: (areaid: number | null) => string;
  objectLabelForNote: (areaid: number | null, objectid: number | null) => string;
  skuLabelForNote: (skuId: string | null) => string;
  noteTypeOptions: string[];
  authorFallback?: string;
  disabled?: boolean;
  showPrintReport?: boolean;
  headerActions?: ReactNode;
  className?: string;
  /** Tighter chrome for the checklist/workbench pop-up (short landscape screens). */
  compactLayout?: boolean;
  /** Pre-select note type on a newly created note (e.g. Escalation). */
  initialDraftNotetype?: string;
  /** Create a note and focus the editor when the browser mounts (e.g. after escalating an area). */
  focusDraftOnMount?: boolean;
  /** Labeled close control for pop-up use (in addition to the window X). */
  onClose?: () => void;
  /** Bind the modal X / overlay close to the same unsaved-change guard as Close. */
  onBindAttemptClose?: (attemptClose: () => void) => void;
  onCreateNote: (
    target: ProjectNoteTarget,
    body: {
      notetype: string;
      trades: string[];
      author: string;
      note: string;
    },
  ) => Promise<ProjectNotePublic | void>;
  onUpdateNote?: (noteId: string, body: ProjectNoteUpdateBody) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
};

export function ProjectNotesBrowser({
  projectName,
  projectid,
  allProjectNotes,
  createTarget,
  attachNotesToFilter = false,
  initialViewFilter,
  areaOptions,
  objectOptionsForArea,
  skuOptionsForObject,
  areaLabelForNote,
  objectLabelForNote,
  skuLabelForNote,
  noteTypeOptions,
  authorFallback = "",
  disabled = false,
  showPrintReport = false,
  headerActions,
  className = "",
  compactLayout = false,
  initialDraftNotetype,
  focusDraftOnMount = false,
  onClose,
  onBindAttemptClose,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: ProjectNotesBrowserProps) {
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editTrades, setEditTrades] = useState<Set<string>>(() => new Set());
  const [editNoteText, setEditNoteText] = useState("");
  const [editNotetype, setEditNotetype] = useState(DEFAULT_NOTE_TYPE);
  const [editObjectid, setEditObjectid] = useState<number | null>(null);
  const [editSkuId, setEditSkuId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [filterAreaid, setFilterAreaid] = useState<number | null>(
    initialViewFilter?.areaid ?? null,
  );
  const [filterObjectid, setFilterObjectid] = useState<number | null>(
    initialViewFilter?.objectid ?? null,
  );
  const [filterSkuId, setFilterSkuId] = useState<string | null>(
    initialViewFilter?.skuId?.trim() || null,
  );
  const [filterTrades, setFilterTrades] = useState<Set<string>>(
    () => new Set(initialViewFilter?.trades ?? []),
  );
  const [filterNotetypes, setFilterNotetypes] = useState<Set<string>>(
    () => new Set(initialViewFilter?.notetypes ?? []),
  );
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [optimisticNote, setOptimisticNote] = useState<ProjectNotePublic | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const autoCreatedRef = useRef(false);
  const pendingFocusNoteId = useRef<string | null>(null);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const editDirtyRef = useRef(false);
  const selectedNoteRef = useRef<ProjectNotePublic | null>(null);
  const onDeleteNoteRef = useRef(onDeleteNote);
  const onCloseRef = useRef(onClose);

  const typeOptions = useMemo(() => {
    const raw =
      noteTypeOptions.length > 0
        ? noteTypeOptions
        : ["General", "Style", "Other", ESCALATION_NOTE_TYPE];
    const seen = new Set<string>();
    const base: string[] = [];
    for (const t of raw) {
      const trimmed = t.trim();
      if (!trimmed || isRetiredNoteType(trimmed)) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      base.push(trimmed);
    }
    if (!base.some((t) => t === ESCALATION_NOTE_TYPE)) {
      base.push(ESCALATION_NOTE_TYPE);
    }
    return base;
  }, [noteTypeOptions]);

  /** Include a retired type only while editing a legacy note that still has it. */
  const editTypeOptions = useMemo(() => {
    const current = editNotetype.trim();
    if (!current || !isRetiredNoteType(current)) return typeOptions;
    if (typeOptions.some((t) => t.toLowerCase() === current.toLowerCase())) return typeOptions;
    return [...typeOptions, current];
  }, [typeOptions, editNotetype]);

  const notesForView = useMemo(() => {
    if (!optimisticNote) return allProjectNotes;
    if (allProjectNotes.some((n) => n.id === optimisticNote.id)) return allProjectNotes;
    return uniqueProjectNotes([optimisticNote, ...allProjectNotes]);
  }, [allProjectNotes, optimisticNote]);

  useEffect(() => {
    if (!optimisticNote) return;
    if (allProjectNotes.some((n) => n.id === optimisticNote.id)) setOptimisticNote(null);
  }, [allProjectNotes, optimisticNote]);

  const uniqueAreaOptions = useMemo(
    () => uniqueNoteAreaOptionsByAreaId(areaOptions),
    [areaOptions],
  );

  const objectOptions = useMemo(
    () => uniqueNoteObjectOptionsByObjectId(objectOptionsForArea(filterAreaid)),
    [objectOptionsForArea, filterAreaid],
  );

  const skuOptions = useMemo(
    () => uniqueNoteSkuOptionsBySkuId(skuOptionsForObject(filterAreaid, filterObjectid)),
    [skuOptionsForObject, filterAreaid, filterObjectid],
  );

  const filteredNotes = useMemo(
    () =>
      uniqueProjectNotes(
        sortNotesNewestFirst(
          filterNotesForView(notesForView, projectid, {
            areaid: filterAreaid,
            objectid: filterObjectid,
            skuId: filterSkuId,
            trades: filterTrades.size > 0 ? [...filterTrades] : undefined,
            notetypes: filterNotetypes.size > 0 ? [...filterNotetypes] : undefined,
          }),
        ),
      ),
    [
      notesForView,
      projectid,
      filterAreaid,
      filterObjectid,
      filterSkuId,
      filterTrades,
      filterNotetypes,
    ],
  );

  const selectedNote = useMemo(
    () => notesForView.find((n) => n.id === selectedNoteId) ?? null,
    [notesForView, selectedNoteId],
  );

  const editObjectOptions = useMemo(() => {
    if (selectedNote?.areaid == null) return [];
    return uniqueNoteObjectOptionsByObjectId(objectOptionsForArea(selectedNote.areaid));
  }, [objectOptionsForArea, selectedNote?.areaid]);

  const editSkuOptions = useMemo(() => {
    if (selectedNote?.areaid == null || editObjectid == null) return [];
    return uniqueNoteSkuOptionsBySkuId(
      skuOptionsForObject(selectedNote.areaid, editObjectid),
    );
  }, [skuOptionsForObject, selectedNote?.areaid, editObjectid]);

  const effectiveCreateTarget = useMemo((): ProjectNoteTarget => {
    if (attachNotesToFilter) {
      return {
        projectid,
        areaid: filterAreaid,
        objectid: filterObjectid,
        skuId: filterSkuId,
      };
    }
    return {
      ...createTarget,
      skuId: createTarget.skuId?.trim() || filterSkuId,
    };
  }, [attachNotesToFilter, createTarget, projectid, filterAreaid, filterObjectid, filterSkuId]);

  const filterLabel = useMemo(
    () =>
      projectNotesFilterLabel(
        {
          areaid: filterAreaid,
          objectid: filterObjectid,
          skuId: filterSkuId,
          trades: filterTrades.size > 0 ? [...filterTrades] : undefined,
          notetypes: filterNotetypes.size > 0 ? [...filterNotetypes] : undefined,
        },
        (areaid) => areaLabelForNote(areaid),
        (objectid) => {
          for (const n of notesForView) {
            if (n.objectid === objectid) {
              return objectLabelForNote(n.areaid, objectid);
            }
          }
          return `Object ${objectid}`;
        },
        (skuId) => skuLabelForNote(skuId),
      ),
    [
      filterAreaid,
      filterObjectid,
      filterSkuId,
      filterTrades,
      filterNotetypes,
      areaLabelForNote,
      objectLabelForNote,
      skuLabelForNote,
      notesForView,
    ],
  );

  useEffect(() => {
    if (creating) return;
    if (selectedNoteId && notesForView.some((n) => n.id === selectedNoteId)) return;
    if (filteredNotes.length === 0) {
      setSelectedNoteId(null);
      return;
    }
    setSelectedNoteId(filteredNotes[0]!.id);
  }, [creating, filteredNotes, notesForView, selectedNoteId]);

  useEffect(() => {
    if (!selectedNote) {
      setEditTrades(new Set());
      setEditNoteText("");
      setEditNotetype(DEFAULT_NOTE_TYPE);
      setEditObjectid(null);
      setEditSkuId(null);
      setEditError(null);
      return;
    }
    setEditTrades(new Set(selectedNote.trades));
    setEditNoteText(selectedNote.note);
    setEditNotetype(selectedNote.notetype || DEFAULT_NOTE_TYPE);
    setEditObjectid(selectedNote.objectid);
    setEditSkuId(noteSkuId(selectedNote));
    setEditError(null);
    // Re-hydrate the editor only when switching notes, not when the same note is refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote?.id]);

  useEffect(() => {
    if (!selectedNote?.id || pendingFocusNoteId.current !== selectedNote.id) return;
    pendingFocusNoteId.current = null;
    const timer = window.setTimeout(() => {
      editTextareaRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [selectedNote?.id]);

  const editDirty = useMemo(() => {
    if (!selectedNote) return false;
    const text = editNoteText.trim();
    return (
      text !== selectedNote.note.trim() ||
      (editNotetype || DEFAULT_NOTE_TYPE) !== (selectedNote.notetype || DEFAULT_NOTE_TYPE) ||
      !tradesSortedEqual(editTrades, selectedNote.trades) ||
      (editObjectid ?? null) !== (selectedNote.objectid ?? null) ||
      (editSkuId?.trim() || null) !== (noteSkuId(selectedNote) ?? null)
    );
  }, [selectedNote, editNoteText, editNotetype, editTrades, editObjectid, editSkuId]);

  editDirtyRef.current = editDirty;
  selectedNoteRef.current = selectedNote;
  onDeleteNoteRef.current = onDeleteNote;
  onCloseRef.current = onClose;

  const isEmptyStub = (note: ProjectNotePublic | null) => Boolean(note && !note.note.trim());

  const cleanupEmptyStubThen = useCallback(async (next: () => void) => {
    const current = selectedNoteRef.current;
    if (current && isEmptyStub(current) && onDeleteNoteRef.current) {
      try {
        await onDeleteNoteRef.current(current.id);
        setOptimisticNote((prev) => (prev?.id === current.id ? null : prev));
      } catch {
        setEditError("Failed to discard empty note");
        return;
      }
    }
    next();
  }, []);

  const attemptLeave = useCallback((next: () => void) => {
    if (editDirtyRef.current) {
      pendingLeaveRef.current = next;
      setDiscardOpen(true);
      return;
    }
    void cleanupEmptyStubThen(next);
  }, [cleanupEmptyStubThen]);

  useEffect(() => {
    onBindAttemptClose?.(() => attemptLeave(() => onCloseRef.current?.()));
  }, [attemptLeave, onBindAttemptClose]);

  function toggleEditTradeTag(tag: string) {
    setEditTrades((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function onAreaFilterChange(raw: string) {
    attemptLeave(() => {
      const next = raw === "" ? null : Number(raw);
      setFilterAreaid(Number.isInteger(next) ? next : null);
      setFilterObjectid(null);
      setFilterSkuId(null);
      setSelectedNoteId(null);
    });
  }

  function onObjectFilterChange(raw: string) {
    attemptLeave(() => {
      const next = raw === "" ? null : Number(raw);
      setFilterObjectid(Number.isInteger(next) ? next : null);
      setFilterSkuId(null);
      setSelectedNoteId(null);
    });
  }

  function onSkuFilterChange(raw: string) {
    attemptLeave(() => {
      const next = raw.trim();
      setFilterSkuId(next || null);
      setSelectedNoteId(null);
    });
  }

  function toggleFilterNotetype(notetype: string) {
    attemptLeave(() => {
      setFilterNotetypes((prev) => {
        const next = new Set(prev);
        if (next.has(notetype)) next.delete(notetype);
        else next.add(notetype);
        return next;
      });
      setSelectedNoteId(null);
    });
  }

  function toggleFilterTrade(tag: string) {
    attemptLeave(() => {
      setFilterTrades((prev) => {
        const next = new Set(prev);
        if (next.has(tag)) next.delete(tag);
        else next.add(tag);
        return next;
      });
      setSelectedNoteId(null);
    });
  }

  const handleNewNote = useCallback(() => {
    attemptLeave(() => {
      void (async () => {
        const author = getCurrentUsername() || authorFallback.trim() || "Unknown";
        const notetype = initialDraftNotetype?.trim() || DEFAULT_NOTE_TYPE;
        setCreating(true);
        setEditError(null);
        setFilterNotetypes(new Set());
        setFilterTrades(new Set());
        try {
          const created = await onCreateNote(effectiveCreateTarget, {
            notetype,
            trades: [],
            author,
            note: "",
          });
          if (created?.id) {
            pendingFocusNoteId.current = created.id;
            setOptimisticNote(created);
            setSelectedNoteId(created.id);
          }
        } catch (e) {
          setEditError(e instanceof Error ? e.message : "Failed to create note");
        } finally {
          setCreating(false);
        }
      })();
    });
  }, [
    attemptLeave,
    authorFallback,
    effectiveCreateTarget,
    initialDraftNotetype,
    onCreateNote,
  ]);

  useEffect(() => {
    if (!focusDraftOnMount || autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    void handleNewNote();
  }, [focusDraftOnMount, handleNewNote]);

  async function handleSaveEdit() {
    if (!selectedNote || !onUpdateNote) return;
    const text = editNoteText.trim();
    if (!text) {
      setEditError("Note text cannot be empty.");
      return;
    }
    const trades = [...editTrades];
    setSaving(true);
    setEditError(null);
    try {
      await onUpdateNote(selectedNote.id, {
        notetype: editNotetype || DEFAULT_NOTE_TYPE,
        trades,
        note: text,
        objectid: editObjectid,
        skuId: editObjectid == null ? null : editSkuId?.trim() || null,
      });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!onDeleteNote) return;
    setDeletingId(noteId);
    setDeleteOpen(false);
    try {
      await onDeleteNote(noteId);
      if (optimisticNote?.id === noteId) setOptimisticNote(null);
      const remaining = filteredNotes.filter((n) => n.id !== noteId);
      const fallback = remaining[0]?.id ?? null;
      setSelectedNoteId((id) => (id === noteId ? fallback : id));
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to delete note");
    } finally {
      setDeletingId(null);
    }
  }

  function confirmDiscard() {
    const next = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    setDiscardOpen(false);
    void cleanupEmptyStubThen(() => next?.());
  }

  function handlePrintReport() {
    window.print();
  }

  const filterAreaValue = filterAreaid == null ? "" : String(filterAreaid);
  const filterObjectValue = filterObjectid == null ? "" : String(filterObjectid);
  const filterSkuValue = filterSkuId ?? "";
  const fieldsLocked = disabled || saving;
  const skuFilterDisabled = fieldsLocked || filterObjectid == null;
  const objectSkuNoteCounts = useMemo(
    () =>
      countObjectAndSkuNotes(notesForView, projectid, {
        areaid: filterAreaid,
        objectid: filterObjectid,
        skuId: filterSkuId,
      }),
    [notesForView, projectid, filterAreaid, filterObjectid, filterSkuId],
  );
  const showObjectSkuCounts = filterObjectid != null;
  const skuFilterHidesObjectNotes =
    Boolean(filterSkuId) && objectSkuNoteCounts.objectLevel > 0;

  return (
    <>
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-sf-border bg-sf-surface dark:border-zinc-700 dark:bg-zinc-900/50 ${className}`.trim()}
      >
        <div
          className={`shrink-0 space-y-2 border-b border-sf-border dark:border-zinc-700 ${
            compactLayout ? "px-3 py-2" : "px-4 py-3"
          }`}
        >
          <div className="flex min-w-0 flex-wrap items-end gap-3 sm:flex-nowrap">
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs sm:min-w-[8rem]">
              <span className="font-medium text-sf-text-secondary dark:text-zinc-400">Area</span>
              <select
                className={selectBase}
                value={filterAreaValue}
                disabled={fieldsLocked}
                onChange={(e) => onAreaFilterChange(e.target.value)}
              >
                <option value="">All areas</option>
                {uniqueAreaOptions.map((a) => (
                  <option key={`area-${a.areaid}`} value={String(a.areaid)}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs sm:min-w-[8rem]">
              <span className="font-medium text-sf-text-secondary dark:text-zinc-400">
                Object
                {showObjectSkuCounts ? (
                  <span className="ml-1 font-normal text-sf-text-weak dark:text-zinc-400">
                    ({objectSkuNoteCounts.objectLevel} note
                    {objectSkuNoteCounts.objectLevel === 1 ? "" : "s"})
                  </span>
                ) : null}
              </span>
              <select
                className={selectBase}
                value={filterObjectValue}
                disabled={fieldsLocked}
                onChange={(e) => onObjectFilterChange(e.target.value)}
              >
                <option value="">All objects</option>
                {objectOptions.map((o) => (
                  <option key={`object-${o.objectid}`} value={String(o.objectid)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs sm:min-w-[8rem]">
              <span className="font-medium text-sf-text-secondary dark:text-zinc-400">
                SKU
                {showObjectSkuCounts ? (
                  <span className="ml-1 font-normal text-sf-text-weak dark:text-zinc-400">
                    ({objectSkuNoteCounts.skuLevel} note
                    {objectSkuNoteCounts.skuLevel === 1 ? "" : "s"})
                  </span>
                ) : null}
              </span>
              <select
                className={selectBase}
                value={filterSkuValue}
                disabled={skuFilterDisabled}
                onChange={(e) => onSkuFilterChange(e.target.value)}
              >
                <option value="">All SKUs</option>
                {skuOptions.map((s) => (
                  <option key={`sku-${s.skuId}`} value={s.skuId}>
                    {s.label}
                  </option>
                ))}
                {filterSkuId && !skuOptions.some((s) => s.skuId === filterSkuId) ? (
                  <option value={filterSkuId}>{skuLabelForNote(filterSkuId)}</option>
                ) : null}
              </select>
            </label>
            <span className="pb-1 text-xs text-sf-text-weak dark:text-zinc-400">
              Showing {filteredNotes.length}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2 pb-0.5 print:hidden">
              {showPrintReport ? (
                <button
                  type="button"
                  disabled={fieldsLocked}
                  onClick={handlePrintReport}
                  className="min-h-9 rounded-lg border border-sf-border-strong bg-sf-surface px-3 text-sm font-medium text-sf-text hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Print report
                </button>
              ) : null}
              {headerActions}
            </div>
          </div>
          {skuFilterHidesObjectNotes ? (
            <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
              {objectSkuNoteCounts.objectLevel} object-level note
              {objectSkuNoteCounts.objectLevel === 1 ? "" : "s"} not shown.{" "}
              <button
                type="button"
                disabled={fieldsLocked}
                onClick={() => onSkuFilterChange("")}
                className="underline hover:text-sf-text dark:hover:text-zinc-200"
              >
                Clear SKU
              </button>{" "}
              to see all notes for this object.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
              Type
            </span>
            <div className="flex flex-wrap gap-1.5">
              {typeOptions.map((notetype) => {
                const on = filterNotetypes.has(notetype);
                return (
                  <button
                    key={notetype}
                    type="button"
                    disabled={fieldsLocked}
                    onClick={() => toggleFilterNotetype(notetype)}
                    className={on ? tradeTagOnClass : tradeTagOffClass}
                    aria-pressed={on}
                  >
                    {notetype}
                  </button>
                );
              })}
            </div>
            {filterNotetypes.size > 0 ? (
              <button
                type="button"
                disabled={fieldsLocked}
                onClick={() => {
                  setFilterNotetypes(new Set());
                  setSelectedNoteId(null);
                }}
                className="text-xs text-sf-text-weak underline hover:text-sf-text dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Clear types
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
              Trades
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_NOTE_TRADE_TAGS.map((tag) => {
                const on = filterTrades.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={fieldsLocked}
                    onClick={() => toggleFilterTrade(tag)}
                    className={on ? tradeTagOnClass : tradeTagOffClass}
                    aria-pressed={on}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {filterTrades.size > 0 ? (
              <button
                type="button"
                disabled={fieldsLocked}
                onClick={() => {
                  setFilterTrades(new Set());
                  setSelectedNoteId(null);
                }}
                className="text-xs text-sf-text-weak underline hover:text-sf-text dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Clear trades
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[34%] min-w-[10rem] shrink-0 flex-col border-r border-sf-border dark:border-zinc-700">
            <div className="shrink-0 border-b border-sf-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:border-zinc-700 dark:text-zinc-400">
              Notes
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {filteredNotes.length === 0 ? (
                <li className="px-3 py-4 text-sm text-sf-text-secondary dark:text-zinc-400">
                  No notes for this filter.
                </li>
              ) : (
                filteredNotes.map((n, index) => {
                  const active = n.id === selectedNoteId;
                  const preview = n.note.trim() ? noteIndexPreview(n.note) : "New note";
                  return (
                    <li key={projectNoteListKey(n, index)}>
                      <button
                        type="button"
                        onClick={() => {
                          if (n.id === selectedNoteId) return;
                          attemptLeave(() => setSelectedNoteId(n.id));
                        }}
                        className={`block w-full border-b border-sf-border px-3 py-2.5 text-left transition dark:border-zinc-700 ${
                          active
                            ? "bg-emerald-50 dark:bg-emerald-950/35"
                            : "bg-sf-surface hover:bg-sf-page dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
                        }`}
                      >
                        <span className="block min-w-0 w-full truncate font-mono text-sm text-sf-text dark:text-zinc-100" title={preview}>
                          {preview}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-sf-text-weak dark:text-zinc-400">
                          {n.notetype} · {formatProjectNoteTrades(n.trades)}
                          {noteSkuId(n)
                            ? ` · ${skuLabelForNote(noteSkuId(n))}`
                            : ""}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {onClose ? (
              <div className="shrink-0 border-t border-sf-border bg-sf-surface px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
                <button
                  type="button"
                  className="min-h-10 rounded-lg border border-sf-border-strong bg-sf-surface px-4 py-2 text-sm font-medium text-sf-text hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  onClick={() => attemptLeave(() => onClose())}
                >
                  Close
                </button>
              </div>
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div
              className={`flex shrink-0 items-center border-b border-sf-border bg-sf-surface dark:border-zinc-700 dark:bg-zinc-900/50 ${
                compactLayout ? "px-4 py-2" : "px-5 py-2.5"
              }`}
            >
              <button
                type="button"
                disabled={disabled || creating}
                onClick={() => handleNewNote()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sf-border-strong bg-sf-surface px-3 text-sm font-semibold text-sf-text hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <IconPlus className="h-4 w-4" />
                {creating ? "Creating…" : "New note"}
              </button>
            </div>
            <div
              className={`min-h-0 flex-1 overflow-y-auto border-l-4 border-sf-brand bg-[#f0f4f8]/80 dark:border-sf-accent dark:bg-slate-950/40 ${
                compactLayout ? "px-4 py-2.5" : "px-5 py-4"
              }`}
            >
              {selectedNote ? (
                <div className={compactLayout ? "space-y-3" : "space-y-4"}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-sf-brand dark:text-zinc-100">
                      {isEmptyStub(selectedNote) ? "New note" : "Note"}
                    </h3>
                    <div className="flex shrink-0 items-center gap-2">
                      {onUpdateNote ? (
                        <button
                          type="button"
                          disabled={
                            fieldsLocked ||
                            deletingId === selectedNote.id ||
                            !editDirty ||
                            !editNoteText.trim()
                          }
                          title={
                            !editNoteText.trim()
                              ? "Enter note text to save"
                              : !editDirty
                                ? "No changes to save"
                                : "Save note"
                          }
                          onClick={() => void handleSaveEdit()}
                          className="inline-flex h-8 items-center rounded-lg bg-sf-accent px-3 text-xs font-semibold text-white hover:bg-sf-accent-hover disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      ) : null}
                      {onDeleteNote ? (
                        <button
                          type="button"
                          disabled={deletingId === selectedNote.id}
                          onClick={() => setDeleteOpen(true)}
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-red-300 bg-sf-surface px-2.5 text-xs font-medium text-sf-destructive hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950/40"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={`grid w-full max-w-xl grid-cols-[6.5rem_minmax(0,1fr)] justify-items-start text-left text-sm ${
                      compactLayout ? "gap-x-3 gap-y-2" : "gap-x-4 gap-y-3"
                    }`}
                  >
                    <div className="font-medium text-sf-text-secondary dark:text-zinc-400">Area</div>
                    <div className="max-w-full text-left text-sf-text dark:text-zinc-100">
                      {areaLabelForNote(selectedNote.areaid)}
                    </div>
                    <div className="pt-1 font-medium text-sf-text-secondary dark:text-zinc-400">
                      Object
                    </div>
                    <div className="w-full min-w-0">
                      <select
                        className={`${selectBase} w-full min-w-0`}
                        value={editObjectid == null ? "" : String(editObjectid)}
                        disabled={
                          fieldsLocked || !onUpdateNote || selectedNote.areaid == null
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = raw === "" ? null : Number(raw);
                          setEditObjectid(Number.isInteger(next) ? next : null);
                          setEditSkuId(null);
                        }}
                      >
                        <option value="">None (area note)</option>
                        {editObjectOptions.map((o) => (
                          <option key={`edit-object-${o.objectid}`} value={String(o.objectid)}>
                            {o.label}
                          </option>
                        ))}
                        {editObjectid != null &&
                        !editObjectOptions.some((o) => o.objectid === editObjectid) ? (
                          <option value={String(editObjectid)}>
                            {objectLabelForNote(selectedNote.areaid, editObjectid)}
                          </option>
                        ) : null}
                      </select>
                    </div>
                    <div className="pt-1 font-medium text-sf-text-secondary dark:text-zinc-400">
                      SKU
                    </div>
                    <div className="w-full min-w-0">
                      <select
                        className={`${selectBase} w-full min-w-0`}
                        value={editSkuId ?? ""}
                        disabled={fieldsLocked || !onUpdateNote || editObjectid == null}
                        onChange={(e) => setEditSkuId(e.target.value.trim() || null)}
                      >
                        <option value="">None (object note)</option>
                        {editSkuOptions.map((s) => (
                          <option key={`edit-sku-${s.skuId}`} value={s.skuId}>
                            {s.label}
                          </option>
                        ))}
                        {editSkuId &&
                        !editSkuOptions.some((s) => s.skuId === editSkuId) ? (
                          <option value={editSkuId}>{skuLabelForNote(editSkuId)}</option>
                        ) : null}
                      </select>
                    </div>
                    <div className="pt-1 font-medium text-sf-text-secondary dark:text-zinc-400">
                      Type
                    </div>
                    <div>
                      <select
                        className={selectBase}
                        value={editNotetype || editTypeOptions[0]}
                        disabled={fieldsLocked || !onUpdateNote}
                        onChange={(e) => setEditNotetype(e.target.value)}
                      >
                        {editTypeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pt-1 font-medium text-sf-text-secondary dark:text-zinc-400">
                      Trades
                      <span className="mt-0.5 block font-normal normal-case text-sf-text-weak">
                        (optional)
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-start gap-1.5">
                      {PROJECT_NOTE_TRADE_TAGS.map((tag) => {
                        const on = editTrades.has(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            disabled={fieldsLocked || !onUpdateNote}
                            onClick={() => toggleEditTradeTag(tag)}
                            className={on ? tradeTagEditOnClass : tradeTagOffClass}
                            aria-pressed={on}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    <div className="font-medium text-sf-text-secondary dark:text-zinc-400">Author</div>
                    <div className="max-w-full text-left text-sf-text dark:text-zinc-100">{selectedNote.author || "—"}</div>
                    <div className="font-medium text-sf-text-secondary dark:text-zinc-400">Date</div>
                    <div className="max-w-full text-left text-sf-text dark:text-zinc-100">
                      {formatProjectNoteDate(selectedNote.notedatetime)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                      Note
                    </p>
                    <textarea
                      ref={editTextareaRef}
                      className={`${inputLong} ${compactLayout ? "min-h-[8rem]" : "min-h-[10rem]"} resize-y`}
                      rows={compactLayout ? 6 : 8}
                      value={editNoteText}
                      disabled={fieldsLocked || !onUpdateNote}
                      placeholder="Note text…"
                      onChange={(e) => setEditNoteText(e.target.value)}
                    />
                  </div>
                  {editError ? (
                    <p className="text-xs text-sf-destructive dark:text-red-400">{editError}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                  Select a note from the list, or click New note to create one.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPrintReport ? (
        <ProjectNotesPrintReport
          projectName={projectName}
          filterLabel={filterLabel}
          notes={filteredNotes}
          areaLabelForNote={areaLabelForNote}
          objectLabelForNote={objectLabelForNote}
          skuLabelForNote={skuLabelForNote}
        />
      ) : null}

      <ConfirmDialog
        open={discardOpen}
        title={isEmptyStub(selectedNote) ? "Discard new note?" : "Discard unsaved changes?"}
        description={
          isEmptyStub(selectedNote)
            ? "This note has no saved text yet. It will be deleted."
            : "Your edits to this note will be lost."
        }
        confirmLabel={isEmptyStub(selectedNote) ? "Discard note" : "Discard changes"}
        cancelLabel="Keep editing"
        variant="danger"
        onCancel={() => {
          pendingLeaveRef.current = null;
          setDiscardOpen(false);
        }}
        onConfirm={() => confirmDiscard()}
      />

      <ConfirmDialog
        open={deleteOpen && Boolean(selectedNote)}
        title="Delete this note?"
        description={
          selectedNote ? (
            <>
              <p>
                This permanently deletes the note
                {selectedNote.areaid != null
                  ? ` for ${areaLabelForNote(selectedNote.areaid)}`
                  : " at project level"}
                {selectedNote.objectid != null
                  ? ` · ${objectLabelForNote(selectedNote.areaid, selectedNote.objectid)}`
                  : ""}
                {noteSkuId(selectedNote) ? ` · ${skuLabelForNote(noteSkuId(selectedNote))}` : ""}.
                This cannot be undone.
              </p>
              <p className="mt-3 rounded-md border border-sf-border bg-sf-page px-3 py-2 font-mono text-sm text-sf-text dark:border-zinc-600 dark:bg-zinc-950">
                {selectedNote.note.trim() || "Empty note"}
              </p>
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete note"
        cancelLabel="Cancel"
        variant="danger"
        pending={deletingId === selectedNote?.id}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (selectedNote) void handleDelete(selectedNote.id);
        }}
      />
    </>
  );
}
