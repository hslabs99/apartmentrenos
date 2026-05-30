/**
 * ARCHIVED — not imported by the app (May 2026).
 *
 * Legacy “Project areas” tab UI. Replaced by ProjectChecklistPanel
 * (Check List + Workbench). Same APIs: /api/projectareas, /api/projectareaobjects.
 *
 * Route /projects/project/areas now redirects to Workbench.
 * See src/components/archived/README.md
 */
"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { PriceLevelIdSelect } from "@/components/price-level-id-select";
import { ScopeLineSkuPicker } from "@/components/scope-line-sku-picker";
import { loadCatalogSkuData } from "@/lib/client/load-catalog-sku-data";
import { patchBodyForScopeLineSku } from "@/lib/client/scope-line-sku-patch";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import { ModalFrame } from "@/components/modal-frame";
import { ProjectsTabs } from "@/components/projects-tabs";
import { useLookups } from "@/lib/client/use-lookups";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { distinctLookupValues } from "@/lib/lookup-list-values";
import { LOOKUP_TYPE_STYLE } from "@/lib/lookup-types";
import type { AreaPublic } from "@/types/area";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { ProjectAreaAnswerPublic } from "@/types/project-area-answer";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import { scopesForProjectArea } from "@/lib/scopes-for-project-area";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import { singleYesAnswerId } from "@/lib/scope-single-yes-answer";
import type { ScopePublic } from "@/types/scope";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProjectAreaSetupTab = "details" | "objects" | "questions";
type EditAreaModalTab = "details" | "objects" | "questions";

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToIso(s: string): string | null {
  if (!s.trim()) return null;
  return new Date(`${s}T12:00:00`).toISOString();
}

function numToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseNumberOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error("Value must be a number");
  return n;
}

