"use client";

import { IconTrash } from "@/components/icons/lightning-icons";
import {
  ProjectNotesPrintReport,
  projectNotesFilterLabel,
} from "@/components/project-notes-print-report";
import { getCurrentUsername } from "@/lib/client/current-user";
import { formatProjectNoteDate, noteIndexPreview } from "@/lib/project-note-display";
import {
  filterNotesForView,
  sortNotesNewestFirst,
  type ProjectNoteTarget,
  type ProjectNoteViewFilter,
} from "@/lib/project-note-filters";
import {
  formatProjectNoteTrades,
  PROJECT_NOTE_TRADE_TAGS,
} from "@/lib/project-note-trades";
import { DEFAULT_NOTE_TYPE, ESCALATION_NOTE_TYPE } from "@/lib/project-note-types";
import type { ProjectNotePublic } from "@/types/project-note";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ProjectNoteAreaOption = { areaid: number; label: string };
export type ProjectNoteObjectOption = { objectid: number; label: string };

const inputLong =
  "w-full min-w-0 rounded border border-sf-border-strong bg-sf-surface px-2 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950";
const selectBase =
  "rounded border border-sf-border-strong bg-sf-surface px-1 py-1 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950";

const tradeTagOffClass =
  "rounded-full border border-zinc-300 bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 transition dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-400";
const tradeTagOnClass =
  "rounded-full border border-emerald-600 bg-emerald-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition dark:border-emerald-500 dark:bg-emerald-500";

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
  areaLabelForNote: (areaid: number | null) => string;
  objectLabelForNote: (areaid: number | null, objectid: number | null) => string;
  noteTypeOptions: string[];
  authorFallback?: string;
  disabled?: boolean;
  showPrintReport?: boolean;
  headerActions?: ReactNode;
  className?: string;
  /** Pre-select note type in the add-note form (e.g. Escalation). */
  initialDraftNotetype?: string;
  /** Focus the add-note text field when the browser mounts (e.g. after escalating an area). */
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

