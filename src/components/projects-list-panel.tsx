"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  IconArchive,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconDotsHorizontal,
  IconDownload,
  IconFileText,
  IconLayoutDashboard,
  IconListChecks,
  IconPlus,
  IconTrash,
} from "@/components/icons/lightning-icons";
import { CloneProjectDialog } from "@/components/clone-project-dialog";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { formatMoney } from "@/lib/client/format-money";
import { downloadProjectChecklistXls } from "@/lib/project-checklist-export-xls";
import { downloadProjectWorkbenchXls } from "@/lib/project-workbench-export-xls";
import {
  projectHardDeleteNamePrefix,
  projectHardDeletePrefixMatches,
} from "@/lib/project-archived";
import { isProjectTemplateFlag } from "@/lib/project-template";
import { useViewMode } from "@/lib/view-mode";
import type { ProjectListItem } from "@/types/project";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  isArchives,
  onArchive,
  onRestore,
  onHardDelete,
  onClone,
  onSaveAsTemplate,
  onExportError,
  disabled,
}: {
  projectDocId: string;
  projectName: string;
  isArchives?: boolean;
  onArchive?: () => void;
  onRestore?: () => void;
  onHardDelete?: () => void;
  onClone?: () => void;
  onSaveAsTemplate?: () => void;
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
          {isArchives ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal text-sf-text hover:bg-sf-page dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => {
                  setOpen(false);
                  setExportSubOpen(false);
                  onRestore?.();
                }}
              >
                <IconArchive className="h-4 w-4 shrink-0 text-sf-text-weak dark:text-zinc-400" />
                Restore
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal text-sf-destructive hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={() => {
                  setOpen(false);
                  setExportSubOpen(false);
                  onHardDelete?.();
                }}
              >
                <IconTrash className="h-5 w-5 shrink-0" />
                Delete permanently
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal text-sf-text hover:bg-sf-page dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => {
                  setOpen(false);
                  setExportSubOpen(false);
                  onClone?.();
                }}
              >
                <IconCopy className="h-4 w-4 shrink-0 text-sf-text-weak dark:text-zinc-400" />
                Clone
              </button>
              {onSaveAsTemplate ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal text-sf-text hover:bg-sf-page dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => {
                    setOpen(false);
                    setExportSubOpen(false);
                    onSaveAsTemplate();
                  }}
                >
                  <IconCopy className="h-4 w-4 shrink-0 text-sf-text-weak dark:text-zinc-400" />
                  Save as template
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal text-sf-destructive hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={() => {
                  setOpen(false);
                  setExportSubOpen(false);
                  onArchive?.();
                }}
              >
                <IconArchive className="h-4 w-4 shrink-0" />
                Archive
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectsListPanel({
  listKind = "projects",
}: {
  listKind?: "projects" | "templates" | "archives";
}) {
  const router = useRouter();
  const { canManageProjectTemplates } = useViewMode();
  const isTemplates = listKind === "templates";
  const isArchives = listKind === "archives";
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null);
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const [hardDeleteStep, setHardDeleteStep] = useState<1 | 2>(1);
  const [hardDeletePrefix, setHardDeletePrefix] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<{
    id: string;
    name: string;
    asTemplate: boolean;
  } | null>(null);
  const [cloneSaving, setCloneSaving] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const listLabel = isArchives ? "archives" : isTemplates ? "templates" : "projects";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isArchives
        ? "/api/projects?archived=true"
        : isTemplates
          ? "/api/projects?template=true"
          : "/api/projects";
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
      const msg =
        e instanceof Error
          ? e.message
          : `Failed to load ${listLabel}`;
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
  }, [isArchives, isTemplates, listLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmClone(projectname: string) {
    if (!cloneTarget) return;
    setCloneSaving(true);
    setCloneError(null);
    try {
      const res = await fetchWithTimeout(`/api/projects/${cloneTarget.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectname,
          template: cloneTarget.asTemplate || isTemplates,
        }),
        timeoutMs: 60000,
      });
      const parsed = await readApiResponse<{ id?: string; error?: string }>(res);
      if (!parsed.ok || !parsed.json?.id) {
        throw new Error(parsed.json?.error ?? parsed.text?.slice(0, 200) ?? "Clone failed");
      }
      const newId = parsed.json.id;
      setCloneTarget(null);
      router.push(`/projects/project?id=${encodeURIComponent(newId)}`);
    } catch (e) {
      setCloneError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setCloneSaving(false);
    }
  }

  async function patchArchived(id: string, archived: boolean) {
    setPendingId(id);
    setError(null);
    try {
      const endpoint = `/api/projects/${id}`;
      setDebugLast({
        whenIso: new Date().toISOString(),
        endpoint,
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      });
      const res = await fetchWithTimeout(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
        timeoutMs: 15000,
      });
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
      setArchiveConfirmId(null);
      setRestoreConfirmId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : archived ? "Archive failed" : "Restore failed");
    } finally {
      setPendingId(null);
    }
  }

  function resetHardDelete() {
    setHardDeleteId(null);
    setHardDeleteStep(1);
    setHardDeletePrefix("");
  }

  function closeHardDelete() {
    if (pendingId) return;
    resetHardDelete();
  }

  async function confirmHardDeleteProject() {
    if (!hardDeleteId) return;
    const target = projects.find((p) => p.id === hardDeleteId);
    if (!target) return;
    if (hardDeleteStep === 1) {
      if (!projectHardDeletePrefixMatches(target.projectname, hardDeletePrefix)) return;
      setHardDeleteStep(2);
      return;
    }
    setPendingId(hardDeleteId);
    setError(null);
    try {
      const endpoint = `/api/projects/${hardDeleteId}`;
      setDebugLast({
        whenIso: new Date().toISOString(),
        endpoint,
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      });
      const res = await fetchWithTimeout(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmNamePrefix: projectHardDeleteNamePrefix(target.projectname),
        }),
        timeoutMs: 60000,
      });
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
      resetHardDelete();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setPendingId(null);
    }
  }

  const projectPendingArchive = archiveConfirmId
    ? projects.find((p) => p.id === archiveConfirmId)
    : undefined;
  const projectPendingRestore = restoreConfirmId
    ? projects.find((p) => p.id === restoreConfirmId)
    : undefined;
  const projectPendingHardDelete = hardDeleteId
    ? projects.find((p) => p.id === hardDeleteId)
    : undefined;
  const hardDeleteExpectedPrefix = projectPendingHardDelete
    ? projectHardDeleteNamePrefix(projectPendingHardDelete.projectname)
    : "";
  const hardDeletePrefixOk =
    Boolean(projectPendingHardDelete) &&
    projectHardDeletePrefixMatches(projectPendingHardDelete!.projectname, hardDeletePrefix);

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
            {isArchives ? "Archives" : isTemplates ? "Templates" : "Projects"}
          </h1>
          <p className="mt-0.5 text-sm text-sf-text-secondary dark:text-zinc-400">
            {loading
              ? "…"
              : isArchives
                ? `${projects.length} archived`
                : isTemplates
                  ? `${projects.length} template${projects.length !== 1 ? "s" : ""}`
                  : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {isTemplates || isArchives ? null : (
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-sf-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sf-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sf-accent"
          >
            <IconPlus className="h-4 w-4" />
            Add project
          </button>
        )}
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
          <p className="text-sf-text-secondary dark:text-zinc-400">
            {isArchives
              ? "No archived projects. Archive a project from the Projects or Templates list."
              : isTemplates
                ? "No templates yet. Save a project as a template from the Projects list."
                : "No projects yet."}
          </p>
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
                    {isArchives && isProjectTemplateFlag(p.template) ? (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-sf-accent/20 bg-sf-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sf-accent">
                        Template
                      </span>
                    ) : null}
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
                  isArchives={isArchives}
                  onArchive={() => setArchiveConfirmId(p.id)}
                  onRestore={() => setRestoreConfirmId(p.id)}
                  onHardDelete={() => {
                    setHardDeleteId(p.id);
                    setHardDeleteStep(1);
                    setHardDeletePrefix("");
                  }}
                  onClone={() => {
                    setCloneError(null);
                    setCloneTarget({ id: p.id, name: p.projectname, asTemplate: false });
                  }}
                  onSaveAsTemplate={
                    !isTemplates && !isArchives && canManageProjectTemplates
                      ? () => {
                          setCloneError(null);
                          setCloneTarget({ id: p.id, name: p.projectname, asTemplate: true });
                        }
                      : undefined
                  }
                  onExportError={(message) => setError(message)}
                  disabled={pendingId === p.id}
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
              {isArchives ? (
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    disabled={pendingId === p.id}
                    onClick={() => setRestoreConfirmId(p.id)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-sf-brand py-2 text-xs font-medium text-white transition-colors hover:bg-sf-brand-hover disabled:opacity-50"
                  >
                    {isProjectTemplateFlag(p.template) ? "Restore to templates" : "Restore to projects"}
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === p.id}
                    onClick={() => {
                      setHardDeleteId(p.id);
                      setHardDeleteStep(1);
                      setHardDeletePrefix("");
                    }}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-sf-destructive transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
                  >
                    <IconTrash className="h-3.5 w-3.5 shrink-0" />
                    Delete
                  </button>
                </div>
              ) : (
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
              )}
            </article>
          ))}
        </div>
      )}

      {isTemplates || isArchives ? null : (
        <NewProjectDialog
          open={newProjectOpen}
          onClose={() => setNewProjectOpen(false)}
          onCreated={() => void load()}
        />
      )}

      <CloneProjectDialog
        open={Boolean(cloneTarget) && !isArchives}
        title={
          cloneTarget?.asTemplate ? "Save as template" : isTemplates ? "Clone template" : "Clone project"
        }
        description={
          cloneTarget?.asTemplate
            ? "Creates a full copy that appears under Templates. You can edit it afterwards."
            : isTemplates
              ? "Creates a full copy of this template with a new name."
              : "Creates a full copy with a new name. Everything else is copied as-is."
        }
        confirmLabel={cloneTarget?.asTemplate ? "Save template" : "Clone"}
        defaultName={
          cloneTarget
            ? cloneTarget.asTemplate
              ? `${cloneTarget.name} template`
              : `${cloneTarget.name} copy`
            : ""
        }
        saving={cloneSaving}
        error={cloneError}
        onClose={() => {
          if (!cloneSaving) {
            setCloneTarget(null);
            setCloneError(null);
          }
        }}
        onConfirm={(name) => void confirmClone(name)}
      />

      <ConfirmDialog
        open={Boolean(archiveConfirmId)}
        title={isTemplates ? "Archive template?" : "Archive project?"}
        description={
          projectPendingArchive
            ? `“${projectPendingArchive.projectname}” will move to Archives. You can restore it later or permanently delete it from there.`
            : "This will move to Archives. You can restore it later."
        }
        confirmLabel="Archive"
        cancelLabel="Cancel"
        pending={Boolean(pendingId)}
        onCancel={() => {
          if (!pendingId) setArchiveConfirmId(null);
        }}
        onConfirm={() => {
          if (archiveConfirmId) void patchArchived(archiveConfirmId, true);
        }}
      />

      <ConfirmDialog
        open={Boolean(restoreConfirmId)}
        title={
          projectPendingRestore && isProjectTemplateFlag(projectPendingRestore.template)
            ? "Restore to templates?"
            : "Restore to projects?"
        }
        description={
          projectPendingRestore
            ? isProjectTemplateFlag(projectPendingRestore.template)
              ? `“${projectPendingRestore.projectname}” will return to the Templates list.`
              : `“${projectPendingRestore.projectname}” will return to the Projects list.`
            : "This will leave Archives and return to its list."
        }
        confirmLabel="Restore"
        cancelLabel="Cancel"
        pending={Boolean(pendingId)}
        onCancel={() => {
          if (!pendingId) setRestoreConfirmId(null);
        }}
        onConfirm={() => {
          if (restoreConfirmId) void patchArchived(restoreConfirmId, false);
        }}
      />

      <ConfirmDialog
        open={Boolean(hardDeleteId) && hardDeleteStep === 1}
        title="Permanently delete?"
        description={
          projectPendingHardDelete ? (
            <>
              Type the first {hardDeleteExpectedPrefix.length} character
              {hardDeleteExpectedPrefix.length === 1 ? "" : "s"} of “
              {projectPendingHardDelete.projectname}” to continue. This only removes this
              project’s own areas, lines, scope answers, and notes.
            </>
          ) : (
            "Type the start of the project name to continue."
          )
        }
        confirmLabel="Continue"
        cancelLabel="Cancel"
        variant="danger"
        pending={Boolean(pendingId)}
        confirmDisabled={!hardDeletePrefixOk}
        onCancel={closeHardDelete}
        onConfirm={() => void confirmHardDeleteProject()}
      >
        <label className="block text-sm font-medium text-sf-text dark:text-zinc-200">
          Confirmation
          <input
            type="text"
            autoComplete="off"
            value={hardDeletePrefix}
            onChange={(e) => setHardDeletePrefix(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-sf-border bg-sf-surface px-3 text-sm text-sf-text outline-none focus:border-sf-accent focus:ring-2 focus:ring-sf-accent/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
            placeholder={hardDeleteExpectedPrefix ? `e.g. ${hardDeleteExpectedPrefix}` : ""}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(hardDeleteId) && hardDeleteStep === 2}
        title="Delete cannot be undone"
        description={
          projectPendingHardDelete
            ? `“${projectPendingHardDelete.projectname}” and its project-only data will be deleted forever. Catalog, templates setup, and other projects are not affected.`
            : "This project and its project-only data will be deleted forever."
        }
        confirmLabel="Delete permanently"
        cancelLabel="Cancel"
        variant="danger"
        pending={Boolean(pendingId)}
        onCancel={closeHardDelete}
        onConfirm={() => void confirmHardDeleteProject()}
      />
    </div>
  );
}
