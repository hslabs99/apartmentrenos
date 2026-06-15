"use client";

import {
  ProjectNotesBrowser,
  type ProjectNotesBrowserProps,
} from "@/components/project-notes-browser";
import type { ProjectNoteAreaOption, ProjectNoteObjectOption } from "@/components/project-notes-browser";
import { ProjectsTabs } from "@/components/projects-tabs";
import { projectLineObjectLabel } from "@/lib/client/project-line-quote-object";
import { useLookups } from "@/lib/client/use-lookups";
import { distinctLookupValues } from "@/lib/lookup-list-values";
import { LOOKUP_TYPE_NOTE_TYPES } from "@/lib/lookup-types";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import type { ProjectNoteTarget } from "@/lib/project-note-filters";
import type { AreaPublic } from "@/types/area";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectNotePublic } from "@/types/project-note";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

export function ProjectNotesPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectDocId = searchParams.get("id");
  const { lookups } = useLookups();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectPublic | null>(null);
  const [numericProjectId, setNumericProjectId] = useState<number | null>(null);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [projectAreas, setProjectAreas] = useState<ProjectAreaPublic[]>([]);
  const [allObjects, setAllObjects] = useState<ProjectAreaObjectPublic[]>([]);
  const [projectNotes, setProjectNotes] = useState<ProjectNotePublic[]>([]);
  const [quoteObjects, setQuoteObjects] = useState<QuoteObjectPublic[]>([]);
  const [catalogSkus, setCatalogSkus] = useState<DataSkuPublic[]>([]);

  const noteTypeOptions = useMemo(
    () => distinctLookupValues(lookups, LOOKUP_TYPE_NOTE_TYPES),
    [lookups],
  );

  useEffect(() => {
    if (!projectDocId) {
      router.replace("/projects");
    }
  }, [projectDocId, router]);

  const reloadProjectNotes = useCallback(async () => {
    if (!projectDocId) return;
    await fetch("/api/project-notes/init", { method: "POST" });
    const res = await fetch(
      `/api/project-notes?projectDocId=${encodeURIComponent(projectDocId)}`,
    );
    const data = (await res.json()) as {
      projectNotes?: ProjectNotePublic[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to reload project notes");
    setProjectNotes(data.projectNotes ?? []);
  }, [projectDocId]);

  useEffect(() => {
    async function boot() {
      if (!projectDocId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [areasRes, qoRes, skuRes, projectRes, paRes, objRes] = await Promise.all([
          fetch("/api/areas"),
          fetch("/api/quote-objects"),
          fetch("/api/data-skus"),
          fetch(`/api/projects/${projectDocId}`),
          fetch(`/api/projectareas?projectDocId=${encodeURIComponent(projectDocId)}`),
          fetch(`/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId)}`),
        ]);

        const areasData = (await areasRes.json()) as { areas?: AreaPublic[]; error?: string };
        if (!areasRes.ok) throw new Error(areasData.error ?? "Failed to load areas");
        setAreas(areasData.areas ?? []);

        const qoData = (await qoRes.json()) as {
          quoteObjects?: QuoteObjectPublic[];
          error?: string;
        };
        if (!qoRes.ok) throw new Error(qoData.error ?? "Failed to load quote objects");
        setQuoteObjects(qoData.quoteObjects ?? []);

        const skuData = (await skuRes.json()) as { items?: DataSkuPublic[]; error?: string };
        if (!skuRes.ok) throw new Error(skuData.error ?? "Failed to load SKUs");
        setCatalogSkus(skuData.items ?? []);

        const projectData = await readApiResponse<{ project?: ProjectPublic; error?: string }>(
          projectRes,
        );
        if (!projectRes.ok || !projectData.project) {
          throw new Error(projectData.error ?? "Failed to load project");
        }
        setProject(projectData.project);
        setNumericProjectId(
          typeof projectData.project.projectid === "number" &&
            Number.isInteger(projectData.project.projectid)
            ? projectData.project.projectid
            : null,
        );

        const paData = (await paRes.json()) as {
          projectAreas?: ProjectAreaPublic[];
          error?: string;
        };
        if (!paRes.ok) throw new Error(paData.error ?? "Failed to load project areas");
        setProjectAreas(paData.projectAreas ?? []);

        const objData = (await objRes.json()) as {
          projectAreaObjects?: ProjectAreaObjectPublic[];
          error?: string;
        };
        if (!objRes.ok) throw new Error(objData.error ?? "Failed to load line items");
        setAllObjects(objData.projectAreaObjects ?? []);

        await reloadProjectNotes();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load project notes");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [projectDocId, reloadProjectNotes]);

  const sortedProjectAreas = useMemo(
    () => [...projectAreas].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [projectAreas],
  );

  const objectLabel = useCallback(
    (row: ProjectAreaObjectPublic) => projectLineObjectLabel(row, quoteObjects, catalogSkus),
    [quoteObjects, catalogSkus],
  );

  const authorFallback = project?.quotedby?.trim() ?? "";

  const projectNoteAreaOptions = useMemo((): ProjectNoteAreaOption[] => {
    return sortedProjectAreas.map((pa) => ({
      areaid: pa.areaid,
      label: projectAreaHeading(pa, areas),
    }));
  }, [sortedProjectAreas, areas]);

  const projectNoteObjectLabelByArea = useMemo(() => {
    const byArea = new Map<number, Map<number, string>>();
    for (const row of allObjects) {
      if (!byArea.has(row.areaid)) byArea.set(row.areaid, new Map());
      const areaMap = byArea.get(row.areaid)!;
      if (!areaMap.has(row.objectid)) {
        areaMap.set(row.objectid, objectLabel(row));
      }
    }
    return byArea;
  }, [allObjects, objectLabel]);

  const projectNoteAreaLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const opt of projectNoteAreaOptions) {
      map.set(opt.areaid, opt.label);
    }
    return map;
  }, [projectNoteAreaOptions]);

  const projectNoteObjectOptionsForArea = useCallback(
    (areaid: number | null): ProjectNoteObjectOption[] => {
      if (areaid == null) {
        const seen = new Map<number, string>();
        for (const row of allObjects) {
          if (!seen.has(row.objectid)) {
            seen.set(row.objectid, objectLabel(row));
          }
        }
        return [...seen.entries()]
          .map(([objectid, label]) => ({ objectid, label }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
      }
      const areaMap = projectNoteObjectLabelByArea.get(areaid);
      if (!areaMap) return [];
      return [...areaMap.entries()]
        .map(([objectid, label]) => ({ objectid, label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    },
    [allObjects, objectLabel, projectNoteObjectLabelByArea],
  );

  const projectNoteAreaLabelForNote = useCallback(
    (areaid: number | null) => {
      if (areaid == null) return "Project";
      return projectNoteAreaLabelById.get(areaid) ?? `Area ${areaid}`;
    },
    [projectNoteAreaLabelById],
  );

  const projectNoteObjectLabelForNote = useCallback(
    (areaid: number | null, objectid: number | null) => {
      if (objectid == null) return "—";
      if (areaid != null) {
        return projectNoteObjectLabelByArea.get(areaid)?.get(objectid) ?? `Object ${objectid}`;
      }
      for (const areaMap of projectNoteObjectLabelByArea.values()) {
        const label = areaMap.get(objectid);
        if (label) return label;
      }
      return `Object ${objectid}`;
    },
    [projectNoteObjectLabelByArea],
  );

  const createProjectNote = useCallback(
    async (
      target: ProjectNoteTarget,
      body: { notetype: string; trades: string[]; author: string; note: string },
    ) => {
      if (numericProjectId == null) throw new Error("Project not loaded");
      const res = await fetch("/api/project-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectid: numericProjectId,
          areaid: target.areaid ?? null,
          objectid: target.objectid ?? null,
          ...body,
        }),
      });
      const data = await readApiResponse<{
        projectNote?: ProjectNotePublic;
        error?: string;
      }>(res);
      if (!res.ok || !data.projectNote) {
        throw new Error(data.error ?? "Failed to save note");
      }
      setProjectNotes((prev) => [data.projectNote!, ...prev]);
    },
    [numericProjectId],
  );

  const updateProjectNote = useCallback(
    async (
      noteId: string,
      body: { notetype: string; trades: string[]; note: string },
    ) => {
      const res = await fetch(`/api/project-notes/${encodeURIComponent(noteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApiResponse<{
        projectNote?: ProjectNotePublic;
        error?: string;
      }>(res);
      if (!res.ok || !data.projectNote) {
        throw new Error(data.error ?? "Failed to update note");
      }
      setProjectNotes((prev) => prev.map((n) => (n.id === noteId ? data.projectNote! : n)));
    },
    [],
  );

  const deleteProjectNote = useCallback(async (noteId: string) => {
    const res = await fetch(`/api/project-notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    });
    const data = await readApiResponse<{ error?: string }>(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to delete note");
    setProjectNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const browserProps = useMemo((): ProjectNotesBrowserProps | null => {
    if (numericProjectId == null || !project) return null;
    const createTarget: ProjectNoteTarget = { projectid: numericProjectId };
    return {
      projectName: project.projectname,
      projectid: numericProjectId,
      allProjectNotes: projectNotes,
      createTarget,
      attachNotesToFilter: true,
      initialViewFilter: { areaid: null, objectid: null },
      areaOptions: projectNoteAreaOptions,
      objectOptionsForArea: projectNoteObjectOptionsForArea,
      areaLabelForNote: projectNoteAreaLabelForNote,
      objectLabelForNote: projectNoteObjectLabelForNote,
      noteTypeOptions,
      authorFallback,
      showPrintReport: true,
      onCreateNote: createProjectNote,
      onUpdateNote: updateProjectNote,
      onDeleteNote: deleteProjectNote,
    };
  }, [
    numericProjectId,
    project,
    projectNotes,
    projectNoteAreaOptions,
    projectNoteObjectOptionsForArea,
    projectNoteAreaLabelForNote,
    projectNoteObjectLabelForNote,
    noteTypeOptions,
    authorFallback,
    createProjectNote,
    updateProjectNote,
    deleteProjectNote,
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-4 print:hidden">
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
          Project notes
        </h1>
        <ProjectsTabs />
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Loading…</p>
      ) : !projectDocId ? null : numericProjectId == null ? (
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          This project has no numeric ID yet. Open the Project tab and save, or assign IDs from the
          Projects list.
        </p>
      ) : browserProps ? (
        <div className="flex min-h-[calc(100vh-14rem)] flex-col print:min-h-0">
          <ProjectNotesBrowser {...browserProps} className="min-h-[32rem] flex-1 print:hidden" />
        </div>
      ) : null}
    </div>
  );
}
