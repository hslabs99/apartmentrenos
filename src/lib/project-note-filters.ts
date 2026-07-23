import { DEFAULT_NOTE_TYPE } from "@/lib/project-note-types";
import type { ProjectNotePublic } from "@/types/project-note";

export type ProjectNoteTarget = {
  projectid: number;
  areaid?: number | null;
  objectid?: number | null;
};

function isProjectLevelNote(note: ProjectNotePublic): boolean {
  return note.areaid == null && note.objectid == null;
}

function isAreaLevelNote(note: ProjectNotePublic): boolean {
  return note.areaid != null && note.objectid == null;
}

function isObjectLevelNote(note: ProjectNotePublic): boolean {
  return note.areaid != null && note.objectid != null;
}

/** Notes matching a project, area, or object target. */
export function filterNotesForTarget(
  notes: ProjectNotePublic[],
  target: ProjectNoteTarget,
): ProjectNotePublic[] {
  const { projectid, areaid, objectid } = target;
  return notes.filter((n) => {
    if (n.projectid !== projectid) return false;
    if (objectid != null && areaid != null) {
      return isObjectLevelNote(n) && n.areaid === areaid && n.objectid === objectid;
    }
    if (areaid != null) {
      return isAreaLevelNote(n) && n.areaid === areaid;
    }
    return isProjectLevelNote(n);
  });
}

export function sortNotesNewestFirst(notes: ProjectNotePublic[]): ProjectNotePublic[] {
  return [...notes].sort((a, b) => {
    const ta = a.notedatetime ?? a.createdAt ?? "";
    const tb = b.notedatetime ?? b.createdAt ?? "";
    return tb.localeCompare(ta);
  });
}

/** Popup view filter: null areaid/objectid = all (within parent scope). */
export type ProjectNoteViewFilter = {
  areaid?: number | null;
  objectid?: number | null;
  /** When non-empty, notes must include at least one of these trade tags. */
  trades?: string[];
  /** When non-empty, notes must match at least one of these note types. */
  notetypes?: string[];
};

export function noteHasTradeTag(note: ProjectNotePublic, tradeTag: string): boolean {
  const tag = tradeTag.trim();
  if (!tag) return false;
  return note.trades.map((t) => t.trim()).filter(Boolean).includes(tag);
}

function noteMatchesTradeFilter(note: ProjectNotePublic, filterTrades: readonly string[]): boolean {
  const tags = filterTrades.map((t) => t.trim()).filter(Boolean);
  if (tags.length === 0) return true;
  const noteTrades = new Set(note.trades.map((t) => t.trim()).filter(Boolean));
  return tags.some((t) => noteTrades.has(t));
}

function noteMatchesNotetypeFilter(note: ProjectNotePublic, filterNotetypes: readonly string[]): boolean {
  const types = filterNotetypes.map((t) => t.trim()).filter(Boolean);
  if (types.length === 0) return true;
  const noteType = (note.notetype || DEFAULT_NOTE_TYPE).trim();
  return types.includes(noteType);
}

/** Filter notes for the popup table (broader than a single button target). */
export function filterNotesForView(
  notes: ProjectNotePublic[],
  projectid: number,
  filter: ProjectNoteViewFilter,
): ProjectNotePublic[] {
  const pool = notes.filter((n) => n.projectid === projectid);
  const areaid = filter.areaid ?? null;
  const objectid = filter.objectid ?? null;

  let scoped: ProjectNotePublic[];
  if (areaid == null && objectid == null) {
    scoped = pool;
  } else if (areaid != null && objectid != null) {
    scoped = pool.filter(
      (n) => isObjectLevelNote(n) && n.areaid === areaid && n.objectid === objectid,
    );
  } else if (areaid != null) {
    scoped = pool.filter(
      (n) => n.areaid === areaid && (isAreaLevelNote(n) || isObjectLevelNote(n)),
    );
  } else if (objectid != null) {
    scoped = pool.filter((n) => isObjectLevelNote(n) && n.objectid === objectid);
  } else {
    scoped = pool;
  }

  const notetypeTags = filter.notetypes ?? [];
  const tradeTags = filter.trades ?? [];
  if (notetypeTags.length === 0 && tradeTags.length === 0) return scoped;
  return scoped.filter((n) => {
    if (!noteMatchesNotetypeFilter(n, notetypeTags)) return false;
    if (!noteMatchesTradeFilter(n, tradeTags)) return false;
    return true;
  });
}

/** Keep first label per areaid (projects may list the same catalog area more than once). */
export function uniqueNoteAreaOptionsByAreaId<T extends { areaid: number }>(
  options: T[],
): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const opt of options) {
    if (seen.has(opt.areaid)) continue;
    seen.add(opt.areaid);
    out.push(opt);
  }
  return out;
}

/** Keep first label per objectid. */
export function uniqueNoteObjectOptionsByObjectId<T extends { objectid: number }>(
  options: T[],
): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const opt of options) {
    if (seen.has(opt.objectid)) continue;
    seen.add(opt.objectid);
    out.push(opt);
  }
  return out;
}

/**
 * Stable React list key for a project note.
 * Prefer Firestore doc id; fall back to noteid + index if id is missing/blank.
 */
export function projectNoteListKey(note: ProjectNotePublic, index: number): string {
  const id = note.id?.trim();
  if (id) return id;
  if (note.noteid > 0) return `noteid-${note.noteid}`;
  return `note-idx-${index}`;
}

/** Drop duplicate notes by doc id (or noteid when id is blank). Keeps first occurrence. */
export function uniqueProjectNotes(notes: ProjectNotePublic[]): ProjectNotePublic[] {
  const seen = new Set<string>();
  const out: ProjectNotePublic[] = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]!;
    const key = projectNoteListKey(n, i);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}
