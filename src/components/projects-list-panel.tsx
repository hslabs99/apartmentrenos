"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsHorizontal,
  IconDownload,
  IconFileText,
  IconLayoutDashboard,
  IconListChecks,
  IconPlus,
  IconTrash,
} from "@/components/icons/lightning-icons";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { formatMoney } from "@/lib/client/format-money";
import { downloadProjectChecklistXls } from "@/lib/project-checklist-export-xls";
import { downloadProjectWorkbenchXls } from "@/lib/project-workbench-export-xls";
import type { ProjectListItem } from "@/types/project";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  contentType: string;
  json?: T;
  text?: string;
};

async function readApiResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = (await res.json()) as T;
      return { ok: res.ok, status: res.status, contentType, json };
    } catch {
      // fall through to text
    }
  }
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, contentType, text };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function ProjectTileOverflowMenu({
  projectDocId,
  projectName,
  onDelete,
  onExportError,
  disabled,
}: {
  projectDocId: string;
  projectName: string;
  onDelete: () => void;
  onExportError: (message: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [exportSubOpen, setExportSubOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setExportSubOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-label="More project actions"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled || exporting}
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (!next) setExportSubOpen(false);
            return next;
          })
        }
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sf-text-weak transition-colors hover:bg-sf-page hover:text-sf-text disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <IconDotsHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-lg border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
        >
          <div className="border-b border-sf-border pb-1 dark:border-zinc-700">
            <button
              type="button"
              role="menuitem"
              aria-expanded={exportSubOpen}
              disabled={exporting}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-normal text-sf-text hover:bg-sf-page disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => setExportSubOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <IconDownload className="shrink-0 text-sf-text-weak dark:text-zinc-400" />
                Export
              </span>
              <span className="text-sf-text-weak dark:text-sf-text-weak" aria-hidden>
                {exportSubOpen ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
              </span>
            </button>
            {exportSubOpen ? (
              <div
                className="mx-2 mb-1 mt-0.5 rounded border border-sf-border bg-sf-page py-0.5 dark:border-zinc-700 dark:bg-zinc-800/80"
                role="group"
                aria-label="Export options"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={exporting}
                  className="block w-full px-3 py-2 text-left text-sm font-normal text-sf-text-secondary hover:bg-sf-surface disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => {
                    void (async () => {
                      setExporting(true);
                      setOpen(false);
                      setExportSubOpen(false);
                      try {
                        await downloadProjectChecklistXls(projectDocId, projectName);
                      } catch (e) {
                        onExportError(e instanceof Error ? e.message : "Export failed");
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                >
                  {exporting ? "Exporting…" : "Jobs checklist (.xls)"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={exporting}
                  className="block w-full px-3 py-2 text-left text-sm font-normal text-sf-text-secondary hover:bg-sf-surface disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => {
                    void (async () => {
                      setExporting(true);
                      setOpen(false);
                      setExportSubOpen(false);
                      try {
                        await downloadProjectWorkbenchXls(projectDocId, projectName);
                      } catch (e) {
                        onExportError(e instanceof Error ? e.message : "Export failed");
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                >
                  {exporting ? "Exporting…" : "Jobs workbench (.xls)"}
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal text-sf-destructive hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => {
              setOpen(false);
              setExportSubOpen(false);
              onDelete();
            }}
          >
            <IconTrash className="h-5 w-5 shrink-0" />
            <span className="sr-only">Delete</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectsListPanel() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugLast, setDebugLast] = useState<{
    whenIso: string;
    endpoint: string;
    status?: number;
    contentType?: string;
    bodySnippet?: string;
    online: boolean;
  } | null>(null);
  const debugLastRef = useRef<typeof debugLast>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = "/api/projects";
      const initialDebug = {
        whenIso: new Date().toISOString(),
        endpoint,
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      };
      debugLastRef.current = initialDebug;
      setDebugLast(initialDebug);
      const res = await fetchWithTimeout(endpoint, { timeoutMs: 15000 });
      const parsed = await readApiResponse<{ projects?: ProjectListItem[]; error?: string }>(res);
      const json = parsed.json;
      const bodySnippet =
        typeof json === "object" && json && "error" in (json as Record<string, unknown>)
          ? String((json as { error?: unknown }).error ?? "").slice(0, 400)
          : (parsed.text ?? "").slice(0, 400);
      setDebugLast((prev) => {
        const next = prev
          ? {
              ...prev,
              status: parsed.status,
              contentType: parsed.contentType,
              bodySnippet: bodySnippet || undefined,
            }
          : prev;
        debugLastRef.current = next;
        return next;
      });

      if (!parsed.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : bodySnippet
              ? `HTTP ${parsed.status}: ${bodySnippet}`
              : `HTTP ${parsed.status}`,
        );
      }
      setProjects(json?.projects ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load projects";
      console.error("[Projects] load failed", {
        message: msg,
        debugLast: debugLastRef.current,
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      });
      setError(msg);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDeleteProject() {
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    setError(null);
    try {
      const endpoint = `/api/projects/${deleteConfirmId}`;
      setDebugLast({
        whenIso: new Date().toISOString(),
        endpoint,
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      });
      const res = await fetchWithTimeout(endpoint, { method: "DELETE", timeoutMs: 15000 });
      const parsed = await readApiResponse<{ error?: string }>(res);
      const json = parsed.json;
      const bodySnippet =
        typeof json?.error === "string"
          ? json.error.slice(0, 400)
          : (parsed.text ?? "").slice(0, 400);
      setDebugLast((prev) =>
        prev
          ? {
              ...prev,
              status: parsed.status,
              contentType: parsed.contentType,
              bodySnippet: bodySnippet || undefined,
            }
          : prev,
      );

      if (!parsed.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : bodySnippet
              ? `HTTP ${parsed.status}: ${bodySnippet}`
              : `HTTP ${parsed.status}`,
        );
      }
      setDeleteConfirmId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const projectPendingDelete = deleteConfirmId
    ? projects.find((p) => p.id === deleteConfirmId)
    : undefined;

  const statusPill = (status: string) => {
    if (status === "Live") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (status === "Archive") return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
    return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-sf-brand dark:text-zinc-50">
            Projects
          </h1>
          <p className="mt-0.5 text-sm text-sf-text-secondary dark:text-zinc-400">
            {loading ? "…" : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sf-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sf-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sf-accent"
        >
          <IconPlus className="h-4 w-4" />
          Add project
        </button>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-red-300/80 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error}
          {debugLast ? (
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-xs text-red-900/80 dark:text-red-100/80">
                Debug details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-black/5 p-2 text-xs text-red-950/90 dark:bg-white/5 dark:text-red-100/90">
{`when: ${debugLast.whenIso}
endpoint: ${debugLast.endpoint}
online: ${String(debugLast.online)}
status: ${debugLast.status ?? "—"}
content-type: ${debugLast.contentType ?? "—"}
body: ${debugLast.bodySnippet ?? "—"}`}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sf-text-weak dark:text-zinc-400">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-sf-border bg-sf-surface p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sf-text-secondary dark:text-zinc-400">No projects yet.</p>
        </div>
      ) : (
        <div className="grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
          {projects.map((p) => (
            <article
              key={p.id}
              className="flex flex-col rounded-xl border border-sf-border bg-sf-surface shadow-sm transition-all duration-150 hover:border-sf-border-strong hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900/80"
            >
              <div className="flex items-start justify-between gap-2 p-4 pb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-sf-brand dark:text-zinc-50">
                      {p.projectname}
                    </h2>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPill(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {typeof p.projectid === "number" ? (
                    <p className="mt-0.5 text-xs text-sf-text-weak dark:text-zinc-500">
                      ID {p.projectid}
                    </p>
                  ) : null}
                  <p className="mt-2 flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sf-text-weak dark:text-zinc-500">
                      Total price
                    </span>
                    <span className="text-base font-semibold tabular-nums text-sf-brand dark:text-zinc-50">
                      {p.finalTotal > 0 ? formatMoney(p.finalTotal) : "—"}
                    </span>
                  </p>
                </div>
                <ProjectTileOverflowMenu
                  projectDocId={p.id}
                  projectName={p.projectname}
                  onDelete={() => setDeleteConfirmId(p.id)}
                  onExportError={(message) => setError(message)}
                  disabled={deletingId === p.id}
                />
              </div>
              <div className="flex-1 px-4 pb-4">
                {p.projectdescription?.trim() ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-sf-text-secondary dark:text-zinc-400">
                    {p.projectdescription}
                  </p>
                ) : (
                  <p className="text-xs italic text-sf-text-weak dark:text-zinc-500">No description</p>
                )}
              </div>
              <div className="border-t border-sf-border dark:border-zinc-700" />
              <div className="flex items-center gap-2 p-3">
                <Link
                  href={`/projects/project?id=${p.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-sf-border bg-sf-surface py-2 text-xs font-medium text-sf-text transition-colors hover:border-sf-border-strong hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <IconFileText className="h-3.5 w-3.5 shrink-0 text-sf-text-secondary" />
                  Details
                </Link>
                <Link
                  href={`/projects/project/checklist?id=${p.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-sf-border bg-sf-surface py-2 text-xs font-medium text-sf-text transition-colors hover:border-sf-border-strong hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <IconListChecks className="h-3.5 w-3.5 shrink-0 text-sf-text-secondary" />
                  Check List
                </Link>
                <Link
                  href={`/projects/project/workbench?id=${p.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-sf-border bg-sf-surface py-2 text-xs font-medium text-sf-text transition-colors hover:border-sf-border-strong hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <IconLayoutDashboard className="h-3.5 w-3.5 shrink-0 text-sf-text-secondary" />
                  Workbench
                  {p.areaCount > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sf-page px-1 text-[10px] font-bold text-sf-text-secondary dark:bg-zinc-700 dark:text-zinc-300">
                      {p.areaCount}
                    </span>
                  ) : null}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={() => void load()}
      />

      <ConfirmDialog
        open={Boolean(deleteConfirmId)}
        title="Delete project?"
        description={
          projectPendingDelete
            ? `“${projectPendingDelete.projectname}” will be removed. This cannot be undone.`
            : "This project will be removed. This cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        pending={Boolean(deletingId)}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => void confirmDeleteProject()}
      />
    </div>
  );
}
