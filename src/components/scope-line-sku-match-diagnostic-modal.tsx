"use client";

import { ModalFrame } from "@/components/modal-frame";
import type { ScopeLineSkuMatchDiagnostic } from "@/lib/client/scope-line-sku-match-diagnostic";

type Props = {
  diagnostic: ScopeLineSkuMatchDiagnostic;
  objectLabel: string;
  onClose: () => void;
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-sf-border bg-sf-page p-3 text-[11px] leading-relaxed text-sf-text dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ScopeLineSkuMatchDiagnosticModal({ diagnostic, objectLabel, onClose }: Props) {
  return (
    <ModalFrame
      title="SKU match diagnostic"
      description={objectLabel}
      wide
      panelClassName="sm:max-w-3xl"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {diagnostic.summary}
        </div>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
            data_skus query
          </h3>
          <JsonBlock value={diagnostic.query} />
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
            Filter values (checklist / project)
          </h3>
          <JsonBlock value={diagnostic.filterSources} />
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
            Quote object
          </h3>
          <JsonBlock value={diagnostic.quoteObject} />
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
            Catalog loaded
          </h3>
          <JsonBlock value={diagnostic.catalogStats} />
        </section>

        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
            Filter pipeline
          </h3>
          <div className="overflow-x-auto rounded-md border border-sf-border dark:border-zinc-700">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="bg-sf-page text-sf-text-secondary dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Step</th>
                  <th className="px-2 py-1.5 font-medium">Filter</th>
                  <th className="px-2 py-1.5 font-medium tabular-nums">In</th>
                  <th className="px-2 py-1.5 font-medium tabular-nums">Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sf-border dark:divide-zinc-700">
                {diagnostic.pipeline.map((step) => (
                  <tr key={step.step} className={step.countOut === 0 && step.countIn > 0 ? "bg-red-50/80 dark:bg-red-950/20" : ""}>
                    <td className="px-2 py-1.5 font-medium">{step.label}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5 text-sf-text-secondary dark:text-zinc-400" title={step.filterValue}>
                      {step.filterOpen ? "(open / All)" : step.filterValue || "—"}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{step.countIn}</td>
                    <td className="px-2 py-1.5 tabular-nums">{step.countOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {diagnostic.pipeline.some((s) => s.rejectedSamples.length > 0) ? (
            <div className="mt-2 space-y-2">
              {diagnostic.pipeline
                .filter((s) => s.rejectedSamples.length > 0)
                .map((step) => (
                  <div key={`rej-${step.step}`}>
                    <p className="mb-1 text-[11px] font-medium text-sf-text-secondary dark:text-zinc-400">
                      Rejected at {step.label} (sample)
                    </p>
                    <ul className="space-y-1 text-[11px] text-sf-text dark:text-zinc-200">
                      {step.rejectedSamples.map((r) => (
                        <li
                          key={`${r.skuId}-${r.field}`}
                          className="rounded border border-sf-border px-2 py-1 dark:border-zinc-700"
                        >
                          <span className="font-medium">{r.skuId}</span> · {r.field}=
                          <span className="text-sf-text-secondary dark:text-zinc-400">
                            {r.skuValue}
                          </span>
                          <span className="mt-0.5 block text-sf-text-weak dark:text-zinc-500">
                            {r.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : null}
        </section>

        {diagnostic.catalogMatchSkuIds.length > 0 ? (
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
              SKUs after filters
            </h3>
            <p className="text-xs text-sf-text dark:text-zinc-200">
              {diagnostic.catalogMatchSkuIds.join(", ")}
            </p>
          </section>
        ) : null}
      </div>
    </ModalFrame>
  );
}