function formatLoad(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sumIncludedAreaLoads(
  rows: ProjectAreaObjectPublic[],
  key:
    | "constructionAssistantHours"
    | "leadContractorHours"
    | "electricianHours"
    | "plumberHours"
    | "generalHours"
    | "projectManagerHours"
    | "paintingHours"
    | "plasteringHours",
): number {
  return rows.reduce((sum, row) => {
    if (row.included === false) return sum;
    const v = row[key];
    return sum + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}

export function ProjectAreasPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectDocId = searchParams.get("id");
  const areaParam = searchParams.get("area");
  const { lookups } = useLookups();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [project, setProject] = useState<ProjectPublic | null>(null);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [projectAreas, setProjectAreas] = useState<ProjectAreaPublic[]>([]);
  const [projectAreaObjects, setProjectAreaObjects] = useState<ProjectAreaObjectPublic[]>([]);
  const [projectAreaAnswers, setProjectAreaAnswers] = useState<ProjectAreaAnswerPublic[]>([]);
  const [projectAreasLoading, setProjectAreasLoading] = useState(false);
  const [projectAreaObjectsLoading, setProjectAreaObjectsLoading] = useState(false);
  const [projectAreaAnswersLoading, setProjectAreaAnswersLoading] = useState(false);
  const [paSaving, setPaSaving] = useState(false);
  const [paoSaving, setPaoSaving] = useState(false);
  const [answerSavingId, setAnswerSavingId] = useState<string | null>(null);
  const [paDeleting, setPaDeleting] = useState(false);
  const [paoDeleting, setPaoDeleting] = useState(false);
  const [paDeleteId, setPaDeleteId] = useState<string | null>(null);
  const [paoDeleteId, setPaoDeleteId] = useState<string | null>(null);
  const [paEditingId, setPaEditingId] = useState<string | null>(null);
  const [paoEditingId, setPaoEditingId] = useState<string | null>(null);
  const [quoteObjects, setQuoteObjects] = useState<QuoteObjectPublic[]>([]);
  const [scopes, setScopes] = useState<ScopePublic[]>([]);
  const [priceLevels, setPriceLevels] = useState<PriceLevelPublic[]>([]);
  const [catalogSkus, setCatalogSkus] = useState<DataSkuPublic[]>([]);
  const [suppliersBySkuId, setSuppliersBySkuId] = useState<
    Record<string, DataSkuSupplierPublic[]>
  >({});
  const [scopeAnswerSaving, setScopeAnswerSaving] = useState<string | null>(null);
  /** Resets inline add selects after a successful add (checklist-style). */
  const [checklistPickerTick, setChecklistPickerTick] = useState(0);
  const [areaTierSaving, setAreaTierSaving] = useState(false);
  const [lineTierSavingId, setLineTierSavingId] = useState<string | null>(null);
  const [setupTab, setSetupTab] = useState<ProjectAreaSetupTab>("details");

  const [pickAreaOpen, setPickAreaOpen] = useState(false);
  /** When adding an area manually: used if the project has no `defaultpricelevelid`. */
  const [addAreaPriceLevelId, setAddAreaPriceLevelId] = useState<number | null>(null);
  /** Optional label when adding another instance of a template (e.g. "Master bedroom"). */
  const [addAreaDisplayName, setAddAreaDisplayName] = useState("");
  const [editAreaOpen, setEditAreaOpen] = useState(false);
  const [editAreaTab, setEditAreaTab] = useState<EditAreaModalTab>("details");
  const [pickObjectOpen, setPickObjectOpen] = useState(false);
  const [editObjectOpen, setEditObjectOpen] = useState(false);

  const selectedProjectArea = useMemo(() => {
    if (projectAreas.length === 0) return null;
    if (areaParam) {
      const m = projectAreas.find((pa) => pa.id === areaParam);
      if (m) return m;
    }
    return projectAreas[0];
  }, [projectAreas, areaParam]);

  const [numericProjectId, setNumericProjectId] = useState<number | null>(null);

  const [paNotes1, setPaNotes1] = useState("");
  const [paNotes2, setPaNotes2] = useState("");
  const [paDisplayName, setPaDisplayName] = useState("");
  const [paM2Str, setPaM2Str] = useState("");
  const [paPriceLevelId, setPaPriceLevelId] = useState<number | null>(null);
  const [paStyle, setPaStyle] = useState("");
  const [paColour, setPaColour] = useState("");

  const [paoDateAdded, setPaoDateAdded] = useState("");
  const [paoCustomMeasureStr, setPaoCustomMeasureStr] = useState("");
  const [paoCustomUom, setPaoCustomUom] = useState("");
  const [paoCustomUmPriceStr, setPaoCustomUmPriceStr] = useState("");
  const [paoTotalPriceStr, setPaoTotalPriceStr] = useState("");
  const [paoNotes1, setPaoNotes1] = useState("");
  const [paoNotes2, setPaoNotes2] = useState("");
  const [paoGeneralLoadStr, setPaoGeneralLoadStr] = useState("");
  const [paoPlumbingLoadStr, setPaoPlumbingLoadStr] = useState("");
  const [paoElecLoadStr, setPaoElecLoadStr] = useState("");
  const [paoPmLoadStr, setPaoPmLoadStr] = useState("");
  const [paoCntrLoadStr, setPaoCntrLoadStr] = useState("");
  const [paoAssCntrLoadStr, setPaoAssCntrLoadStr] = useState("");
  const [paoPriceLevelId, setPaoPriceLevelId] = useState<number | null>(null);
  const [paoInitialPriceLevelId, setPaoInitialPriceLevelId] = useState<number | null>(null);
  const [paoStyle, setPaoStyle] = useState("");
  const [paoColour, setPaoColour] = useState("");

  const baseStyleOptions = useMemo(() => {
    const out = distinctLookupValues(lookups, LOOKUP_TYPE_STYLE);
    return { out, seen: new Set(out) };
  }, [lookups]);

  const areasSortedForPicker = useMemo(() => {
    return [...areas]
      .filter((a) => a.areaid != null)
      .sort((a, b) =>
        (a.areaname || "").localeCompare(b.areaname || "", undefined, {
          sensitivity: "base",
        }),
      );
  }, [areas]);

  const scopesForSelectedArea = useMemo(
    () =>
      selectedProjectArea
        ? scopesForProjectArea(selectedProjectArea, areas, scopes)
        : [],
    [scopes, selectedProjectArea, areas],
  );

  const loadAreas = useCallback(async () => {
    const res = await fetch("/api/areas");
    const data = (await res.json()) as { areas?: AreaPublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load areas");
    setAreas(data.areas ?? []);
  }, []);

  const loadQuoteObjects = useCallback(async () => {
    const res = await fetch("/api/quote-objects");
    const data = (await res.json()) as { quoteObjects?: QuoteObjectPublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load quote objects");
    setQuoteObjects(data.quoteObjects ?? []);
  }, []);

  const loadScopes = useCallback(async () => {
    const res = await fetch("/api/scopes");
    const data = (await res.json()) as { scopes?: ScopePublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load scopes");
    setScopes(data.scopes ?? []);
  }, []);

  const loadPriceLevels = useCallback(async () => {
    const res = await fetch("/api/price-levels");
    const data = (await res.json()) as { priceLevels?: PriceLevelPublic[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to load price levels");
    setPriceLevels(data.priceLevels ?? []);
  }, []);

  const loadCatalogSkus = useCallback(async () => {
    const { skus, suppliersBySkuId: suppliers } = await loadCatalogSkuData();
    setCatalogSkus(skus);
    setSuppliersBySkuId(suppliers);
  }, []);

  const loadProjectAreas = useCallback(async () => {
    if (!projectDocId) return;
    setProjectAreasLoading(true);
    try {
      const res = await fetch(
        `/api/projectareas?projectDocId=${encodeURIComponent(projectDocId)}`,
      );
      const data = (await res.json()) as { projectAreas?: ProjectAreaPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load project areas");
      setProjectAreas(data.projectAreas ?? []);
    } finally {
      setProjectAreasLoading(false);
    }
  }, [projectDocId]);

  const loadProjectAreaObjects = useCallback(
    async (projectAreaDocId: string) => {
      if (!projectDocId) return;
      setProjectAreaObjectsLoading(true);
      try {
        const res = await fetch(
          `/api/projectareaobjects?projectDocId=${encodeURIComponent(projectDocId)}&projectAreaDocId=${encodeURIComponent(projectAreaDocId)}`,
        );
        const data = (await res.json()) as {
          projectAreaObjects?: ProjectAreaObjectPublic[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load project area objects");
        setProjectAreaObjects(data.projectAreaObjects ?? []);
      } finally {
        setProjectAreaObjectsLoading(false);
      }
    },
    [projectDocId],
  );

  const loadProjectAreaAnswers = useCallback(
    async (projectAreaDocId: string) => {
      if (!projectDocId) return;
      setProjectAreaAnswersLoading(true);
      try {
        const res = await fetch(
          `/api/projectareaanswers?projectDocId=${encodeURIComponent(projectDocId)}&projectAreaDocId=${encodeURIComponent(projectAreaDocId)}`,
        );
        const data = (await res.json()) as {
          projectAreaAnswers?: ProjectAreaAnswerPublic[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load area questions");
        setProjectAreaAnswers(data.projectAreaAnswers ?? []);
      } finally {
        setProjectAreaAnswersLoading(false);
      }
    },
    [projectDocId],
  );

  const patchProjectAreaAnswer = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setAnswerSavingId(id);
      setError(null);
      try {
        const res = await fetch(`/api/projectareaanswers/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await readApiResponse<{
          projectAreaAnswer?: ProjectAreaAnswerPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.projectAreaAnswer) {
          setProjectAreaAnswers((prev) =>
            prev.map((a) => (a.id === id ? data.projectAreaAnswer! : a)),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        if (selectedProjectArea) {
          await loadProjectAreaAnswers(selectedProjectArea.id);
        }
      } finally {
        setAnswerSavingId(null);
      }
    },
    [loadProjectAreaAnswers, selectedProjectArea],
  );

  const applyScopeAnswer = useCallback(
    async (scopeDocId: string, answerid: string | null) => {
      if (!selectedProjectArea) return;
      setScopeAnswerSaving(scopeDocId);
      setError(null);
      try {
        const res = await fetch(
          `/api/projectareas/${encodeURIComponent(selectedProjectArea.id)}/scope-answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scopeDocId, answerid }),
          },
        );
        const data = await readApiResponse<{
          projectArea?: ProjectAreaPublic;
          linesAdded?: number;
          linesRemoved?: number;
          diagnostics?: {
            effectivePriceLevelId: number | null;
            noLinesReason?: string;
            attachedCategories?: string[];
            answerTierIds?: number[];
          };
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to update scope answer");
        if (typeof data.linesAdded === "number") {
          console.debug("[scope-answer]", {
            linesAdded: data.linesAdded,
            linesRemoved: data.linesRemoved,
            diagnostics: data.diagnostics,
          });
          if (
            data.linesAdded === 0 &&
            answerid != null &&
            data.diagnostics?.noLinesReason &&
            data.diagnostics.noLinesReason !== "answer_cleared"
          ) {
            console.warn(
              "[scope-answer] No lines were added. Check diagnostics (often: no categories on the answer, no matching quote objects, or re-save scopes under Setup → Scopes).",
              data.diagnostics,
            );
          }
        }
        if (data.projectArea) {
          setProjectAreas((prev) =>
            prev.map((p) => (p.id === data.projectArea!.id ? data.projectArea! : p)),
          );
        }
        await loadProjectAreaObjects(selectedProjectArea.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scope answer update failed");
        await loadProjectAreas();
      } finally {
        setScopeAnswerSaving(null);
      }
    },
    [selectedProjectArea, loadProjectAreaObjects, loadProjectAreas],
  );

  const addExtraScopeToSelectedArea = useCallback(
    async (scopeDocId: string) => {
      if (!selectedProjectArea) return;
      const pa = selectedProjectArea;
      const prev = pa.extraScopeDocIds ?? [];
      if (prev.includes(scopeDocId)) return;
      setError(null);
      try {
        const res = await fetch(`/api/projectareas/${encodeURIComponent(pa.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraScopeDocIds: [...prev, scopeDocId] }),
        });
        const data = await readApiResponse<{ projectArea?: ProjectAreaPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to add scope");
        if (data.projectArea) {
          setProjectAreas((p) => p.map((x) => (x.id === pa.id ? data.projectArea! : x)));
        }
        setChecklistPickerTick((t) => t + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add scope");
        await loadProjectAreas();
      }
    },
    [selectedProjectArea, loadProjectAreas],
  );

  const removeExtraScopeFromSelectedArea = useCallback(
    async (scopeDocId: string) => {
      if (!selectedProjectArea) return;
      const pa = selectedProjectArea;
      const prev = pa.extraScopeDocIds ?? [];
      if (!prev.includes(scopeDocId)) return;
      const next = prev.filter((id) => id !== scopeDocId);
      setError(null);
      try {
        const res = await fetch(`/api/projectareas/${encodeURIComponent(pa.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraScopeDocIds: next }),
        });
        const data = await readApiResponse<{ projectArea?: ProjectAreaPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to remove scope");
        if (data.projectArea) {
          setProjectAreas((p) => p.map((x) => (x.id === pa.id ? data.projectArea! : x)));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove scope");
        await loadProjectAreas();
      }
    },
    [selectedProjectArea, loadProjectAreas],
  );

  const addManualQuoteObjectToSelectedArea = useCallback(
    async (quoteObjectDocId: string) => {
      if (!selectedProjectArea || !projectDocId) return;
      setError(null);
      try {
        const res = await fetch("/api/projectareaobjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectAreaDocId: selectedProjectArea.id,
            quoteObjectDocId,
          }),
        });
        const data = await readApiResponse<{ error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to add line");
        await loadProjectAreaObjects(selectedProjectArea.id);
        setChecklistPickerTick((t) => t + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add quote object");
        await loadProjectAreaObjects(selectedProjectArea.id);
      }
    },
    [selectedProjectArea, projectDocId, loadProjectAreaObjects],
  );

  const patchAreaPriceLevel = useCallback(
    async (paId: string, pricelevelid: number | null) => {
      setAreaTierSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/projectareas/${encodeURIComponent(paId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricelevelid }),
        });
        const data = await readApiResponse<{ projectArea?: ProjectAreaPublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.projectArea) {
          setProjectAreas((prev) => prev.map((p) => (p.id === paId ? data.projectArea! : p)));
          await loadProjectAreaObjects(data.projectArea.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Area tier save failed");
        await loadProjectAreas();
      } finally {
        setAreaTierSaving(false);
      }
    },
    [loadProjectAreas, loadProjectAreaObjects],
  );

  const patchLineTier = useCallback(
    async (lineId: string, body: Record<string, unknown>) => {
      if (!selectedProjectArea) return;
      setLineTierSavingId(lineId);
      setError(null);
      try {
        const res = await fetch(`/api/projectareaobjects/${encodeURIComponent(lineId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await readApiResponse<{
          projectAreaObject?: ProjectAreaObjectPublic;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.projectAreaObject) {
          setProjectAreaObjects((prev) =>
            prev.map((r) => (r.id === lineId ? data.projectAreaObject! : r)),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Line tier save failed");
        await loadProjectAreaObjects(selectedProjectArea.id);
      } finally {
        setLineTierSavingId(null);
      }
    },
    [selectedProjectArea, loadProjectAreaObjects],
  );

  useEffect(() => {
    async function boot() {
      if (!projectDocId) {
        setLoading(false);
        setProject(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadAreas(),
          loadQuoteObjects(),
          loadScopes(),
          loadPriceLevels(),
          loadCatalogSkus(),
          (async () => {
            const res = await fetch(`/api/projects/${projectDocId}`);
            const data = await readApiResponse<{ project?: ProjectPublic; error?: string }>(res);
            if (!res.ok || !data.project) throw new Error(data.error ?? "Failed to load project");
            setProject(data.project);
            setNumericProjectId(
              typeof data.project.projectid === "number" && Number.isInteger(data.project.projectid)
                ? data.project.projectid
                : null,
            );
          })(),
        ]);
        await loadProjectAreas();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [projectDocId, loadAreas, loadQuoteObjects, loadScopes, loadProjectAreas]);

  useEffect(() => {
    if (!projectDocId || projectAreasLoading) return;
    if (projectAreas.length === 0) return;
    const match = areaParam ? projectAreas.find((pa) => pa.id === areaParam) : undefined;
    if (!match) {
      const first = projectAreas[0];
      const params = new URLSearchParams(searchParams.toString());
      params.set("area", first.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [
    projectDocId,
    projectAreas,
    projectAreasLoading,
    areaParam,
    pathname,
    router,
    searchParams,
  ]);

  const selectedProjectAreaId = selectedProjectArea?.id ?? null;
  useEffect(() => {
    setPickAreaOpen(false);
    setEditAreaOpen(false);
    setPickObjectOpen(false);
    setEditObjectOpen(false);
    setPaEditingId(null);
    setPaNotes1("");
    setPaNotes2("");
    setPaDisplayName("");
    setPaM2Str("");
    setPaPriceLevelId(null);
    setPaoEditingId(null);
    setPaoDateAdded("");
    setPaoCustomMeasureStr("");
    setPaoCustomUom("");
    setPaoCustomUmPriceStr("");
    setPaoTotalPriceStr("");
    setPaoNotes1("");
    setPaoNotes2("");
    setPaoGeneralLoadStr("");
    setPaoPlumbingLoadStr("");
    setPaoElecLoadStr("");
    setPaoPmLoadStr("");
    setPaoCntrLoadStr("");
    setPaoAssCntrLoadStr("");
    setPaoPriceLevelId(null);
    setPaoInitialPriceLevelId(null);

    if (selectedProjectAreaId == null) {
      setProjectAreaObjects([]);
      setProjectAreaAnswers([]);
      return;
    }

    setSetupTab("details");
    void loadProjectAreaObjects(selectedProjectAreaId);
    void loadProjectAreaAnswers(selectedProjectAreaId);
  }, [selectedProjectAreaId, loadProjectAreaObjects, loadProjectAreaAnswers]);

  useEffect(() => {
    if (!projectDocId || selectedProjectAreaId == null) return;
    void loadScopes();
  }, [projectDocId, selectedProjectAreaId, loadScopes]);

  function selectArea(pa: ProjectAreaPublic) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("area", pa.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function openEditAreaModal() {
    if (!selectedProjectArea) return;
    const pa = selectedProjectArea;
    setPaEditingId(pa.id);
    setPaNotes1(pa.areanotes1);
    setPaNotes2(pa.areanotes2);
    setPaDisplayName(pa.displayName ?? "");
    setPaM2Str(numToInput(pa.aream2));
    setPaPriceLevelId(pa.pricelevelid ?? null);
    setPaStyle(pa.style ?? "");
    setPaColour(pa.colour ?? "");
    setEditAreaTab("details");
    setEditAreaOpen(true);
  }

  function closeEditAreaModal() {
    setEditAreaOpen(false);
    setPaEditingId(null);
    setPaNotes1("");
    setPaNotes2("");
    setPaDisplayName("");
    setPaM2Str("");
    setPaPriceLevelId(null);
    setPaStyle("");
    setPaColour("");
    setEditAreaTab("details");
  }

  async function saveEditedProjectArea() {
    if (!paEditingId) return;
    setPaSaving(true);
    setError(null);
    try {
      const payload = {
        displayName: paDisplayName.trim() ? paDisplayName.trim() : null,
        areanotes1: paNotes1,
        areanotes2: paNotes2,
        aream2: parseNumberOrNull(paM2Str),
        pricelevelid: paPriceLevelId,
        style: paStyle.trim() ? paStyle.trim() : null,
        colour: paColour.trim() ? paColour.trim() : null,
      };
      const res = await fetch(`/api/projectareas/${paEditingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      closeEditAreaModal();
      await loadProjectAreas();
      await loadProjectAreaObjects(paEditingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project area save failed");
    } finally {
      setPaSaving(false);
    }
  }

  function openPickAreaModal() {
    setAddAreaPriceLevelId(project?.defaultpricelevelid ?? null);
    setAddAreaDisplayName("");
    setPickAreaOpen(true);
  }

  async function addProjectAreaFromTemplate(areaDocId: string) {
    if (!projectDocId) return;
    const inheritedPl = project?.defaultpricelevelid ?? null;
    const pricelevelid = inheritedPl ?? addAreaPriceLevelId;
    if (pricelevelid == null) {
      setError(
        "Select a price tier for this area. The project has no default tier—set one on the project or pick a tier below.",
      );
      return;
    }
    setPaSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projectareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectDocId,
          areaDocId,
          displayName: addAreaDisplayName.trim() ? addAreaDisplayName.trim() : null,
          areanotes1: "",
          areanotes2: "",
          aream2: null,
          areafinish: "",
          pricelevelid,
        }),
      });
      const data = await readApiResponse<{ id?: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Add area failed");
      setPickAreaOpen(false);
      await loadProjectAreas();
      await loadScopes();
      if (typeof data.id === "string") {
        const params = new URLSearchParams(searchParams.toString());
        params.set("area", data.id);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project area save failed");
    } finally {
      setPaSaving(false);
    }
  }

  function openEditLineModal(row: ProjectAreaObjectPublic) {
    setPaoEditingId(row.id);
    setPaoDateAdded(isoToDateInput(row.dateadded));
    setPaoCustomMeasureStr(numToInput(row.custommeasure));
    setPaoCustomUom(row.customuom);
    setPaoCustomUmPriceStr(numToInput(row.customumprice));
    setPaoTotalPriceStr(numToInput(row.totalprice));
    setPaoGeneralLoadStr(numToInput(row.generalHours));
    setPaoPlumbingLoadStr(numToInput(row.plumberHours));
    setPaoElecLoadStr(numToInput(row.electricianHours));
    setPaoPmLoadStr(numToInput(row.projectManagerHours));
    setPaoCntrLoadStr(numToInput(row.leadContractorHours));
    setPaoAssCntrLoadStr(numToInput(row.constructionAssistantHours));
    setPaoNotes1(row.notes1);
    setPaoNotes2(row.notes2);
    const pl = row.pricelevelid ?? null;
    setPaoPriceLevelId(pl);
    setPaoInitialPriceLevelId(pl);
    setPaoStyle(row.style ?? "");
    setPaoColour(row.colour ?? "");
    setEditObjectOpen(true);
  }

  function closeEditLineModal() {
    setEditObjectOpen(false);
    setPaoEditingId(null);
    setPaoDateAdded("");
    setPaoCustomMeasureStr("");
    setPaoCustomUom("");
    setPaoCustomUmPriceStr("");
    setPaoTotalPriceStr("");
    setPaoNotes1("");
    setPaoNotes2("");
    setPaoGeneralLoadStr("");
    setPaoPlumbingLoadStr("");
    setPaoElecLoadStr("");
    setPaoPmLoadStr("");
    setPaoCntrLoadStr("");
    setPaoAssCntrLoadStr("");
    setPaoPriceLevelId(null);
    setPaoInitialPriceLevelId(null);
    setPaoStyle("");
    setPaoColour("");
  }

  async function saveEditedLineItem() {
    if (!paoEditingId || !selectedProjectArea) return;
    setPaoSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        dateadded: dateInputToIso(paoDateAdded),
        custommeasure: parseNumberOrNull(paoCustomMeasureStr),
        customuom: paoCustomUom,
        customumprice: parseNumberOrNull(paoCustomUmPriceStr),
        totalprice: parseNumberOrNull(paoTotalPriceStr),
        generalHours: parseNumberOrNull(paoGeneralLoadStr),
        plumberHours: parseNumberOrNull(paoPlumbingLoadStr),
        electricianHours: parseNumberOrNull(paoElecLoadStr),
        projectManagerHours: parseNumberOrNull(paoPmLoadStr),
        leadContractorHours: parseNumberOrNull(paoCntrLoadStr),
        constructionAssistantHours: parseNumberOrNull(paoAssCntrLoadStr),
        notes1: paoNotes1,
        notes2: paoNotes2,
      };
      const plCur = paoPriceLevelId ?? null;
      const plIni = paoInitialPriceLevelId ?? null;
      if (plCur !== plIni) {
        payload.pricelevelid = paoPriceLevelId;
      }
      payload.style = paoStyle.trim() ? paoStyle.trim() : null;
      payload.colour = paoColour.trim() ? paoColour.trim() : null;
      const res = await fetch(`/api/projectareaobjects/${paoEditingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const patchData = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(patchData.error ?? "Update failed");
      closeEditLineModal();
      await loadProjectAreaObjects(selectedProjectArea.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project area object save failed");
    } finally {
      setPaoSaving(false);
    }
  }

  async function addLineItemFromQuoteObject(quoteObjectDocId: string) {
    if (!selectedProjectArea) return;
    setPaoSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projectareaobjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectAreaDocId: selectedProjectArea.id,
          quoteObjectDocId,
          dateadded: null,
          notes1: "",
          notes2: "",
        }),
      });
      const postData = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(postData.error ?? "Add failed");
      setPickObjectOpen(false);
      await loadProjectAreaObjects(selectedProjectArea.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project area object save failed");
    } finally {
      setPaoSaving(false);
    }
  }

  async function confirmProjectAreaDelete() {
    if (!paDeleteId || !projectDocId) return;
    setPaDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projectareas/${paDeleteId}`, { method: "DELETE" });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPaDeleteId(null);
      await loadProjectAreas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove project area");
    } finally {
      setPaDeleting(false);
    }
  }

  async function confirmProjectAreaObjectDelete() {
    if (!paoDeleteId || !selectedProjectArea) return;
    setPaoDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projectareaobjects/${paoDeleteId}`, { method: "DELETE" });
      const data = await readApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPaoDeleteId(null);
      await loadProjectAreaObjects(selectedProjectArea.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove line item");
    } finally {
      setPaoDeleting(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  const projectAreaPendingDelete = paDeleteId
    ? projectAreas.find((pa) => pa.id === paDeleteId)
    : undefined;

  const pickAreaFooter = (
    <button
      type="button"
      onClick={() => setPickAreaOpen(false)}
      className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
    >
      Cancel
    </button>
  );

  const pickObjectFooter = (
    <button
      type="button"
      onClick={() => setPickObjectOpen(false)}
      className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
    >
      Cancel
    </button>
  );

  const selectedAreaLoadTotals = useMemo(
    () => ({
      constructionAssistantHours: sumIncludedAreaLoads(
        projectAreaObjects,
        "constructionAssistantHours",
      ),
      leadContractorHours: sumIncludedAreaLoads(projectAreaObjects, "leadContractorHours"),
      electricianHours: sumIncludedAreaLoads(projectAreaObjects, "electricianHours"),
      plumberHours: sumIncludedAreaLoads(projectAreaObjects, "plumberHours"),
      generalHours: sumIncludedAreaLoads(projectAreaObjects, "generalHours"),
      projectManagerHours: sumIncludedAreaLoads(projectAreaObjects, "projectManagerHours"),
      paintingHours: sumIncludedAreaLoads(projectAreaObjects, "paintingHours"),
      plasteringHours: sumIncludedAreaLoads(projectAreaObjects, "plasteringHours"),
    }),
    [projectAreaObjects],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">Project areas</h1>
        <ProjectsTabs />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
          {project
            ? `${project.projectname}${numericProjectId != null ? ` · ID ${numericProjectId}` : ""}`
            : "Choose a project to manage its areas."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/projects"
            className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
          >
            All projects
          </Link>
          {projectDocId ? (
            <Link
              href={`/projects/project?id=${encodeURIComponent(projectDocId)}`}
              className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
            >
              Project detail
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {!projectDocId ? (
        <div className="rounded-lg border border-sf-border bg-sf-surface p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-sf-text-secondary dark:text-zinc-300">
            Open this screen from a project: use{" "}
            <span className="font-medium">Project areas</span> on the projects grid, or add{" "}
            <code className="rounded bg-sf-page px-1.5 py-0.5 text-sm dark:bg-zinc-800">
              ?id=&lt;project id&gt;&amp;area=&lt;area doc id&gt;
            </code>{" "}
            (area is optional; the app picks one if omitted).
          </p>
        </div>
      ) : loading ? (
        <p className="text-sf-text-secondary dark:text-zinc-400">Loading…</p>
      ) : numericProjectId == null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          This project needs a numeric ID before areas can be added. Save it once from the Project
          tab, or run Assign missing numeric IDs from the Projects list.
        </div>
      ) : (
        <div className="space-y-4">
          {project ? (
            <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-sf-border bg-sf-page/95 px-1 py-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/95">
              <span className="text-sm font-semibold text-sf-text dark:text-zinc-200">
                {project.projectname}
              </span>
              {selectedProjectArea ? (
                <span className="text-sm text-sf-text-secondary dark:text-zinc-400">
                  · {projectAreaHeading(selectedProjectArea, areas)}
                </span>
              ) : (
                <span className="text-sm text-sf-text-weak dark:text-sf-text-weak">· Select an area</span>
              )}
            </div>
          ) : null}
          <div className="flex min-h-[28rem] flex-col gap-4 lg:flex-row lg:gap-6">
            <aside className="shrink-0 lg:w-64 lg:border-r lg:border-sf-border lg:pr-4 dark:lg:border-zinc-800">
              <h2 className="mb-2 text-sm font-semibold text-sf-text dark:text-zinc-200">
                Areas in project
              </h2>
              {projectAreasLoading ? (
                <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Loading…</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openPickAreaModal()}
                    disabled={paSaving}
                    className="mb-3 w-full min-h-11 rounded-lg bg-sf-brand px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Add area…
                  </button>
                  {projectAreas.length === 0 ? (
                    <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                      No areas yet. Use Add area.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {projectAreas.map((pa) => {
                        const active = selectedProjectArea?.id === pa.id;
                        return (
                          <li key={pa.id}>
                            <button
                              type="button"
                              onClick={() => selectArea(pa)}
                              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                                active
                                  ? "bg-sf-brand text-white"
                                  : "bg-sf-page text-sf-text hover:bg-sf-border/50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                              }`}
                            >
                              {projectAreaHeading(pa, areas)}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </aside>

            <div className="min-w-0 flex-1 space-y-6">
              {selectedProjectArea ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">
                      {projectAreaHeading(selectedProjectArea, areas)}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditAreaModal()}
                        className={sfRowIconBtn}
                        aria-label="Edit project area"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaDeleteId(selectedProjectArea.id)}
                        className={sfRowIconBtnDanger}
                        aria-label="Remove area from project"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className={sfTabStripClass} role="tablist" aria-label="Project area sections">
                    <button
                      type="button"
                      className={sfUnderlineTabClass(setupTab === "details")}
                      role="tab"
                      aria-selected={setupTab === "details"}
                      onClick={() => setSetupTab("details")}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className={sfUnderlineTabClass(setupTab === "objects")}
                      role="tab"
                      aria-selected={setupTab === "objects"}
                      onClick={() => setSetupTab("objects")}
                    >
                      Objects
                    </button>
                    <button
                      type="button"
                      className={sfUnderlineTabClass(setupTab === "questions")}
                      role="tab"
                      aria-selected={setupTab === "questions"}
                      onClick={() => setSetupTab("questions")}
                    >
                      Questions
                    </button>
                  </div>

                  {setupTab === "details" ? (
                    <>
                      <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/45 dark:bg-violet-950/25">
                        <div>
                          <h4 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
                            Scope questions
                          </h4>
                          <p className="text-xs text-violet-900/85 dark:text-violet-200/85">
                            Answer each question to add scope-linked lines. Pricing uses the{" "}
                            <span className="font-medium">effective price level</span> for this area
                            (area override or project default). You can override tier per line in the
                            line items table. Only the matching tier on each answer is used—if that tier
                            has no linked objects, no lines are added.
                          </p>
                        </div>
                        {scopesForSelectedArea.length > 0 ? (
                          <ul className="space-y-3">
                            {scopesForSelectedArea.map((scope) => {
                          if (scope.kind === "header") {
                            return (
                              <li
                                key={scope.id}
                                className="border-b border-violet-200/60 pb-2 pt-1 dark:border-violet-900/40"
                              >
                                <span className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200/90">
                                  {scope.question}
                                </span>
                              </li>
                            );
                          }
                          if (scope.kind === "footer") {
                            return (
                              <li key={scope.id} aria-hidden className="hidden" />
                            );
                          }
                          const saved = selectedProjectArea.scopeAnswers?.find(
                            (e) => e.scopeDocId === scope.id,
                          );
                          const value = saved?.answerid ?? "";
                          const busy = scopeAnswerSaving === scope.id;
                          const yesOnlyId = singleYesAnswerId(scope);
                          const isExtraScope = (selectedProjectArea.extraScopeDocIds ?? []).includes(
                            scope.id,
                          );
                          return (
                            <li
                              key={scope.id}
                              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
                            >
                              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-sf-text dark:text-zinc-200">
                                <span className="min-w-0">{scope.question}</span>
                                {isExtraScope ? (
                                  <button
                                    type="button"
                                    className="shrink-0 rounded-full px-1.5 py-0.5 text-xs text-sf-text-weak hover:bg-violet-200/60 hover:text-sf-text dark:hover:bg-violet-900/50 dark:hover:text-zinc-100"
                                    title="Remove this added scope from this area only"
                                    aria-label={`Remove added scope: ${scope.question}`}
                                    onClick={() => void removeExtraScopeFromSelectedArea(scope.id)}
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </span>
                              {yesOnlyId ? (
                                <label className="inline-flex cursor-pointer items-center text-sm text-sf-text dark:text-zinc-200">
                                  <input
                                    type="checkbox"
                                    className="size-4 shrink-0 rounded border-sf-border-strong accent-green-600 focus:ring-2 focus:ring-green-500/40 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-500"
                                    disabled={busy}
                                    checked={value === yesOnlyId}
                                    onChange={(e) => {
                                      void applyScopeAnswer(
                                        scope.id,
                                        e.target.checked ? yesOnlyId : null,
                                      );
                                    }}
                                    aria-label={`Yes — ${scope.question}`}
                                  />
                                </label>
                              ) : (
                                <select
                                  className={`${inputClass} w-full min-w-[10rem] max-w-md sm:w-auto`}
                                  disabled={busy}
                                  value={value}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    void applyScopeAnswer(scope.id, v === "" ? null : v);
                                  }}
                                >
                                  <option value="">— None (clear scope lines) —</option>
                                  {scope.answers.map((a) => (
                                    <option key={a.answerid} value={a.answerid}>
                                      {a.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {busy ? (
                                <span className="text-xs text-sf-text-weak">Updating…</span>
                              ) : null}
                            </li>
                          );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                            No scope questions apply to this template area yet. Add them under{" "}
                            <span className="font-medium">Setup → Scopes</span>, or use Add scope
                            below to attach a question from another template.
                          </p>
                        )}
                        {(() => {
                          const aid = Number(selectedProjectArea.areaid);
                          const templateAreaDocId = Number.isInteger(aid)
                            ? (areas.find((a) => a.areaid != null && Number(a.areaid) === aid)?.id ??
                              null)
                            : null;
                          const generalAreaTemplateDocId =
                            areas.find((a) => (a.areaname ?? "").trim().toLowerCase() === "general")
                              ?.id ?? null;
                          const areaTagDocIds = new Set<string>(
                            [templateAreaDocId, generalAreaTemplateDocId].filter(
                              (x): x is string => typeof x === "string" && x.trim() !== "",
                            ),
                          );
                          const scopeAddCandidates = scopes.filter((s) => {
                            if (s.kind !== "question") return false;
                            if (scopesForSelectedArea.some((x) => x.id === s.id)) return false;
                            if (areaTagDocIds.size === 0) return false;
                            const tags = s.areaDocIds ?? [];
                            return tags.some((t) => areaTagDocIds.has(t));
                          });
                          const qLabel = (s: ScopePublic) =>
                            (s.question ?? "").trim() || `Scope ${s.scopeid ?? ""}`;
                          return (
                            <div className="flex flex-col gap-2 border-t border-violet-200/60 pt-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3 dark:border-violet-900/35">
                              <div className="min-w-0 flex-1 sm:max-w-xs">
                                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-violet-900 dark:text-violet-200/90">
                                  Add setup scope
                                </label>
                                <select
                                  key={`add-scope-${selectedProjectArea.id}-${checklistPickerTick}`}
                                  className={`${inputClass} w-full text-xs`}
                                  defaultValue=""
                                  aria-label="Add a setup scope to this area"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (!v) return;
                                    void addExtraScopeToSelectedArea(v);
                                  }}
                                >
                                  <option value="">— Add scope…</option>
                                  {scopeAddCandidates.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {qLabel(s)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="min-w-0 flex-1 sm:max-w-xs">
                                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-violet-900 dark:text-violet-200/90">
                                  Add quote object
                                </label>
                                <select
                                  key={`add-qo-${selectedProjectArea.id}-${checklistPickerTick}`}
                                  className={`${inputClass} w-full text-xs`}
                                  defaultValue=""
                                  aria-label="Add a quote object line to this area"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (!v) return;
                                    void addManualQuoteObjectToSelectedArea(v);
                                  }}
                                >
                                  <option value="">— Add quote object…</option>
                                  {[...quoteObjects]
                                    .filter((q) => {
                                      const tagIds = q.areaTagIds ?? [];
                                      if (templateAreaDocId && tagIds.includes(templateAreaDocId))
                                        return true;
                                      if (
                                        generalAreaTemplateDocId &&
                                        tagIds.includes(generalAreaTemplateDocId)
                                      )
                                        return true;
                                      return false;
                                    })
                                    .sort((a, b) =>
                                      (a.objectname || "").localeCompare(b.objectname || "", undefined, {
                                        sensitivity: "base",
                                      }),
                                    )
                                    .map((q) => (
                                      <option key={q.id} value={q.id}>
                                        {q.objectname?.trim() || `Object #${q.objectid}`}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2 rounded-lg border border-sf-border bg-sf-surface p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                        <h4 className="text-sm font-semibold text-sf-text dark:text-zinc-100">
                          Area price level
                        </h4>
                        <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                          Overrides the project default for scope answers and template pricing on
                          new lines. Per-line tier overrides are on the Objects tab.
                        </p>
                        <PriceLevelIdSelect
                          value={selectedProjectArea.pricelevelid ?? null}
                          onChange={(id) => void patchAreaPriceLevel(selectedProjectArea.id, id)}
                          className={inputClass}
                          disabled={areaTierSaving}
                          emptyLabel={
                            project?.defaultpricelevelid != null
                              ? `Default (project #${project.defaultpricelevelid})`
                              : "Default (project)"
                          }
                        />
                        {areaTierSaving ? (
                          <p className="text-xs text-sf-text-weak">Saving tier…</p>
                        ) : null}
                      </div>
                    </>
                  ) : setupTab === "objects" ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                          Quote lines for this area. Edit a line for measures, loads, and notes.
                        </p>
                        <button
                          type="button"
                          onClick={() => setPickObjectOpen(true)}
                          className="min-h-11 rounded-lg bg-sf-brand px-4 py-2.5 text-sm font-medium text-white"
                        >
                          Add object…
                        </button>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-sf-border dark:border-zinc-700">
                        {projectAreaObjectsLoading ? (
                          <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                            Loading…
                          </p>
                        ) : (
                          <table className="w-full min-w-[48rem] text-left text-sm">
                            <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                              <tr>
                                <th className="px-3 py-2 font-semibold">Incl.</th>
                                <th className="px-3 py-2 font-semibold">Object</th>
                                <th className="px-3 py-2 font-semibold">Source</th>
                                <th className="px-3 py-2 font-semibold">Tier</th>
                                <th className="px-3 py-2 font-semibold">Style</th>
                                <th className="px-3 py-2 font-semibold">Colour</th>
                                <th className="px-3 py-2 font-semibold">Product / SKU</th>
                                <th className="px-3 py-2 text-right font-semibold">Total</th>
                                <th className="px-3 py-2 font-semibold" />
                              </tr>
                            </thead>
                            <tbody>
                              {projectAreaObjects.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={9}
                                    className="px-3 py-4 text-xs italic text-sf-text-secondary dark:text-zinc-400"
                                  >
                                    No objects in this area yet. Answer scope questions on Details,
                                    or add a line with Add object.
                                  </td>
                                </tr>
                              ) : (
                                projectAreaObjects.map((row) => {
                                  const qo = quoteObjects.find((q) => q.objectid === row.objectid);
                                  const name =
                                    qo?.objectname?.trim() ||
                                    (row.objectid != null ? `#${row.objectid}` : "Line");
                                  const tierBusy = lineTierSavingId === row.id;
                                  return (
                                    <tr
                                      key={row.id}
                                      className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                                    >
                                      <td className="px-3 py-2 align-top">
                                        <input
                                          type="checkbox"
                                          className="size-4 rounded border-sf-border-strong accent-green-600"
                                          checked={row.included !== false}
                                          disabled={tierBusy}
                                          onChange={(e) =>
                                            void patchLineTier(row.id, {
                                              included: e.target.checked,
                                            })
                                          }
                                          aria-label={`Include ${name}`}
                                        />
                                      </td>
                                      <td className="px-3 py-2 align-top">
                                        <div className="font-medium">{name}</div>
                                      </td>
                                      <td className="px-3 py-2 align-top text-xs text-sf-text-secondary dark:text-zinc-400">
                                        {row.linesource === "scope"
                                          ? "Scope"
                                          : row.linesource === "manual"
                                            ? "Manual"
                                            : "Default"}
                                      </td>
                                      <td className="min-w-[8rem] px-3 py-2 align-top">
                                        <PriceLevelIdSelect
                                          value={row.pricelevelid ?? null}
                                          onChange={(id) =>
                                            void patchLineTier(row.id, { pricelevelid: id })
                                          }
                                          className={`${inputClass} min-h-10 py-1.5 text-xs`}
                                          disabled={tierBusy}
                                          emptyLabel="Area default"
                                        />
                                      </td>
                                      <td className="min-w-[6rem] px-3 py-2 align-top">
                                        <select
                                          value={row.style ?? ""}
                                          disabled={tierBusy}
                                          onChange={(e) =>
                                            void patchLineTier(row.id, {
                                              style: e.target.value ? e.target.value : null,
                                            })
                                          }
                                          className={`${inputClass} min-h-10 py-1.5 text-xs`}
                                        >
                                          <option value="">Area default</option>
                                          {baseStyleOptions.out.map((v) => (
                                            <option key={v} value={v}>
                                              {v}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="min-w-[6rem] px-3 py-2 align-top">
                                        <input
                                          defaultValue={row.colour ?? ""}
                                          disabled={tierBusy}
                                          onBlur={(e) => {
                                            const v = e.target.value;
                                            const cur = row.colour ?? "";
                                            if (v === cur) return;
                                            void patchLineTier(row.id, {
                                              colour: v.trim() ? v : null,
                                            });
                                          }}
                                          className={`${inputClass} min-h-10 py-1.5 text-xs`}
                                          placeholder="Area default"
                                        />
                                      </td>
                                      <td className="min-w-[10rem] px-3 py-2 align-top">
                                        {row.linesource === "scope" && selectedProjectArea ? (
                                          <ScopeLineSkuPicker
                                            line={row}
                                            quoteObject={qo}
                                            catalogSkus={catalogSkus}
                                            suppliersBySkuId={suppliersBySkuId}
                                            priceLevels={priceLevels}
                                            pa={selectedProjectArea}
                                            project={project}
                                            disabled={tierBusy}
                                            selectClassName={`${inputClass} min-h-10 py-1.5 text-xs`}
                                            variant="compact"
                                            onSelectSku={(pick) => {
                                              void patchLineTier(
                                                row.id,
                                                patchBodyForScopeLineSku(row, pick),
                                              );
                                            }}
                                          />
                                        ) : row.skuProduct?.trim() ? (
                                          <span className="text-xs text-sf-text-secondary dark:text-zinc-400">
                                            {row.skuProduct.trim()}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-sf-text-weak">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right align-top tabular-nums">
                                        {row.totalprice ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 align-top">
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => openEditLineModal(row)}
                                            className={sfRowIconBtn}
                                            aria-label={`Edit ${name}`}
                                          >
                                            <IconPencil className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setPaoDeleteId(row.id)}
                                            className={sfRowIconBtnDanger}
                                            aria-label={`Remove ${name}`}
                                          >
                                            <IconTrash className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                      <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                        Included labour (h) — Gen: {formatLoad(selectedAreaLoadTotals.generalHours)}, PM:{" "}
                        {formatLoad(selectedAreaLoadTotals.projectManagerHours)}, CA:{" "}
                        {formatLoad(selectedAreaLoadTotals.constructionAssistantHours)}, LC:{" "}
                        {formatLoad(selectedAreaLoadTotals.leadContractorHours)}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                        Template area questions saved per project area instance (Ctrl+Enter in a
                        field saves).
                      </p>
                      {projectAreaAnswersLoading ? (
                        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Loading…</p>
                      ) : projectAreaAnswers.length === 0 ? (
                        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                          No area questions for this template.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {projectAreaAnswers.map((a) => {
                            const tradeLabel = (a.applicableTradesSnapshot ?? [])
                              .map((t) => t.lookupvalue)
                              .filter(Boolean)
                              .join(", ");
                            const busy = answerSavingId === a.id;
                            return (
                              <div key={a.id} className="space-y-1">
                                <div className="text-xs font-medium text-sf-text-secondary dark:text-zinc-300">
                                  {tradeLabel ? `${tradeLabel}: ` : ""}
                                  <span className="text-sf-text dark:text-zinc-100">
                                    {a.questionTextSnapshot}
                                  </span>
                                  {busy ? (
                                    <span className="ml-2 text-[10px] text-sf-text-weak">Saving…</span>
                                  ) : null}
                                </div>
                                <textarea
                                  key={`${a.id}-${a.updatedAt ?? ""}`}
                                  className={`${inputClass} min-h-24 resize-y`}
                                  rows={3}
                                  defaultValue={a.answer ?? ""}
                                  disabled={busy}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.ctrlKey)
                                      (e.target as HTMLTextAreaElement).blur();
                                  }}
                                  onBlur={(e) => {
                                    const next = e.target.value;
                                    if (next === (a.answer ?? "")) return;
                                    void patchProjectAreaAnswer(a.id, { answer: next });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                  Select an area from the list to view scope questions, line items, and area
                  questions.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {pickAreaOpen ? (
        <ModalFrame
          title="Add area"
          description="Choose a template area from Setup. Scope questions for that template appear on this screen; default quote lines from Setup are copied in."
          onClose={() => !paSaving && setPickAreaOpen(false)}
          wide
          footer={pickAreaFooter}
        >
          {paSaving ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Adding…</p>
          ) : areasSortedForPicker.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No template areas are defined yet. Add them under Setup → Areas.
            </p>
          ) : (
            <>
              <label className="mb-3 block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Area name on this project (optional)
                </span>
                <input
                  value={addAreaDisplayName}
                  onChange={(e) => setAddAreaDisplayName(e.target.value)}
                  placeholder="e.g. Master bedroom, Bedroom 2"
                  className={inputClass}
                />
              </label>
              {project?.defaultpricelevelid == null ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                  <p className="mb-2 text-sm font-medium text-amber-950 dark:text-amber-100">
                    Price tier required
                  </p>
                  <p className="mb-2 text-xs text-amber-900/90 dark:text-amber-200/90">
                    This project has no default price level. Choose the tier for this area so scope
                    answers and line pricing resolve correctly.
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-sf-text-secondary dark:text-zinc-300">
                      Tier for this area
                    </span>
                    <PriceLevelIdSelect
                      value={addAreaPriceLevelId}
                      onChange={setAddAreaPriceLevelId}
                      className={inputClass}
                      emptyLabel="Select tier (required)"
                    />
                  </label>
                </div>
              ) : (
                <p className="mb-3 text-xs text-sf-text-secondary dark:text-zinc-400">
                  This area will use the project default price tier (#{project.defaultpricelevelid}).
                </p>
              )}
              <ul className="max-h-[min(24rem,55vh)] space-y-1 overflow-y-auto pr-1">
                {areasSortedForPicker.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => void addProjectAreaFromTemplate(a.id)}
                      disabled={paSaving}
                      className="w-full rounded-lg border border-sf-border px-4 py-3 text-left text-sm font-medium transition hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      {a.areaname}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ModalFrame>
      ) : null}

      {editAreaOpen ? (
        <ModalFrame
          title="Edit project area"
          description="Optional custom name (for multiple bedrooms, etc.), notes, finish tier, and m². The template type cannot be changed."
          onClose={() => !paSaving && closeEditAreaModal()}
          footer={
            <>
              <button
                type="button"
                onClick={() => !paSaving && closeEditAreaModal()}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium disabled:opacity-50 dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEditedProjectArea()}
                disabled={paSaving}
                className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {paSaving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className={sfTabStripClass} role="tablist" aria-label="Edit project area tabs">
              <button
                type="button"
                className={sfUnderlineTabClass(editAreaTab === "details")}
                role="tab"
                aria-selected={editAreaTab === "details"}
                onClick={() => setEditAreaTab("details")}
              >
                Details
              </button>
              <button
                type="button"
                className={sfUnderlineTabClass(editAreaTab === "objects")}
                role="tab"
                aria-selected={editAreaTab === "objects"}
                onClick={() => setEditAreaTab("objects")}
              >
                Objects
              </button>
              <button
                type="button"
                className={sfUnderlineTabClass(editAreaTab === "questions")}
                role="tab"
                aria-selected={editAreaTab === "questions"}
                onClick={() => setEditAreaTab("questions")}
              >
                Questions
              </button>
            </div>

            {editAreaTab === "details" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Area name on this project (optional)
                  </span>
                  <input
                    value={paDisplayName}
                    onChange={(e) => setPaDisplayName(e.target.value)}
                    placeholder="Uses template name if empty"
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Price level (finish tier)
                  </span>
                  <PriceLevelIdSelect
                    value={paPriceLevelId}
                    onChange={setPaPriceLevelId}
                    className={inputClass}
                    disabled={paSaving}
                    emptyLabel="Default (project)"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Style
                  </span>
                  <select value={paStyle} onChange={(e) => setPaStyle(e.target.value)} className={inputClass}>
                    <option value="">Default (project)</option>
                    {baseStyleOptions.out.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    {(() => {
                      const saved = paStyle.trim();
                      if (!saved || baseStyleOptions.seen.has(saved)) return null;
                      return <option value={saved}>{saved} (saved)</option>;
                    })()}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Colour
                  </span>
                  <input value={paColour} onChange={(e) => setPaColour(e.target.value)} className={inputClass} placeholder="Default (project)" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Area m²
                  </span>
                  <input
                    value={paM2Str}
                    onChange={(e) => setPaM2Str(e.target.value)}
                    inputMode="decimal"
                    placeholder="Area m²"
                    className={inputClass}
                  />
                </label>
                <input
                  value={paNotes1}
                  onChange={(e) => setPaNotes1(e.target.value)}
                  placeholder="Area notes 1"
                  className={`${inputClass} sm:col-span-2`}
                />
                <input
                  value={paNotes2}
                  onChange={(e) => setPaNotes2(e.target.value)}
                  placeholder="Area notes 2"
                  className={`${inputClass} sm:col-span-2`}
                />
              </div>
            ) : null}

            {editAreaTab === "objects" ? (
              <div className="space-y-3">
                <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                  Objects for this area instance. (Full editing is available on the main Areas screen; this view is for quick reference.)
                </p>
                <div className="overflow-x-auto rounded-lg border border-sf-border dark:border-zinc-700">
                  {projectAreaObjectsLoading ? (
                    <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">Loading…</p>
                  ) : projectAreaObjects.length === 0 ? (
                    <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                      No objects in this area yet.
                    </p>
                  ) : (
                    <table className="w-full min-w-[52rem] text-left text-sm">
                      <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Object</th>
                          <th className="px-3 py-2 font-semibold">Source</th>
                          <th className="px-3 py-2 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectAreaObjects.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                          >
                            <td className="px-3 py-2">
                              {quoteObjects.find((q) => q.objectid === row.objectid)?.objectname ??
                                `#${row.objectid}`}
                            </td>
                            <td className="px-3 py-2 text-xs text-sf-text-secondary dark:text-zinc-400">
                              {row.linesource === "scope"
                                ? "Scope"
                                : row.linesource === "manual"
                                  ? "Manual"
                                  : "Default"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{row.totalprice ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}

            {editAreaTab === "questions" ? (
              <div className="space-y-3">
                <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                  Area Questions for this area instance.
                </p>
                {projectAreaAnswersLoading ? (
                  <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Loading…</p>
                ) : projectAreaAnswers.length === 0 ? (
                  <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                    No area questions for this template.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {projectAreaAnswers.map((a) => {
                      const tradeLabel = (a.applicableTradesSnapshot ?? [])
                        .map((t) => t.lookupvalue)
                        .filter(Boolean)
                        .join(", ");
                      const busy = answerSavingId === a.id;
                      return (
                        <div key={a.id} className="space-y-1">
                          <div className="text-xs font-medium text-sf-text-secondary dark:text-zinc-300">
                            {tradeLabel ? `${tradeLabel}: ` : ""}
                            <span className="text-sf-text dark:text-zinc-100">
                              {a.questionTextSnapshot}
                            </span>
                          </div>
                          <textarea
                            key={`${a.id}-${a.updatedAt ?? ""}`}
                            className={`${inputClass} min-h-24 resize-y`}
                            rows={3}
                            defaultValue={a.answer ?? ""}
                            disabled={busy}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && e.ctrlKey)
                                (e.target as HTMLTextAreaElement).blur();
                            }}
                            onBlur={(e) => {
                              const next = e.target.value;
                              if (next === (a.answer ?? "")) return;
                              void patchProjectAreaAnswer(a.id, { answer: next });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </ModalFrame>
      ) : null}

      {pickObjectOpen ? (
        <ModalFrame
          title="Add object"
          description="Choose a quote object to add as a line on this area."
          onClose={() => !paoSaving && setPickObjectOpen(false)}
          wide
          footer={pickObjectFooter}
        >
          {paoSaving ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">Adding…</p>
          ) : quoteObjects.length === 0 ? (
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
              No quote objects in Setup. Add some under Setup → Quote Objects.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,55vh)] space-y-1 overflow-y-auto pr-1">
              {[...quoteObjects]
                .sort((a, b) =>
                  (a.objectname || "").localeCompare(b.objectname || "", undefined, {
                    sensitivity: "base",
                  }),
                )
                .map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => void addLineItemFromQuoteObject(q.id)}
                    disabled={paoSaving}
                    className="w-full rounded-lg border border-sf-border px-4 py-3 text-left text-sm font-medium transition hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    {q.objectname?.trim() || (q.objectid != null ? `Object #${q.objectid}` : "Unnamed object")}
                    {q.uom ? ` · ${q.uom}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ModalFrame>
      ) : null}

      {editObjectOpen ? (
        <ModalFrame
          title="Edit line item"
          description="Adjust measures, pricing, loads (e.g. minutes), and notes for this line."
          onClose={() => !paoSaving && closeEditLineModal()}
          footer={
            <>
              <button
                type="button"
                onClick={() => !paoSaving && closeEditLineModal()}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium disabled:opacity-50 dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEditedLineItem()}
                disabled={paoSaving}
                className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {paoSaving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-sm text-sf-text-secondary dark:text-zinc-400 sm:col-span-2">
              Quote object type cannot be changed; remove the line and add a different object if
              needed.
            </p>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                Line price tier
              </span>
              <PriceLevelIdSelect
                value={paoPriceLevelId}
                onChange={setPaoPriceLevelId}
                className={inputClass}
                disabled={paoSaving}
                emptyLabel="Area default"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                Style
              </span>
              <select value={paoStyle} onChange={(e) => setPaoStyle(e.target.value)} className={inputClass}>
                <option value="">Area default</option>
                {baseStyleOptions.out.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
                {(() => {
                  const saved = paoStyle.trim();
                  if (!saved || baseStyleOptions.seen.has(saved)) return null;
                  return <option value={saved}>{saved} (saved)</option>;
                })()}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                Colour
              </span>
              <input value={paoColour} onChange={(e) => setPaoColour(e.target.value)} className={inputClass} placeholder="Area default" />
            </label>
            <input
              type="date"
              value={paoDateAdded}
              onChange={(e) => setPaoDateAdded(e.target.value)}
              className={inputClass}
            />
            <input
              value={paoCustomMeasureStr}
              onChange={(e) => setPaoCustomMeasureStr(e.target.value)}
              inputMode="decimal"
              placeholder="Custom measure"
              className={inputClass}
            />
            <input
              value={paoCustomUom}
              onChange={(e) => setPaoCustomUom(e.target.value)}
              placeholder="Custom UOM"
              className={inputClass}
            />
            <input
              value={paoCustomUmPriceStr}
              onChange={(e) => setPaoCustomUmPriceStr(e.target.value)}
              inputMode="decimal"
              placeholder="Custom UOM price"
              className={inputClass}
            />
            <input
              value={paoTotalPriceStr}
              onChange={(e) => setPaoTotalPriceStr(e.target.value)}
              inputMode="decimal"
              placeholder="Total price"
              className={inputClass}
            />
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                Loads (two decimals; e.g. minutes)
              </span>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <input
                  value={paoGeneralLoadStr}
                  onChange={(e) => setPaoGeneralLoadStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="General"
                  className={inputClass}
                />
                <input
                  value={paoPlumbingLoadStr}
                  onChange={(e) => setPaoPlumbingLoadStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="Plumbing"
                  className={inputClass}
                />
                <input
                  value={paoElecLoadStr}
                  onChange={(e) => setPaoElecLoadStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="Elec"
                  className={inputClass}
                />
                <input
                  value={paoPmLoadStr}
                  onChange={(e) => setPaoPmLoadStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="PM"
                  className={inputClass}
                />
                <input
                  value={paoCntrLoadStr}
                  onChange={(e) => setPaoCntrLoadStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="Cntr"
                  className={inputClass}
                />
                <input
                  value={paoAssCntrLoadStr}
                  onChange={(e) => setPaoAssCntrLoadStr(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ass.Cntr"
                  className={inputClass}
                />
              </div>
            </label>
            <input
              value={paoNotes1}
              onChange={(e) => setPaoNotes1(e.target.value)}
              placeholder="Notes 1"
              className={inputClass}
            />
            <input
              value={paoNotes2}
              onChange={(e) => setPaoNotes2(e.target.value)}
              placeholder="Notes 2"
              className={inputClass}
            />
          </div>
        </ModalFrame>
      ) : null}

      <ConfirmDialog
        open={Boolean(paDeleteId)}
        title="Remove area from project?"
        description={
          projectAreaPendingDelete
            ? `“${projectAreaHeading(projectAreaPendingDelete, areas)}” and all line items for this area on the quote will be removed. This cannot be undone.`
            : "This area and its line items will be removed. This cannot be undone."
        }
        confirmLabel="Remove area"
        cancelLabel="Cancel"
        variant="danger"
        pending={paDeleting}
        onCancel={() => setPaDeleteId(null)}
        onConfirm={() => void confirmProjectAreaDelete()}
      />

      <ConfirmDialog
        open={Boolean(paoDeleteId)}
        title="Remove line item?"
        description="This quote line will be removed from the project area. This cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        pending={paoDeleting}
        onCancel={() => setPaoDeleteId(null)}
        onConfirm={() => void confirmProjectAreaObjectDelete()}
      />
    </div>
  );
}
