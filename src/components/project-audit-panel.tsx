"use client";

import { ProjectsTabs } from "@/components/projects-tabs";
import { catalogJsonGet } from "@/lib/client/catalog-fetch-cache";
import { formatMoney } from "@/lib/client/format-money";
import { loadCatalogSkuData } from "@/lib/client/load-catalog-sku-data";
import { supplierDiscountByKeyFromRows } from "@/lib/client/supplier-discount-price";
import { useRedirectUnauthorizedTemplate } from "@/lib/client/use-redirect-unauthorized-template";
import { buildProjectAudit, type ProjectAuditArea, type ProjectAuditReport } from "@/lib/project-audit";
import { lmRunsRollWidthMFromSettings } from "@/lib/settings-lm-runs-roll-width";
import { marginPercentFromSettings, projectMarginPercent } from "@/lib/settings-margin";
import { useViewMode } from "@/lib/view-mode";
import type { AreaPublic } from "@/types/area";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSupplierDiscountPublic } from "@/types/data-supplier-discount-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";
import type { SettingPublic } from "@/types/setting";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function moneyGap(a: number, b: number): number {
  return (Math.round(a * 100) - Math.round(b * 100)) / 100;
}

function Gap({ a, b }: { a: number; b: number }) {
  const d = moneyGap(a, b);
  if (d === 0) {
    return <span className="tabular-nums text-sf-text-weak dark:text-zinc-500">0.00</span>;
  }
  const text = d > 0 ? `+${formatMoney(d)}` : formatMoney(d);
  return (
    <span className="tabular-nums font-semibold text-red-700 dark:text-red-300">{text}</span>
  );
}

function Money({ n }: { n: number }) {
  return <span className="tabular-nums">{formatMoney(n)}</span>;
}

const th =
  "border border-sf-border bg-sf-page px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-sf-text-secondary dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
const td =
  "border border-sf-border px-2 py-1.5 align-top text-sm text-sf-text dark:border-zinc-700 dark:text-zinc-200";

