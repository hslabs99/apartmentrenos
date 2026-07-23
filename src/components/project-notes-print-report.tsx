"use client";

import { formatProjectNoteDate } from "@/lib/project-note-display";
import { formatProjectNoteTrades } from "@/lib/project-note-trades";
import {
  projectNoteListKey,
  type ProjectNoteViewFilter,
} from "@/lib/project-note-filters";
import type { ProjectNotePublic } from "@/types/project-note";

type Props = {
  projectName: string;
  filterLabel: string;
  notes: ProjectNotePublic[];
  areaLabelForNote: (areaid: number | null) => string;
  objectLabelForNote: (areaid: number | null, objectid: number | null) => string;
  printedAt?: Date;
};

export function ProjectNotesPrintReport({
  projectName,
  filterLabel,
  notes,
  areaLabelForNote,
  objectLabelForNote,
  printedAt = new Date(),
}: Props) {
  const printedLabel = formatProjectNoteDate(printedAt.toISOString());

  return (
    <div
      id="project-notes-print-report"
      className="hidden print:block"
      aria-hidden
    >
      <header className="mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-xl font-bold text-black">Project notes report</h1>
        <p className="mt-1 text-sm text-zinc-700">
          <span className="font-medium">Project:</span> {projectName}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Filter:</span> {filterLabel}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Printed:</span> {printedLabel}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Notes:</span> {notes.length}
        </p>
      </header>

      {notes.length === 0 ? (
        <p className="text-sm text-zinc-600">No notes match the current filter.</p>
      ) : (
        <div className="space-y-6">
          {notes.map((n, index) => (
            <article
              key={projectNoteListKey(n, index)}
              className="break-inside-avoid border border-zinc-300 rounded p-4"
            >
              <h2 className="text-base font-semibold text-black">
                Note {index + 1}
                {n.noteid ? ` · #${n.noteid}` : ""}
              </h2>
              <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-sm text-black">
                <dt className="font-medium text-zinc-600">Area</dt>
                <dd>{areaLabelForNote(n.areaid)}</dd>
                <dt className="font-medium text-zinc-600">Object</dt>
                <dd>{objectLabelForNote(n.areaid, n.objectid)}</dd>
                <dt className="font-medium text-zinc-600">Type</dt>
                <dd>{n.notetype || "—"}</dd>
                <dt className="font-medium text-zinc-600">Trades</dt>
                <dd>{formatProjectNoteTrades(n.trades)}</dd>
                <dt className="font-medium text-zinc-600">Author</dt>
                <dd>{n.author || "—"}</dd>
                <dt className="font-medium text-zinc-600">Date</dt>
                <dd>{formatProjectNoteDate(n.notedatetime)}</dd>
              </dl>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-black">
                {n.note.trim() || "—"}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function projectNotesFilterLabel(
  filter: ProjectNoteViewFilter,
  areaLabelForId: (areaid: number) => string | undefined,
  objectLabelForId: (objectid: number) => string | undefined,
): string {
  const areaid = filter.areaid ?? null;
  const objectid = filter.objectid ?? null;
  let scope: string;
  if (areaid == null && objectid == null) {
    scope = "All areas · all objects";
  } else if (areaid != null && objectid != null) {
    const area = areaLabelForId(areaid) ?? `Area ${areaid}`;
    const obj = objectLabelForId(objectid) ?? `Object ${objectid}`;
    scope = `${area} · ${obj}`;
  } else if (areaid != null) {
    scope = `${areaLabelForId(areaid) ?? `Area ${areaid}`} · all objects`;
  } else {
    scope = `All areas · ${objectLabelForId(objectid!) ?? `Object ${objectid}`}`;
  }

  const tradeTags = (filter.trades ?? []).map((t) => t.trim()).filter(Boolean);
  const notetypeTags = (filter.notetypes ?? []).map((t) => t.trim()).filter(Boolean);
  const parts: string[] = [scope];
  if (notetypeTags.length > 0) parts.push(`Types: ${notetypeTags.join(", ")}`);
  if (tradeTags.length > 0) parts.push(`Trades: ${tradeTags.join(", ")}`);
  return parts.join(" · ");
}
