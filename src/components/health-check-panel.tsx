"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { consumeNdjsonStream } from "@/lib/client/consume-ndjson-stream";
import { readApiJson } from "@/lib/client/read-api-json";
import {
  formatMissingQuoteObjectItem,
  healthCheckIssueCount,
  missingQuoteObjectContext,
} from "@/lib/health-check/orphan-refs";
import { useViewMode } from "@/lib/view-mode";
import {
  sfDataSurface,
  sfNeutralToolbarButton,
  sfPrimaryToolbarButton,
  sfSectionHeading,
} from "@/lib/sf-layout";
import type {
  HealthCheckDeepProgress,
  HealthCheckProjectIssue,
  HealthCheckReport,
} from "@/types/health-check";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const deepScanButtonClass = `${sfPrimaryToolbarButton} min-h-11 px-6 text-base font-medium`;

const lineLinkClass =
  "font-medium text-blue-700 underline decoration-blue-700/70 underline-offset-2 hover:text-blue-900 dark:text-blue-400 dark:decoration-blue-400/70 dark:hover:text-blue-300";

function formatMissingList(issue: {
  missingItems: { id?: string; name?: string; beforeName?: string; afterName?: string }[];
  missingIds: string[];
  missingNames: string[];
}): string {
  if (issue.missingItems.length > 0) {
    return issue.missingItems
      .map((item) => {
        const title = formatMissingQuoteObjectItem(item);
        const context = missingQuoteObjectContext(item);
        return context ? `${title} (${context})` : title;
      })
      .join("; ");
  }
  return issue.missingNames.join(", ");
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "alert";
}) {
  const toneClass =
    tone === "alert"
      ? "text-red-800 dark:text-red-300"
      : tone === "ok"
        ? "text-emerald-800 dark:text-emerald-300"
        : "text-sf-text dark:text-zinc-100";
  return (
    <div className="rounded border border-sf-border bg-sf-surface px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function DeepScanProgressModal({
  open,
  percent,
  message,
  onCancel,
}: {
  open: boolean;
  percent: number;
  message: string;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-deep-progress-title"
    >
      <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2 id="health-deep-progress-title" className="text-lg font-semibold">
          Deep scan in progress
        </h2>
        <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">{message}</p>
        <div
          className="mt-4 h-3 overflow-hidden rounded-full bg-sf-page dark:bg-zinc-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className="h-full bg-sf-brand transition-[width] duration-300 ease-out dark:bg-[#58a9f5]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-right text-sm tabular-nums text-sf-text-secondary dark:text-zinc-400">
          {percent}%
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DeepScanDoneModal({
  open,
  skuCount,
  issueCount,
  onClose,
}: {
  open: boolean;
  skuCount: number;
  issueCount: number;
  onClose: () => void;
}) {
  if (!open) return null;
  const clear = issueCount === 0;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-deep-done-title"
    >
      <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2 id="health-deep-done-title" className="text-lg font-semibold">
          {clear ? "Quotes are clean" : "Reselect SKUs on live quotes"}
        </h2>
        <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
          {clear
            ? "No orphaned SKUs or objects on live projects or templates."
            : skuCount > 0
              ? `${skuCount} quote line${skuCount === 1 ? "" : "s"} still use a SKU that was removed from the master spreadsheet. Open a line and pick a replacement.`
              : `${issueCount} broken link${issueCount === 1 ? "" : "s"} found. Open each item below to fix it.`}
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white hover:bg-sf-brand-hover"
          >
            View report
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectIssueBlock({ issue }: { issue: HealthCheckProjectIssue }) {
  const skus = issue.missingSkus;
  const objects = issue.missingObjects;
  if (skus.length === 0 && objects.length === 0) return null;
  return (
    <div className="border-b border-sf-border px-4 py-3 last:border-0 md:px-5 dark:border-zinc-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={issue.href} className={lineLinkClass}>
          {issue.projectname}
        </Link>
        <span className="text-xs text-sf-text-weak dark:text-zinc-500">
          {issue.template ? "Template" : "Live"}
          {issue.projectid != null ? ` · #${issue.projectid}` : ""}
          {skus.length ? ` · ${skus.length} SKU${skus.length === 1 ? "" : "s"}` : ""}
          {objects.length ? ` · ${objects.length} object${objects.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {skus.map((line) => (
          <li key={`sku-${line.lineId}`}>
            <Link href={line.href} className={lineLinkClass}>
              {line.areaName} · {line.objectname}
            </Link>
            <span className="text-sf-text-secondary dark:text-zinc-400">
              {" — "}
              reselect {line.skuProduct || line.skuId}
            </span>
          </li>
        ))}
        {objects.map((line) => (
          <li key={`obj-${line.lineId}`}>
            <Link href={line.href} className={lineLinkClass}>
              {line.areaName} · {line.objectname}
            </Link>
            <span className="text-sf-text-secondary dark:text-zinc-400"> — missing object</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HealthCheckPanel() {
  const router = useRouter();
  const { canViewHealthCheck } = useViewMode();
  const [report, setReport] = useState<HealthCheckReport | null>(null);
  const [loadingFast, setLoadingFast] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeep, setConfirmDeep] = useState(false);
  const [deepRunning, setDeepRunning] = useState(false);
  const [deepPercent, setDeepPercent] = useState(0);
  const [deepMessage, setDeepMessage] = useState("Starting…");
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [doneSkuCount, setDoneSkuCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!canViewHealthCheck) {
      router.replace("/projects");
    }
  }, [canViewHealthCheck, router]);

  const runFast = useCallback(async () => {
    setLoadingFast(true);
    setError(null);
    try {
      const res = await fetch("/api/health-check");
      const data = await readApiJson<{ report?: HealthCheckReport; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Fast check failed");
      if (!data.report) throw new Error("Fast check returned no report");
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fast check failed");
    } finally {
      setLoadingFast(false);
    }
  }, []);

  useEffect(() => {
    if (!canViewHealthCheck) return;
    void runFast();
  }, [canViewHealthCheck, runFast]);

  const runDeep = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setConfirmDeep(false);
    setDeepRunning(true);
    setDeepPercent(0);
    setDeepMessage("Starting deep scan…");
    setError(null);
    try {
      const res = await fetch("/api/health-check/deep", {
        method: "POST",
        signal: ac.signal,
      });
      if (!res.ok) {
        const data = await readApiJson<{ error?: string }>(res).catch(
          (): { error?: string } => ({}),
        );
        throw new Error(data.error ?? `Deep scan failed (${res.status})`);
      }
      let lastReport: HealthCheckReport | null = null;
      let skuIssueCount = 0;
      let streamError: string | null = null;
      await consumeNdjsonStream<HealthCheckDeepProgress>(res, (event) => {
        setDeepPercent(event.percent);
        setDeepMessage(event.message);
        if (event.phase === "error") {
          streamError = event.error ?? event.message;
          return;
        }
        if (event.report) {
          lastReport = event.report;
          skuIssueCount = event.report.projects.reduce((n, p) => n + p.missingSkus.length, 0);
        }
      });
      if (streamError) throw new Error(streamError);
      if (lastReport) {
        setReport(lastReport);
        setDoneCount(healthCheckIssueCount(lastReport));
        setDoneSkuCount(skuIssueCount);
        setDoneOpen(true);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Deep scan failed");
    } finally {
      setDeepRunning(false);
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, []);

  const liveProjects = useMemo(
    () => (report?.projects ?? []).filter((p) => !p.template),
    [report],
  );
  const templates = useMemo(
    () => (report?.projects ?? []).filter((p) => p.template),
    [report],
  );
  const liveSkuProjects = useMemo(
    () => liveProjects.filter((p) => p.missingSkus.length > 0),
    [liveProjects],
  );
  const templateSkuProjects = useMemo(
    () => templates.filter((p) => p.missingSkus.length > 0),
    [templates],
  );
  const objectOnlyProjects = useMemo(
    () =>
      [...liveProjects, ...templates].filter(
        (p) => p.missingObjects.length > 0 && p.missingSkus.length === 0,
      ),
    [liveProjects, templates],
  );
  const missingSkuCount = useMemo(
    () => (report?.projects ?? []).reduce((n, p) => n + p.missingSkus.length, 0),
    [report],
  );
  const missingObjectLineCount = useMemo(
    () => (report?.projects ?? []).reduce((n, p) => n + p.missingObjects.length, 0),
    [report],
  );

  const busy = loadingFast || deepRunning;

  if (!canViewHealthCheck) return null;

  return (
    <div className="space-y-6 px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={deepScanButtonClass}
            disabled={busy}
            onClick={() => setConfirmDeep(true)}
          >
            Deep scan
          </button>
          <button
            type="button"
            className={sfNeutralToolbarButton}
            disabled={busy}
            onClick={() => void runFast()}
          >
            {loadingFast ? "Checking…" : "Fast check"}
          </button>
        </div>
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
          Health Check
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-sf-text-secondary dark:text-zinc-400">
          Deep scan finds SKUs still sitting on live quotes after they were removed from the master
          spreadsheet. Click a line to open that quote and reselect the SKU.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loadingFast && !report ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Running fast check…</p>
      ) : null}

      {report && !report.deepScan ? (
        <div className="rounded-lg border-2 border-sf-brand bg-sf-surface px-4 py-4 dark:border-sf-brand/70 dark:bg-zinc-900/50">
          <p className="text-sm font-medium text-sf-text dark:text-zinc-100">
            Run Deep scan to check live quotes
          </p>
          <p className="mt-1 text-sm text-sf-text-secondary dark:text-zinc-400">
            Fast check only covers Setup. Deep scan reads every live project and template line.
          </p>
          <button
            type="button"
            className={`${deepScanButtonClass} mt-3`}
            disabled={busy}
            onClick={() => setConfirmDeep(true)}
          >
            Deep scan live quotes
          </button>
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.deepScan ? (
              <StatCard
                label="SKUs to reselect"
                value={missingSkuCount}
                tone={missingSkuCount ? "alert" : "ok"}
              />
            ) : null}
            <StatCard
              label="Broken scopes"
              value={report.scopes.length}
              tone={report.scopes.length ? "alert" : "ok"}
            />
            {report.deepScan ? (
              <StatCard
                label="Missing objects"
                value={missingObjectLineCount}
                tone={missingObjectLineCount ? "alert" : "ok"}
              />
            ) : (
              <StatCard
                label="Broken area objects"
                value={report.areaObjects.length}
                tone={report.areaObjects.length ? "alert" : "ok"}
              />
            )}
          </div>

          {report.deepScan ? (
            <section className="space-y-2">
              <h2 className={sfSectionHeading}>Reselect SKUs on live quotes</h2>
              <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                Click a line to jump to that SKU on the Check List and pick a replacement.
              </p>
              <div className={sfDataSurface}>
                {liveSkuProjects.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-sf-text-secondary md:px-5 dark:text-zinc-400">
                    No live quotes with removed SKUs.
                  </p>
                ) : (
                  liveSkuProjects.map((p) => (
                    <ProjectIssueBlock key={p.projectDocId} issue={p} />
                  ))
                )}
              </div>
              {templateSkuProjects.length > 0 ? (
                <div className={sfDataSurface}>
                  <h3 className="border-b border-sf-border px-4 py-3 text-sm font-semibold md:px-5 dark:border-zinc-700">
                    Templates
                  </h3>
                  {templateSkuProjects.map((p) => (
                    <ProjectIssueBlock key={p.projectDocId} issue={p} />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {report.deepScan && objectOnlyProjects.length > 0 ? (
            <section className="space-y-2">
              <h2 className={sfSectionHeading}>Missing objects on quotes</h2>
              <div className={sfDataSurface}>
                {objectOnlyProjects.map((p) => (
                  <ProjectIssueBlock key={p.projectDocId} issue={p} />
                ))}
              </div>
            </section>
          ) : null}

          {report.scopes.length > 0 ? (
            <section className="space-y-2">
              <h2 className={sfSectionHeading}>Setup scopes</h2>
              <div className={sfDataSurface}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                      <tr>
                        <th className="px-4 py-3 font-semibold md:px-5">Scope</th>
                        <th className="px-4 py-3 font-semibold md:px-5">Area</th>
                        <th className="px-4 py-3 font-semibold md:px-5">Missing objects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.scopes.map((s) => (
                        <tr
                          key={s.scopeDocId}
                          className="border-b border-sf-border last:border-0 dark:border-zinc-700"
                        >
                          <td className="px-4 py-3 md:px-5">
                            <Link href={s.href} className={lineLinkClass}>
                              {s.question}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sf-text-secondary md:px-5 dark:text-zinc-400">
                            {s.areaNames || "—"}
                          </td>
                          <td className="px-4 py-3 text-sf-text-secondary md:px-5 dark:text-zinc-400">
                            {s.answers.map((a) => (
                              <div key={a.answerid}>
                                <span className="font-medium text-sf-text dark:text-zinc-200">
                                  {a.answerLabel}:
                                </span>{" "}
                                {formatMissingList(a)}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {report.areaObjects.length > 0 ? (
            <section className="space-y-2">
              <h2 className={sfSectionHeading}>Area default objects</h2>
              <div className={sfDataSurface}>
                <ul className="divide-y divide-sf-border dark:divide-zinc-700">
                  {report.areaObjects.map((a) => (
                    <li key={a.areaObjectDocId} className="px-4 py-3 md:px-5">
                      <Link href={a.href} className={lineLinkClass}>
                        {a.areaName}
                      </Link>
                      <span className="text-sm text-sf-text-secondary dark:text-zinc-400">
                        {" — "}
                        object #{a.objectid}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDeep}
        title="Scan live quotes for removed SKUs?"
        description="Deep scan reads every line on live projects and templates and flags SKUs that no longer exist in the master catalog. Open each line and reselect a SKU. This can take a minute."
        confirmLabel="Start deep scan"
        cancelLabel="Cancel"
        onConfirm={() => void runDeep()}
        onCancel={() => setConfirmDeep(false)}
      />
      <DeepScanProgressModal
        open={deepRunning}
        percent={deepPercent}
        message={deepMessage}
        onCancel={() => abortRef.current?.abort()}
      />
      <DeepScanDoneModal
        open={doneOpen}
        skuCount={doneSkuCount}
        issueCount={doneCount}
        onClose={() => setDoneOpen(false)}
      />
    </div>
  );
}