function SummaryTable({ report }: { report: ProjectAuditReport }) {
  const rows: { label: string; checklist: number; workbench: number }[] = [
    {
      label: "Project total",
      checklist: report.checklistProjectTotal,
      workbench: report.workbenchProjectTotal,
    },
    {
      label: "Sum of area totals",
      checklist: report.checklistProjectTotal,
      workbench: report.workbenchAreasSum,
    },
    {
      label: "Sum of line prices",
      checklist: report.checklistLinesSum,
      workbench: report.workbenchLinesPlusFee,
    },
  ];
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className={th}> </th>
          <th className={`${th} text-right`}>Checklist</th>
          <th className={`${th} text-right`}>Workbench</th>
          <th className={`${th} text-right`}>Workbench − checklist</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td className={td}>{row.label}</td>
            <td className={`${td} text-right`}>
              <Money n={row.checklist} />
            </td>
            <td className={`${td} text-right`}>
              <Money n={row.workbench} />
            </td>
            <td className={`${td} text-right`}>
              <Gap a={row.workbench} b={row.checklist} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const areaTotalCols =
  "grid grid-cols-[minmax(11rem,1.3fr)_repeat(7,minmax(6.5rem,1fr))] items-center gap-x-3";

const areaColHead =
  "text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-sf-text-secondary dark:text-zinc-400";

function AreaTotalColumns({ area }: { area: ProjectAuditArea }) {
  return (
    <>
      <div className="text-right text-sm">
        <Money n={area.checklistTotal} />
      </div>
      <div className="text-right text-sm">
        <Money n={area.checklistLinesSum} />
      </div>
      <div className="text-right text-sm">
        <Money n={area.workbenchTotal} />
      </div>
      <div className="text-right text-sm">
        <Money n={area.workbenchLinesSum} />
      </div>
      <div className="text-right text-sm">
        <Gap a={area.checklistLinesSum} b={area.checklistTotal} />
      </div>
      <div className="text-right text-sm">
        <Gap a={area.workbenchLinesSum} b={area.workbenchTotal} />
      </div>
      <div className="text-right text-sm">
        <Gap a={area.workbenchTotal} b={area.checklistTotal} />
      </div>
    </>
  );
}

function AreaBlock({
  area,
  projectDocId,
  mismatchesOnly,
}: {
  area: ProjectAuditArea;
  projectDocId: string;
  mismatchesOnly: boolean;
}) {
  const lines = mismatchesOnly
    ? area.lines.filter((line) => line.reasons.length > 0)
    : area.lines;
  return (
    <details
      open={area.hasMismatch}
      className="rounded-lg border border-sf-border bg-sf-surface dark:border-zinc-700 dark:bg-zinc-900/40"
    >
      <summary
        className={`${areaTotalCols} cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-block size-2 shrink-0 rounded-full ${
              area.hasMismatch ? "bg-red-500" : "bg-emerald-500"
            }`}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-sf-brand dark:text-zinc-50">
              {area.name}
            </span>
            <span className="text-xs text-sf-text-weak dark:text-zinc-500">
              {area.lines.length} line{area.lines.length === 1 ? "" : "s"}
            </span>
          </span>
        </div>
        <AreaTotalColumns area={area} />
      </summary>
      <div className="space-y-3 border-t border-sf-border px-4 py-3 dark:border-zinc-700">
        {area.notes.map((note) => (
          <p key={note} className="text-sm text-sf-text-secondary dark:text-zinc-400">
            {note}
          </p>
        ))}
        {lines.length === 0 ? (
          <p className="text-sm text-sf-text-weak dark:text-zinc-500">
            {mismatchesOnly ? "No differing lines in this area." : "No lines."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={th}>Line</th>
                  <th className={`${th} text-right`}>Checklist shows</th>
                  <th className={`${th} text-right`}>In checklist total</th>
                  <th className={`${th} text-right`}>Workbench shows</th>
                  <th className={`${th} text-right`}>In workbench total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const off =
                    line.reasons.length > 0
                      ? "bg-red-50/80 dark:bg-red-950/20"
                      : "";
                  const href = (path: string) =>
                    `${path}?id=${encodeURIComponent(projectDocId)}&line=${encodeURIComponent(line.id)}`;
                  return (
                    <tr key={line.id} className={off}>
                      <td className={td}>
                        <div className={line.bundled ? "pl-4" : ""}>
                          <div className="font-medium">
                            {line.bundled ? "↳ " : ""}
                            {line.label}
                            {line.included ? null : (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-sf-text-weak">
                                Excluded
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-sf-text-weak dark:text-zinc-500">
                            {line.source}
                            {line.skuLabel !== "—" ? ` · ${line.skuLabel}` : ""}
                            {" · "}
                            <Link
                              href={href("/projects/project/checklist")}
                              className="underline underline-offset-2 hover:text-sf-brand"
                            >
                              Checklist
                            </Link>
                            {" · "}
                            <Link
                              href={href("/projects/project/workbench")}
                              className="underline underline-offset-2 hover:text-sf-brand"
                            >
                              Workbench
                            </Link>
                          </div>
                          {line.reasons.map((reason) => (
                            <p key={reason} className="mt-1 text-xs text-red-800 dark:text-red-200">
                              {reason}
                            </p>
                          ))}
                          {line.detail ? (
                            <p className="mt-1 text-xs text-sf-text-secondary dark:text-zinc-400">
                              {line.detail}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${td} text-right`}>
                        <Money n={line.checklist} />
                      </td>
                      <td className={`${td} text-right`}>
                        <Money n={line.checklistCounted} />
                        <div className="text-[11px]">
                          <Gap a={line.checklist} b={line.checklistCounted} />
                        </div>
                      </td>
                      <td className={`${td} text-right`}>
                        <Money n={line.workbench} />
                      </td>
                      <td className={`${td} text-right`}>
                        <Money n={line.workbenchCounted} />
                        <div className="text-[11px]">
                          <Gap a={line.workbench} b={line.workbenchCounted} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}

export function ProjectAuditPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectDocId = searchParams.get("id");
  const { isManagementMode } = useViewMode();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectPublic | null>(null);
  const [report, setReport] = useState<ProjectAuditReport | null>(null);
  const [mismatchesOnly, setMismatchesOnly] = useState(true);

  useRedirectUnauthorizedTemplate(project, !loading && Boolean(projectDocId));

  useEffect(() => {
    if (!projectDocId) router.replace("/projects");
  }, [projectDocId, router]);

  useEffect(() => {
    if (!projectDocId || !isManagementMode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    const { signal } = ac;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const req = { signal };
        const [
          projectRes,
          areaRes,
          paRes,
          lineRes,
          quoteRes,
          scopeRes,
          settingsRes,
          labourRes,
          objectLabourRes,
          discountRes,
          paintRes,
          catalog,
        ] = await Promise.all([
          fetch(`/api/projects/${projectDocId}`, { signal }),
          catalogJsonGet<{ areas?: AreaPublic[]; error?: string }>("/api/areas", req),
          fetch(`/api/projectareas?projectDocId=${encodeURIComponent(projectDocId!)}`, { signal }),
          fetch(
            `/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId!)}`,
            { signal },
          ),
          catalogJsonGet<{ quoteObjects?: QuoteObjectPublic[]; error?: string }>(
            "/api/quote-objects",
            req,
          ),
          catalogJsonGet<{ scopes?: ScopePublic[]; error?: string }>("/api/scopes", req),
          catalogJsonGet<{ settings?: SettingPublic[]; error?: string }>("/api/settings", req),
          catalogJsonGet<{ items?: DataLabourRatePublic[] }>("/api/labour-rates", req),
          catalogJsonGet<{ items?: DataObjectLabourRatePublic[] }>(
            "/api/object-labour-rates",
            req,
          ),
          catalogJsonGet<{ items?: DataSupplierDiscountPublic[] }>(
            "/api/supplier-discounts",
            req,
          ),
          catalogJsonGet<{ items?: DataPaintingElementPublic[] }>("/api/painting-elements", req),
          loadCatalogSkuData(signal),
        ]);
        if (cancelled) return;

        const projectData = (await projectRes.json()) as {
          project?: ProjectPublic;
          error?: string;
        };
        if (!projectRes.ok || !projectData.project) {
          throw new Error(projectData.error ?? "Failed to load project");
        }
        const paData = (await paRes.json()) as {
          projectAreas?: ProjectAreaPublic[];
          error?: string;
        };
        if (!paRes.ok) throw new Error(paData.error ?? "Failed to load project areas");
        const lineData = (await lineRes.json()) as {
          projectAreaObjects?: ProjectAreaObjectPublic[];
          error?: string;
        };
        if (!lineRes.ok) throw new Error(lineData.error ?? "Failed to load line items");
        if (!areaRes.ok) throw new Error(areaRes.data.error ?? "Failed to load areas");
        if (!quoteRes.ok) throw new Error(quoteRes.data.error ?? "Failed to load quote objects");
        if (!scopeRes.ok) throw new Error(scopeRes.data.error ?? "Failed to load scopes");

        const settings = settingsRes.ok ? (settingsRes.data.settings ?? []) : [];
        const nextProject = projectData.project;
        const built = buildProjectAudit({
          project: nextProject,
          marginPct: projectMarginPercent(
            nextProject.marginpct,
            marginPercentFromSettings(settings),
          ),
          lmRunsRollWidthFallback: lmRunsRollWidthMFromSettings(settings),
          areas: areaRes.data.areas ?? [],
          projectAreas: paData.projectAreas ?? [],
          lines: lineData.projectAreaObjects ?? [],
          quoteObjects: quoteRes.data.quoteObjects ?? [],
          scopes: scopeRes.data.scopes ?? [],
          catalogSkus: catalog.skus,
          suppliersBySkuId: catalog.suppliersBySkuId,
          supplierDiscountByKey: supplierDiscountByKeyFromRows(
            discountRes.ok ? (discountRes.data.items ?? []) : [],
          ),
          contractLabourRates: labourRes.ok ? (labourRes.data.items ?? []) : [],
          objectLabourRates: objectLabourRes.ok ? (objectLabourRes.data.items ?? []) : [],
          paintingElements: paintRes.ok ? (paintRes.data.items ?? []) : [],
        });
        if (cancelled) return;
        setProject(nextProject);
        setReport(built);
      } catch (e) {
        if (
          cancelled ||
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && e.name === "AbortError")
        ) {
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load project audit");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [projectDocId, isManagementMode]);

  const mismatchAreas = useMemo(
    () => report?.areas.filter((area) => area.hasMismatch).length ?? 0,
    [report],
  );

  return (
    <div className="min-h-full bg-sf-page dark:bg-zinc-950">
      <ProjectsTabs />
      <div className="space-y-4 px-5 py-5 md:px-6 md:py-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-sf-brand dark:text-zinc-50">
            Project audit
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-sf-text-secondary dark:text-zinc-400">
            Compares the total held on the checklist with the total held on the workbench, area by
            area and line by line. Checklist total is Total Price. Workbench total is Grand Total
            on the project and Final on each area.
            {report ? ` Margin ${report.marginPct}%.` : ""}
          </p>
        </div>

        {!isManagementMode ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
            Project audit is available in Manage mode.
          </p>
        ) : error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : loading || !report || !project ? (
          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Loading audit…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-sf-text dark:text-zinc-100">
              {project.projectname}
            </p>
            <ul className="space-y-2">
              {report.findings.map((finding) => (
                <li
                  key={finding.text}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    finding.tone === "bad"
                      ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
                      : "border-sf-border bg-sf-surface text-sf-text dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-200"
                  }`}
                >
                  {finding.text}
                </li>
              ))}
            </ul>

            <SummaryTable report={report} />
            <p className="text-xs text-sf-text-weak dark:text-zinc-500">
              A line&apos;s &quot;shows&quot; price is the figure on the row. &quot;In total&quot; is
              the amount that row adds to the area and project totals. The painting site fee is a
              line in General, so it is already inside those totals.
            </p>

            <div className="rounded-lg border border-sf-border bg-sf-surface px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                Workbench summary cards
              </p>
              <p className="mt-1 text-sf-text dark:text-zinc-200">
                Line sub total <Money n={report.cards.lineSubTotal} />
                {" + Trade total "}
                <Money n={report.cards.tradeTotal} />
                {" = "}
                <Money n={report.cards.partsSum} />
                {". Total card "}
                <Money n={report.cards.netTotal} />
                {" · "}
                <Gap a={report.cards.partsSum} b={report.cards.netTotal} />
              </p>
              {report.paintingSiteFeeExcGst > 0 ? (
                <p className="mt-1 text-sf-text-secondary dark:text-zinc-400">
                  Painting site fee <Money n={report.paintingSiteFeeExcGst} /> ex GST (
                  <Money n={report.paintingSiteFeeWithMargin} /> with margin) is the General area
                  line. It is included once in the checklist and workbench totals.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                Areas
                {mismatchAreas > 0 ? ` · ${mismatchAreas} with a difference` : ""}
              </h2>
              <label className="flex items-center gap-2 text-sm text-sf-text dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={mismatchesOnly}
                  onChange={(e) => setMismatchesOnly(e.target.checked)}
                  className="size-4 accent-sf-brand"
                />
                Mismatches only
              </label>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[68rem] space-y-3">
                <div className={`${areaTotalCols} px-4`} aria-hidden>
                  <span />
                  <span className={areaColHead}>Checklist total</span>
                  <span className={areaColHead}>Sum of checklist lines</span>
                  <span className={areaColHead}>Workbench total</span>
                  <span className={areaColHead}>Sum of workbench lines</span>
                  <span className={areaColHead}>Checklist lines vs total</span>
                  <span className={areaColHead}>Workbench lines vs total</span>
                  <span className={areaColHead}>Checklist vs workbench</span>
                </div>
                {report.areas.map((area) => (
                  <AreaBlock
                    key={area.id}
                    area={area}
                    projectDocId={projectDocId ?? ""}
                    mismatchesOnly={mismatchesOnly}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
