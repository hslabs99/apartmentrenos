"use client";

import type { WbPaintLitresReportData } from "@/lib/workbench-paint-litres-report";
import { formatProjectNoteDate } from "@/lib/project-note-display";
import { formatMoney } from "@/lib/client/format-money";

type Props = {
  data: WbPaintLitresReportData;
};

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(n);
}

export function WorkbenchPaintLitresPrintReport({ data }: Props) {
  const printedLabel = formatProjectNoteDate(data.printedAt.toISOString());
  const parentLineCount = data.areas.reduce((sum, a) => sum + a.parentLines.length, 0);
  const detailRowCount = data.areas.reduce(
    (sum, a) => sum + a.parentLines.reduce((s, p) => s + p.detailRows.length, 0),
    0,
  );

  return (
    <div id="wb-paint-litres-print-report" className="hidden print:block" aria-hidden>
      <header className="mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-xl font-bold text-black">Paint Ltrs workbench report</h1>
        <p className="mt-1 text-sm text-zinc-700">
          <span className="font-medium">Project:</span> {data.projectName}
        </p>
        <p className="text-sm text-zinc-700">
          Included paint lines exploded from Painting Elements — litres from L/m² × total m².
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Printed:</span> {printedLabel}
        </p>
        <p className="text-sm text-zinc-700">
          <span className="font-medium">Areas:</span> {data.areas.length} ·{" "}
          <span className="font-medium">Paint lines:</span> {parentLineCount} ·{" "}
          <span className="font-medium">Detail rows:</span> {detailRowCount}
          {data.missingElementCount > 0 ? (
            <>
              {" "}
              ·{" "}
              <span className="font-semibold text-red-700">
                Missing element: {data.missingElementCount}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {data.missingElementCount > 0 ? (
        <section className="mb-6 rounded border-2 border-red-600 bg-red-50 p-4 text-sm text-red-950">
          <p className="font-semibold">
            {data.missingElementCount} included paint line
            {data.missingElementCount === 1 ? " has" : "s have"} no Painting Elements matrix (red
            flag). Import Painting Elements and ensure SKU product matches element SKU Name.
          </p>
        </section>
      ) : null}

      {data.areas.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No included paint lines with a SKU product found on this project.
        </p>
      ) : (
        <div className="space-y-8">
          {data.areas.map((area) => (
            <section key={area.areaid} className="break-inside-avoid">
              <h2 className="border-b border-zinc-300 pb-1 text-base font-semibold text-black">
                {area.label}
                {area.missingElementCount > 0 ? (
                  <span className="ml-2 text-sm font-semibold text-red-700">
                    ({area.missingElementCount} missing element
                    {area.missingElementCount === 1 ? "" : "s"})
                  </span>
                ) : null}
              </h2>

              <div className="mt-4 space-y-5">
                {area.parentLines.map((parent) => (
                  <article
                    key={parent.lineId}
                    className={`break-inside-avoid rounded border p-4 ${
                      parent.missingElement
                        ? "border-red-600 bg-red-50"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    <h3 className="text-sm font-semibold text-black">{parent.description}</h3>
                    <p className="mt-1 text-sm text-zinc-800">
                      SKU product: <strong>{parent.skuProduct}</strong> · {formatQty(parent.measure)}{" "}
                      {parent.uom}
                    </p>
                    {parent.missingElement ? (
                      <p className="mt-2 text-sm font-semibold text-red-800">
                        RED FLAG — No Painting Elements matrix for SKU product &quot;
                        {parent.skuProduct}&quot;. Cannot calculate paint litres until Painting
                        Elements is imported and configured.
                      </p>
                    ) : parent.detailRows.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-600">
                        Element &quot;{parent.elementSkuName}&quot; has no paint material rows
                        (L/m²).
                      </p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full border-collapse text-sm text-black">
                          <thead>
                            <tr className="border-b border-zinc-300 text-left text-xs text-zinc-600">
                              <th className="py-1 pr-3 font-medium">Paint type</th>
                              <th className="py-1 pr-3 text-right font-medium">Unit m²</th>
                              <th className="py-1 pr-3 text-right font-medium">Total m²</th>
                              <th className="py-1 pr-3 text-right font-medium">L/m²</th>
                              <th className="py-1 text-right font-medium">Litres</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parent.detailRows.map((row, idx) => (
                              <tr
                                key={`${row.paintType}-${idx}`}
                                className="border-b border-zinc-200 align-top"
                              >
                                <td className="py-2 pr-3">{row.paintType}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {formatQty(row.unitM2)}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums font-medium">
                                  {formatQty(row.totalM2)}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">
                                  {row.litrePerM2 == null ? "—" : formatQty(row.litrePerM2)}
                                </td>
                                <td className="py-2 text-right tabular-nums font-medium">
                                  {row.totalLitres == null ? "—" : formatQty(row.totalLitres)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {area.totals.length > 0 ? (
                <div className="mt-5 overflow-x-auto">
                  <h3 className="text-sm font-semibold text-black">Area totals by paint type</h3>
                  <table className="mt-2 w-full max-w-xl border-collapse text-sm text-black">
                    <thead>
                      <tr className="border-b border-zinc-300 text-left text-xs text-zinc-600">
                        <th className="py-1 pr-3 font-medium">Paint type</th>
                        <th className="py-1 pr-3 text-right font-medium">Total m²</th>
                        <th className="py-1 text-right font-medium">Total litres</th>
                      </tr>
                    </thead>
                    <tbody>
                      {area.totals.map((row) => (
                        <tr key={row.paintType} className="border-b border-zinc-200">
                          <td className="py-2 pr-3 font-medium">{row.paintType}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatQty(row.totalM2)}
                          </td>
                          <td className="py-2 text-right tabular-nums font-semibold">
                            {formatQty(row.totalLitres)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}

          {data.projectTotals.length > 0 ? (
            <section className="break-inside-avoid border-t-2 border-zinc-400 pt-4">
              <h2 className="text-base font-semibold text-black">Project totals by paint type</h2>
              <table className="mt-2 w-full max-w-xl border-collapse text-sm text-black">
                <thead>
                  <tr className="border-b border-zinc-300 text-left text-xs text-zinc-600">
                    <th className="py-1 pr-3 font-medium">Paint type</th>
                    <th className="py-1 pr-3 text-right font-medium">Total m²</th>
                    <th className="py-1 text-right font-medium">Total litres</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projectTotals.map((row) => (
                    <tr key={row.paintType} className="border-b border-zinc-200">
                      <td className="py-2 pr-3 font-medium">{row.paintType}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatQty(row.totalM2)}
                      </td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {formatQty(row.totalLitres)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {data.siteFeeExcGst != null ? (
            <section className="mt-8 break-inside-avoid border-t-2 border-zinc-400 pt-4">
              <h2 className="text-base font-semibold text-black">Project charges</h2>
              <p className="mt-1 text-sm text-zinc-700">
                One site setup fee when the project has paint consumption (not on a line item).
              </p>
              <table className="mt-3 w-full max-w-xl border-collapse text-sm text-black">
                <tbody>
                  <tr className="border-b border-zinc-200">
                    <td className="py-2 pr-3 font-medium">{data.siteFeeLabel}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(data.siteFeeExcGst)}</td>
                  </tr>
                  <tr className="border-b border-zinc-200">
                    <td className="py-2 pr-3 font-medium">
                      {data.siteFeeLabel} (incl. {data.marginPct}% margin)
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">
                      {data.siteFeeWithMarginExcGst != null
                        ? formatMoney(data.siteFeeWithMarginExcGst)
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
