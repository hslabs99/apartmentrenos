"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsHorizontal,
  IconDownload,
  IconTrash,
} from "@/components/icons/lightning-icons";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { downloadProjectChecklistXls } from "@/lib/project-checklist-export-xls";
import type { ProjectListItem } from "@/types/project";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
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
        className="flex h-8 w-8 items-center justify-center rounded border border-sf-border bg-sf-surface text-sf-text-weak shadow-sm hover:bg-sf-page disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <IconDotsHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded border border-sf-border bg-sf-surface py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      const data = await readApiResponse<{ projects?: ProjectListItem[]; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load projects");
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
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
      const res = await fetch(`/api/projects/${deleteConfirmId}`, { method: "DELETE" });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
          Projects
        </h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="inline-flex min-h-8 items-center justify-center rounded bg-sf-brand px-4 py-2 text-sm font-normal text-white shadow-sm transition hover:bg-sf-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sf-brand"
        >
          Add project
        </button>
      </div>

      {error ? (
        <div
          className="rounded border border-red-300/80 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sf-text-weak dark:text-zinc-400">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="rounded border border-sf-border bg-sf-surface p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sf-text-secondary dark:text-zinc-400">No projects yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <article
              key={p.id}
              className="flex flex-col rounded border border-sf-border bg-sf-surface p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-sf-text dark:text-zinc-50">
                  {p.projectname}
                </h2>
                <ProjectTileOverflowMenu
                  projectDocId={p.id}
                  projectName={p.projectname}
                  onDelete={() => setDeleteConfirmId(p.id)}
                  onExportError={(message) => setError(message)}
                  disabled={deletingId === p.id}
                />
              </div>
              <p className="mt-2 line-clamp-5 flex-1 text-sm font-normal leading-relaxed text-sf-text-secondary dark:text-zinc-400">
                {p.projectdescription?.trim() ? p.projectdescription : "No description"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/projects/project?id=${p.id}`}
                  className="inline-flex min-h-8 min-w-[44px] items-center justify-center rounded border border-sf-border bg-sf-surface px-3 py-1.5 text-sm font-normal text-sf-text shadow-sm hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Details
                </Link>
                <Link
                  href={`/projects/project/checklist?id=${p.id}`}
                  className="inline-flex min-h-8 min-w-[44px] items-center justify-center rounded border border-sf-border bg-sf-surface px-3 py-1.5 text-sm font-normal text-sf-text shadow-sm hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Check List
                </Link>
                <Link
                  href={`/projects/project/areas?id=${p.id}`}
                  className="inline-flex min-h-8 min-w-[44px] items-center justify-center rounded border border-sf-border bg-sf-surface px-3 py-1.5 text-sm font-normal text-sf-text shadow-sm hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  Areas ({p.areaCount})
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
