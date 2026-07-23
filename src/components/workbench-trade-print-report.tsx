"use client";

import { formatProjectNoteDate } from "@/lib/project-note-display";
import {
  formatWbTradeReportLineMatchSources,
  type WbTradeReportData,
} from "@/lib/workbench-trade-report";
import type { ProjectNotePublic } from "@/types/project-note";

type Props = {
  data: WbTradeReportData;
};

function NoteBlock({ notes }: { notes: ProjectNotePublic[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-2">
      {notes.map((n) => (
        <li key={n.id} className="rounded border border-zinc-300 bg-zinc-50 p-3 text-sm text-black">
          <p className="text-xs text-zinc-600">
            {n.notetype || "Note"}
            {n.author ? ` · ${n.author}` : ""}
            {n.notedatetime ? ` · ${formatProjectNoteDate(n.notedatetime)}` : ""}
          </p>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{n.note.trim() || "—"}</p>
        </li>
      ))}
    </ul>
  );
}

export function WorkbenchTradePrintReport({ data }: Props) {
  const printedLabel = formatProjectNoteDate(data.printedAt.toISOString());
  const objectCount = data.areas.reduce((sum, a) => sum + a.objects.length, 0);
  const lineCount = data.areas.reduce(
    (sum, a) => sum + a.objects.reduce((s, o) => s + o.lines.length, 0),
    0,
  );

  return (
    <div id="wb-trade-print-report" className="hidden print:block" aria-hidden>
      <header className="mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-xl font-bold text-black">{data.config.label} workbench report</h1>
        <p className="mt-1 text-sm text-zinc-700">
          <span className="font-medium">Project:</span> {data.projectName}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Trade:</span> {data.config.label}
        </p>
        <p className="text-sm text-zinc-700">
          Includes trade labour hours, {data.config.label.toLowerCase()} category items, and notes
          tagged {data.config.noteTradeTag}.
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Printed:</span> {printedLabel}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Areas:</span> {data.areas.length} ·{" "}
          <span className="font-medium">Objects:</span> {objectCount} ·{" "}
          <span className="font-medium">Lines:</span> {lineCount} ·{" "}
          <span className="font-medium">Project notes:</span> {data.projectNotes.length}
        </p>
      </header>

      {data.projectNotes.length > 0 ? (
        <section className="mb-8 break-inside-avoid">
          <h2 className="text-base font-semibold text-black">Project notes</h2>
          <NoteBlock notes={data.projectNotes} />
        </section>
      ) : null}

      {data.areas.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No areas, objects, or notes match this trade on the workbench.
        </p>
      ) : (
        <div className="space-y-8">
          {data.areas.map((area) => (
            <section key={area.areaid} className="break-inside-avoid">
              <h2 className="border-b border-zinc-300 pb-1 text-base font-semibold text-black">
                {area.label}
              </h2>

              {area.notes.length > 0 ? (
                <div className="mt-3">
                  <h3 className="text-sm font-medium text-zinc-800">Area notes</h3>
                  <NoteBlock notes={area.notes} />
                </div>
              ) : null}

              {area.objects.length > 0 ? (
                <div className="mt-4 space-y-5">
                  {area.objects.map((obj) => (
                    <article
                      key={`${area.areaid}-${obj.objectid}`}
                      className="break-inside-avoid border border-zinc-300 rounded p-4"
                    >
                      <h3 className="text-sm font-semibold text-black">{obj.label}</h3>

                      {obj.tradeLabourSummary ? (
                        <p className="mt-1 text-sm text-zinc-800">
                          <span className="font-medium">Trade labour:</span> {obj.tradeLabourSummary}
                        </p>
                      ) : null}

                      {obj.demolitionReportLabels && obj.demolitionReportLabels.length > 0 ? (
                        <div className="mt-2 rounded border border-amber-500 bg-amber-50 p-2 text-sm text-black">
                          <p className="font-semibold text-amber-950">Retain — do not remove</p>
                          <ul className="mt-1 list-disc pl-5 text-amber-950">
                            {obj.demolitionReportLabels.map((label) => (
                              <li key={label}>{label}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {obj.lines.length > 0 ? (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full border-collapse text-sm text-black">
                            <thead>
                              <tr className="border-b border-zinc-300 text-left text-xs text-zinc-600">
                                <th className="py-1 pr-3 font-medium">Description</th>
                                <th className="py-1 pr-3 font-medium">Product / SKU</th>
                                <th className="py-1 pr-3 font-medium">Measure</th>
                                <th className="py-1 pr-3 font-medium">UOM</th>
                                <th className="py-1 pr-3 font-medium">Labour</th>
                                <th className="py-1 pr-3 font-medium">Included via</th>
                                <th className="py-1 font-medium">Line notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {obj.lines.map((line) => (
                                <tr key={line.id} className="border-b border-zinc-200 align-top">
                                  <td className="py-2 pr-3">
                                    {line.bundled ? (
                                      <span className="text-zinc-500">↳ </span>
                                    ) : null}
                                    {line.description}
                                  </td>
                                  <td className="py-2 pr-3">{line.skuProduct}</td>
                                  <td className="py-2 pr-3 tabular-nums">{line.measure}</td>
                                  <td className="py-2 pr-3">{line.uom}</td>
                                  <td className="py-2 pr-3">{line.labourSummary}</td>
                                  <td className="py-2 pr-3">
                                    {formatWbTradeReportLineMatchSources(line.matchSources)}
                                  </td>
                                  <td className="py-2 whitespace-pre-wrap">{line.lineNotes || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {obj.notes.length > 0 ? (
                        <div className="mt-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                            Object notes
                          </h4>
                          <NoteBlock notes={obj.notes} />
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