export function ProjectNotesBrowser({
  projectName,
  projectid,
  allProjectNotes,
  createTarget,
  attachNotesToFilter = false,
  initialViewFilter,
  areaOptions,
  objectOptionsForArea,
  areaLabelForNote,
  objectLabelForNote,
  noteTypeOptions,
  authorFallback = "",
  disabled = false,
  showPrintReport = false,
  headerActions,
  className = "",
  initialDraftNotetype,
  focusDraftOnMount = false,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: ProjectNotesBrowserProps) {
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState("");
  const [draftNotetype, setDraftNotetype] = useState(DEFAULT_NOTE_TYPE);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editTrades, setEditTrades] = useState<Set<string>>(() => new Set());
  const [editNoteText, setEditNoteText] = useState("");
  const [editNotetype, setEditNotetype] = useState(DEFAULT_NOTE_TYPE);
  const [editError, setEditError] = useState<string | null>(null);
  const [filterAreaid, setFilterAreaid] = useState<number | null>(
    initialViewFilter?.areaid ?? null,
  );
  const [filterObjectid, setFilterObjectid] = useState<number | null>(
    initialViewFilter?.objectid ?? null,
  );
  const [filterTrades, setFilterTrades] = useState<Set<string>>(
    () => new Set(initialViewFilter?.trades ?? []),
  );
  const [filterNotetypes, setFilterNotetypes] = useState<Set<string>>(
    () => new Set(initialViewFilter?.notetypes ?? []),
  );
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const typeOptions = useMemo(() => {
    const base =
      noteTypeOptions.length > 0
        ? noteTypeOptions
        : ["General", "Style", "Demolition", "Other", ESCALATION_NOTE_TYPE];
    if (base.some((t) => t === ESCALATION_NOTE_TYPE)) return base;
    return [...base, ESCALATION_NOTE_TYPE];
  }, [noteTypeOptions]);

  useEffect(() => {
    if (!initialDraftNotetype) return;
    setDraftNotetype(initialDraftNotetype);
  }, [initialDraftNotetype]);

  useEffect(() => {
    if (!focusDraftOnMount) return;
    setSelectedNoteId(null);
    const timer = window.setTimeout(() => {
      draftTextareaRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [focusDraftOnMount]);

  const objectOptions = useMemo(
    () => objectOptionsForArea(filterAreaid),
    [objectOptionsForArea, filterAreaid],
  );

  const filteredNotes = useMemo(
    () =>
      sortNotesNewestFirst(
        filterNotesForView(allProjectNotes, projectid, {
          areaid: filterAreaid,
          objectid: filterObjectid,
          trades: filterTrades.size > 0 ? [...filterTrades] : undefined,
          notetypes: filterNotetypes.size > 0 ? [...filterNotetypes] : undefined,
        }),
      ),
    [allProjectNotes, projectid, filterAreaid, filterObjectid, filterTrades, filterNotetypes],
  );

  const selectedNote = useMemo(
    () => filteredNotes.find((n) => n.id === selectedNoteId) ?? null,
    [filteredNotes, selectedNoteId],
  );

  const effectiveCreateTarget = useMemo((): ProjectNoteTarget => {
    if (!attachNotesToFilter) return createTarget;
    return {
      projectid,
      areaid: filterAreaid,
      objectid: filterObjectid,
    };
  }, [attachNotesToFilter, createTarget, projectid, filterAreaid, filterObjectid]);

  const filterLabel = useMemo(
    () =>
      projectNotesFilterLabel(
        {
          areaid: filterAreaid,
          objectid: filterObjectid,
          trades: filterTrades.size > 0 ? [...filterTrades] : undefined,
          notetypes: filterNotetypes.size > 0 ? [...filterNotetypes] : undefined,
        },
        (areaid) => areaLabelForNote(areaid),
        (objectid) => {
          for (const n of allProjectNotes) {
            if (n.objectid === objectid) {
              return objectLabelForNote(n.areaid, objectid);
            }
          }
          return `Object ${objectid}`;
        },
      ),
    [filterAreaid, filterObjectid, filterTrades, filterNotetypes, areaLabelForNote, objectLabelForNote, allProjectNotes],
  );

  useEffect(() => {
    if (filteredNotes.length === 0) {
      setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !filteredNotes.some((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, selectedNoteId]);

  useEffect(() => {
    if (!selectedNote) {
      setEditTrades(new Set());
      setEditNoteText("");
      setEditNotetype(DEFAULT_NOTE_TYPE);
      setEditError(null);
      return;
    }
    setEditTrades(new Set(selectedNote.trades));
    setEditNoteText(selectedNote.note);
    setEditNotetype(selectedNote.notetype || DEFAULT_NOTE_TYPE);
    setEditError(null);
  }, [selectedNote]);

  const editDirty = useMemo(() => {
    if (!selectedNote) return false;
    const text = editNoteText.trim();
    return (
      text !== selectedNote.note.trim() ||
      (editNotetype || DEFAULT_NOTE_TYPE) !== (selectedNote.notetype || DEFAULT_NOTE_TYPE) ||
      !tradesSortedEqual(editTrades, selectedNote.trades)
    );
  }, [selectedNote, editNoteText, editNotetype, editTrades]);

  function toggleTradeTag(tag: string) {
    setSelectedTrades((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function toggleEditTradeTag(tag: string) {
    setEditTrades((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function onAreaFilterChange(raw: string) {
    const next = raw === "" ? null : Number(raw);
    setFilterAreaid(Number.isInteger(next) ? next : null);
    setFilterObjectid(null);
    setSelectedNoteId(null);
  }

  function onObjectFilterChange(raw: string) {
    const next = raw === "" ? null : Number(raw);
    setFilterObjectid(Number.isInteger(next) ? next : null);
    setSelectedNoteId(null);
  }

  function toggleFilterNotetype(notetype: string) {
    setFilterNotetypes((prev) => {
      const next = new Set(prev);
      if (next.has(notetype)) next.delete(notetype);
      else next.add(notetype);
      return next;
    });
    setSelectedNoteId(null);
  }

  function toggleFilterTrade(tag: string) {
    setFilterTrades((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
    setSelectedNoteId(null);
  }

  async function handleAdd() {
    const text = draft.trim();
    if (!text) {
      setFormError("Enter note text.");
      return;
    }
    const trades = [...selectedTrades];
    const author = getCurrentUsername() || authorFallback.trim() || "Unknown";
    setSaving(true);
    setFormError(null);
    try {
      await onCreateNote(effectiveCreateTarget, {
        notetype: draftNotetype || DEFAULT_NOTE_TYPE,
        trades,
        author,
        note: text,
      });
      setDraft("");
      setDraftNotetype(DEFAULT_NOTE_TYPE);
      setSelectedTrades(new Set());
      setSelectedNoteId(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

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
    try {
      await onDeleteNote(noteId);
      if (selectedNoteId === noteId) setSelectedNoteId(null);
    } finally {
      setDeletingId(null);
    }
  }

  function handlePrintReport() {
    window.print();
  }

  const filterAreaValue = filterAreaid == null ? "" : String(filterAreaid);
  const filterObjectValue = filterObjectid == null ? "" : String(filterObjectid);
  const formDisabled = disabled || saving;

  return (
    <>
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-sf-border bg-sf-surface dark:border-zinc-700 dark:bg-zinc-900/50 ${className}`.trim()}
      >
        <div className="shrink-0 space-y-2 border-b border-sf-border px-4 py-3 dark:border-zinc-700">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[10rem] flex-col gap-0.5 text-xs">
              <span className="font-medium text-sf-text-secondary dark:text-zinc-400">Area</span>
              <select
                className={selectBase}
                value={filterAreaValue}
                disabled={formDisabled}
                onChange={(e) => onAreaFilterChange(e.target.value)}
              >
                <option value="">All areas</option>
                {areaOptions.map((a) => (
                  <option key={a.areaid} value={String(a.areaid)}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-col gap-0.5 text-xs">
              <span className="font-medium text-sf-text-secondary dark:text-zinc-400">Object</span>
              <select
                className={selectBase}
                value={filterObjectValue}
                disabled={formDisabled}
                onChange={(e) => onObjectFilterChange(e.target.value)}
              >
                <option value="">All objects</option>
                {objectOptions.map((o) => (
                  <option key={o.objectid} value={String(o.objectid)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="pb-1 text-xs text-sf-text-weak dark:text-zinc-400">
              {filteredNotes.length} note{filteredNotes.length === 1 ? "" : "s"}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2 pb-0.5 print:hidden">
            {showPrintReport ? (
              <button
                type="button"
                disabled={formDisabled}
                onClick={handlePrintReport}
                className="min-h-9 rounded-lg border border-sf-border-strong bg-sf-surface px-3 text-sm font-medium text-sf-text hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                Print report
              </button>
            ) : null}
            {headerActions}
            </div>
          </div>
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
                    disabled={formDisabled}
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
                disabled={formDisabled}
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
                    disabled={formDisabled}
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
                disabled={formDisabled}
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
                filteredNotes.map((n) => {
                  const active = n.id === selectedNoteId;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedNoteId(n.id)}
                        className={`block w-full border-b border-sf-border px-3 py-2.5 text-left transition dark:border-zinc-700 ${
                          active
                            ? "bg-emerald-50 dark:bg-emerald-950/35"
                            : "bg-sf-surface hover:bg-sf-page dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
                        }`}
                      >
                        <span className="block truncate font-mono text-sm text-sf-text dark:text-zinc-100">
                          {noteIndexPreview(n.note)}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-sf-text-weak dark:text-zinc-400">
                          {n.notetype} · {formatProjectNoteTrades(n.trades)}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {selectedNote ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
                      Edit note
                    </h3>
                    <div className="flex shrink-0 items-center gap-2">
                      {onUpdateNote ? (
                        <button
                          type="button"
                          disabled={
                            formDisabled ||
                            deletingId === selectedNote.id ||
                            !editDirty ||
                            !editNoteText.trim()
                          }
                          onClick={() => void handleSaveEdit()}
                          className="inline-flex h-8 items-center rounded-lg bg-sf-brand px-3 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      ) : null}
                      {onDeleteNote ? (
                        <button
                          type="button"
                          disabled={deletingId === selectedNote.id || formDisabled}
                          onClick={() => void handleDelete(selectedNote.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-sf-border-strong px-2.5 text-xs font-medium text-sf-text-weak hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <dl className="grid grid-cols-[minmax(5rem,auto)_1fr] items-start gap-x-4 gap-y-3 text-sm">
                    <dt className="font-medium text-sf-text-secondary dark:text-zinc-400">Area</dt>
                    <dd className="text-sf-text dark:text-zinc-100">
                      {areaLabelForNote(selectedNote.areaid)}
                    </dd>
                    <dt className="font-medium text-sf-text-secondary dark:text-zinc-400">Object</dt>
                    <dd className="text-sf-text dark:text-zinc-100">
                      {objectLabelForNote(selectedNote.areaid, selectedNote.objectid)}
                    </dd>
                    <dt className="pt-1 font-medium text-sf-text-secondary dark:text-zinc-400">
                      Type
                    </dt>
                    <dd>
                      <select
                        className={selectBase}
                        value={editNotetype || typeOptions[0]}
                        disabled={formDisabled || !onUpdateNote}
                        onChange={(e) => setEditNotetype(e.target.value)}
                      >
                        {typeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </dd>
                    <dt className="pt-1 font-medium text-sf-text-secondary dark:text-zinc-400">
                      Trades <span className="font-normal normal-case text-sf-text-weak">(optional)</span>
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {PROJECT_NOTE_TRADE_TAGS.map((tag) => {
                        const on = editTrades.has(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            disabled={formDisabled || !onUpdateNote}
                            onClick={() => toggleEditTradeTag(tag)}
                            className={on ? tradeTagOnClass : tradeTagOffClass}
                            aria-pressed={on}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </dd>
                    <dt className="font-medium text-sf-text-secondary dark:text-zinc-400">Author</dt>
                    <dd className="text-sf-text dark:text-zinc-100">{selectedNote.author || "—"}</dd>
                    <dt className="font-medium text-sf-text-secondary dark:text-zinc-400">Date</dt>
                    <dd className="text-sf-text dark:text-zinc-100">
                      {formatProjectNoteDate(selectedNote.notedatetime)}
                    </dd>
                  </dl>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                      Note
                    </p>
                    <textarea
                      className={`${inputLong} min-h-[6rem] resize-y`}
                      rows={4}
                      value={editNoteText}
                      disabled={formDisabled || !onUpdateNote}
                      onChange={(e) => setEditNoteText(e.target.value)}
                    />
                  </div>
                  {editError ? (
                    <p className="text-xs text-sf-destructive dark:text-red-400">{editError}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                  Select a note from the list, or add a new note below.
                </p>
              )}
            </div>

            <div className="shrink-0 border-t border-sf-border px-5 py-4 dark:border-zinc-700">
              <h4 className="mb-2 text-sm font-semibold text-sf-text dark:text-zinc-100">
                Add note
              </h4>
              <p className="mb-2 text-xs text-sf-text-weak dark:text-zinc-400">
                Saves to: {areaLabelForNote(effectiveCreateTarget.areaid ?? null)}
                {effectiveCreateTarget.objectid != null
                  ? ` · ${objectLabelForNote(
                      effectiveCreateTarget.areaid ?? null,
                      effectiveCreateTarget.objectid,
                    )}`
                  : ""}
              </p>
              <label className="mb-2 flex flex-col gap-0.5 text-xs">
                <span className="font-medium text-sf-text-secondary dark:text-zinc-400">Type</span>
                <select
                  className={selectBase}
                  value={draftNotetype || typeOptions[0]}
                  disabled={formDisabled}
                  onChange={(e) => setDraftNotetype(e.target.value)}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mb-2">
                <span className="mb-1.5 block text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                  Trades <span className="font-normal text-sf-text-weak">(optional)</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_NOTE_TRADE_TAGS.map((tag) => {
                    const on = selectedTrades.has(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={formDisabled}
                        onClick={() => toggleTradeTag(tag)}
                        className={on ? tradeTagOnClass : tradeTagOffClass}
                        aria-pressed={on}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <textarea
                ref={draftTextareaRef}
                className={`${inputLong} min-h-[4rem] resize-y`}
                rows={2}
                value={draft}
                disabled={formDisabled}
                placeholder="Note text…"
                onChange={(e) => setDraft(e.target.value)}
              />
              {formError ? (
                <p className="mt-1 text-xs text-sf-destructive dark:text-red-400">{formError}</p>
              ) : null}
              <button
                type="button"
                disabled={formDisabled || !draft.trim()}
                className="mt-2 min-h-10 rounded-lg bg-sf-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => void handleAdd()}
              >
                {saving ? "Saving…" : "Add note"}
              </button>
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
        />
      ) : null}
    </>
  );
}
