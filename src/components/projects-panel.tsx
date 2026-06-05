"use client";

import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { ProjectDefaultTierFields } from "@/components/project-default-tier-fields";
import { PriceLevelSelect } from "@/components/price-level-select";
import { usePriceLevels } from "@/lib/client/use-price-levels";
import type { ProjectPublic } from "@/types/project";
import type { AreaPublic } from "@/types/area";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { SalesStaffPublic } from "@/types/sales-staff";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionLead,
} from "@/lib/sf-layout";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import { useCallback, useEffect, useState } from "react";

type Mode = "idle" | "create" | "edit";

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

export function ProjectsPanel() {
  const { levels } = usePriceLevels();
  const [projects, setProjects] = useState<ProjectPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [salesStaff, setSalesStaff] = useState<SalesStaffPublic[]>([]);
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [projectAreas, setProjectAreas] = useState<ProjectAreaPublic[]>([]);
  const [projectAreaObjects, setProjectAreaObjects] = useState<ProjectAreaObjectPublic[]>([]);
  const [projectAreasLoading, setProjectAreasLoading] = useState(false);
  const [projectAreaObjectsLoading, setProjectAreaObjectsLoading] = useState(false);
  const [paSaving, setPaSaving] = useState(false);
  const [paoSaving, setPaoSaving] = useState(false);
  const [paDeleteId, setPaDeleteId] = useState<string | null>(null);
  const [paoDeleteId, setPaoDeleteId] = useState<string | null>(null);
  const [selectedProjectAreaDocIdForObjects, setSelectedProjectAreaDocIdForObjects] = useState<
    string | null
  >(null);
  const [paEditingId, setPaEditingId] = useState<string | null>(null);
  const [paoEditingId, setPaoEditingId] = useState<string | null>(null);
  const [paAreaIdStr, setPaAreaIdStr] = useState("");
  const [paNotes1, setPaNotes1] = useState("");
  const [paNotes2, setPaNotes2] = useState("");
  const [paM2Str, setPaM2Str] = useState("");
  const [paFinish, setPaFinish] = useState("");
  const [paoObjectIdStr, setPaoObjectIdStr] = useState("");
  const [paoDateAdded, setPaoDateAdded] = useState("");
  const [paoCustomMeasureStr, setPaoCustomMeasureStr] = useState("");
  const [paoCustomUom, setPaoCustomUom] = useState("");
  const [paoCustomUmPriceStr, setPaoCustomUmPriceStr] = useState("");
  const [paoTotalPriceStr, setPaoTotalPriceStr] = useState("");
  const [paoNotes1, setPaoNotes1] = useState("");
  const [paoNotes2, setPaoNotes2] = useState("");

  /** Numeric ID from Firestore; allocated on create by the API (not user-editable). */
  const [numericProjectId, setNumericProjectId] = useState<number | null>(null);
  const [projectname, setProjectname] = useState("");
  const [projectdescription, setProjectdescription] = useState("");
  const [projectaddress, setProjectaddress] = useState("");
  const [projectcontact, setProjectcontact] = useState("");
  const [projecttel, setProjecttel] = useState("");
  const [projectemail, setProjectemail] = useState("");
  const [projectbrief, setProjectbrief] = useState("");
  /** Drives `defaultpricelevelid` and display name (`projectfinish`) for pricing / scope tiers. */
  const [defaultPriceLevelId, setDefaultPriceLevelId] = useState<number | null>(null);
  const [defaultProjectFinish, setDefaultProjectFinish] = useState("");
  const [defaultStyle, setDefaultStyle] = useState("");
  const [defaultColour, setDefaultColour] = useState("");
  const [spec2, setSpec2] = useState("");
  const [spec3, setSpec3] = useState("");
  const [targetstartdate, setTargetstartdate] = useState("");
  const [projectnotes, setProjectnotes] = useState("");
  const [quotedby, setQuotedby] = useState("");
  const [quotedon, setQuotedon] = useState("");

  const load = useCallback(async (opts?: { skipPageLoading?: boolean }) => {
    const skipPage = opts?.skipPageLoading === true;
    if (!skipPage) {
      setError(null);
      setLoading(true);
    }
    try {
      const res = await fetch("/api/projects");
      const data = (await res.json()) as {
        projects?: ProjectPublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load projects");
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
      setProjects([]);
    } finally {
      if (!skipPage) setLoading(false);
    }
  }, []);

  const loadSalesStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/sales-staff");
      const data = (await res.json()) as {
        staff?: SalesStaffPublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load sales staff");
      setSalesStaff(data.staff ?? []);
    } catch {
      setSalesStaff([]);
    }
  }, []);

  const loadAreas = useCallback(async () => {
    try {
      const res = await fetch("/api/areas");
      const data = (await res.json()) as { areas?: AreaPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load areas");
      setAreas(data.areas ?? []);
    } catch {
      setAreas([]);
    }
  }, []);

  const loadProjectAreas = useCallback(async (numericProjectId: number) => {
    setProjectAreasLoading(true);
    try {
      const res = await fetch(`/api/projectareas?projectid=${numericProjectId}`);
      const data = (await res.json()) as {
        projectAreas?: ProjectAreaPublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load project areas");
      setProjectAreas(data.projectAreas ?? []);
    } catch (e) {
      setProjectAreas([]);
      setError(e instanceof Error ? e.message : "Failed to load project areas");
    } finally {
      setProjectAreasLoading(false);
    }
  }, []);

  const loadProjectAreaObjects = useCallback(
    async (numericProjectId: number, projectAreaDocId: string) => {
      setProjectAreaObjectsLoading(true);
      try {
        const res = await fetch(
          `/api/projectareaobjects?projectid=${numericProjectId}&projectAreaDocId=${encodeURIComponent(projectAreaDocId)}`,
        );
        const data = (await res.json()) as {
          projectAreaObjects?: ProjectAreaObjectPublic[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load project area objects");
        setProjectAreaObjects(data.projectAreaObjects ?? []);
      } catch (e) {
        setProjectAreaObjects([]);
        setError(e instanceof Error ? e.message : "Failed to load project area objects");
      } finally {
        setProjectAreaObjectsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          load({ skipPageLoading: true }),
          loadSalesStaff(),
          loadAreas(),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    void bootstrapThenLoad();
  }, [load, loadSalesStaff, loadAreas]);

  function openCreate() {
    setEditingId(null);
    setNumericProjectId(null);
    setProjectname("");
    setProjectdescription("");
    setProjectaddress("");
    setProjectcontact("");
    setProjecttel("");
    setProjectemail("");
    setProjectbrief("");
    setDefaultPriceLevelId(null);
    setDefaultProjectFinish("");
    setDefaultStyle("");
    setDefaultColour("");
    setSpec2("");
    setSpec3("");
    setTargetstartdate("");
    setProjectnotes("");
    setQuotedby("");
    setQuotedon("");
    setProjectAreas([]);
    setProjectAreaObjects([]);
    setSelectedProjectAreaDocIdForObjects(null);
    setPaEditingId(null);
    setPaoEditingId(null);
    setMode("create");
  }

  async function openEdit(p: ProjectPublic) {
    setEditingId(p.id);
    setNumericProjectId(
      typeof p.projectid === "number" && Number.isInteger(p.projectid)
        ? p.projectid
        : null,
    );
    setProjectname(p.projectname);
    setProjectdescription(p.projectdescription);
    setProjectaddress(p.projectaddress);
    setProjectcontact(p.projectcontact);
    setProjecttel(p.projecttel);
    setProjectemail(p.projectemail);
    setProjectbrief(p.projectbrief);
    setDefaultPriceLevelId(p.defaultpricelevelid ?? null);
    setDefaultProjectFinish(p.projectfinish ?? "");
    setDefaultStyle(p.defaultstyle ?? "");
    setDefaultColour(p.defaultcolour ?? "");
    setSpec2(p.spec2);
    setSpec3(p.spec3);
    setTargetstartdate(isoToDateInput(p.targetstartdate));
    setProjectnotes(p.projectnotes);
    setQuotedby(p.quotedby);
    setQuotedon(isoToDateInput(p.quotedon));
    if (p.projectid != null) {
      await loadProjectAreas(p.projectid);
    } else {
      setProjectAreas([]);
    }
    setProjectAreaObjects([]);
    setSelectedProjectAreaDocIdForObjects(null);
    setPaEditingId(null);
    setPaoEditingId(null);
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
    setProjectAreas([]);
    setProjectAreaObjects([]);
    setSelectedProjectAreaDocIdForObjects(null);
    setPaEditingId(null);
    setPaoEditingId(null);
  }

  function buildPayload(): Record<string, unknown> {
    const plRow = levels.find((l) => l.pricelevelid === defaultPriceLevelId);
    const projectfinish = defaultProjectFinish.trim() || plRow?.pricelevel || "";
    return {
      projectname,
      projectdescription,
      projectaddress,
      projectcontact,
      projecttel,
      projectemail,
      projectbrief,
      projectfinish,
      spec2,
      spec3,
      projectnotes,
      quotedby,
      targetstartdate: dateInputToIso(targetstartdate),
      quotedon: dateInputToIso(quotedon),
      defaultpricelevelid: defaultPriceLevelId,
      defaultstyle: defaultStyle.trim(),
      defaultcolour: defaultColour.trim(),
    };
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let payload: Record<string, unknown>;
      try {
        payload = buildPayload();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Invalid input");
      }

      if (mode === "create") {
        if (defaultPriceLevelId == null) {
          setError(
            "Select a default price level. It is saved on the project and used for scope-linked lines when an area does not set its own tier.",
          );
          setSaving(false);
          return;
        }
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          error?: string;
          details?: unknown;
        };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      } else if (mode === "edit" && editingId) {
        const res = await fetch(`/api/projects/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          error?: string;
          details?: unknown;
        };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${deleteId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "Delete failed",
        );
      setDeleteId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  function openProjectAreaCreate() {
    setPaEditingId(null);
    setPaAreaIdStr("");
    setPaNotes1("");
    setPaNotes2("");
    setPaM2Str("");
    setPaFinish("");
  }

  function openProjectAreaEdit(row: ProjectAreaPublic) {
    setPaEditingId(row.id);
    setPaAreaIdStr(String(row.areaid));
    setPaNotes1(row.areanotes1);
    setPaNotes2(row.areanotes2);
    setPaM2Str(numToInput(row.aream2));
    setPaFinish(row.areafinish);
  }

  async function submitProjectArea() {
    if (numericProjectId == null) {
      setError(
        "This project has no numeric project ID yet. New projects receive one automatically when created; legacy records may need an ID backfill.",
      );
      return;
    }
    const areaid = Number(paAreaIdStr);
    if (!Number.isInteger(areaid)) {
      setError("Select a valid area.");
      return;
    }
    setPaSaving(true);
    setError(null);
    try {
      const payload = {
        projectid: numericProjectId,
        areaid,
        areanotes1: paNotes1,
        areanotes2: paNotes2,
        aream2: parseNumberOrNull(paM2Str),
        areafinish: paFinish,
      };
      if (paEditingId) {
        const res = await fetch(`/api/projectareas/${paEditingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      } else {
        const res = await fetch("/api/projectareas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      }
      openProjectAreaCreate();
      await loadProjectAreas(numericProjectId);
      if (selectedProjectAreaDocIdForObjects) {
        await loadProjectAreaObjects(numericProjectId, selectedProjectAreaDocIdForObjects);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save project area");
    } finally {
      setPaSaving(false);
    }
  }

  async function confirmProjectAreaDelete() {
    if (!paDeleteId || numericProjectId == null) return;
    setPaSaving(true);
    setError(null);
    try {
      const row = projectAreas.find((r) => r.id === paDeleteId);
      const res = await fetch(`/api/projectareas/${paDeleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      setPaDeleteId(null);
      await loadProjectAreas(numericProjectId);
      if (row && selectedProjectAreaDocIdForObjects === row.id) {
        setSelectedProjectAreaDocIdForObjects(null);
        setProjectAreaObjects([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project area");
    } finally {
      setPaSaving(false);
    }
  }

  function openProjectAreaObjectCreate() {
    setPaoEditingId(null);
    setPaoObjectIdStr("");
    setPaoDateAdded("");
    setPaoCustomMeasureStr("");
    setPaoCustomUom("");
    setPaoCustomUmPriceStr("");
    setPaoTotalPriceStr("");
    setPaoNotes1("");
    setPaoNotes2("");
  }

  function openProjectAreaObjectEdit(row: ProjectAreaObjectPublic) {
    setPaoEditingId(row.id);
    setPaoObjectIdStr(String(row.objectid));
    setPaoDateAdded(isoToDateInput(row.dateadded));
    setPaoCustomMeasureStr(numToInput(row.custommeasure));
    setPaoCustomUom(row.customuom);
    setPaoCustomUmPriceStr(numToInput(row.customumprice));
    setPaoTotalPriceStr(numToInput(row.totalprice));
    setPaoNotes1(row.notes1);
    setPaoNotes2(row.notes2);
  }

  async function submitProjectAreaObject() {
    if (numericProjectId == null || selectedProjectAreaDocIdForObjects == null) {
      setError("Select a project area first.");
      return;
    }
    const objectid = Number(paoObjectIdStr);
    if (!Number.isInteger(objectid)) {
      setError("Select a valid object.");
      return;
    }
    setPaoSaving(true);
    setError(null);
    try {
      const patchPayload = {
        dateadded: dateInputToIso(paoDateAdded),
        custommeasure: parseNumberOrNull(paoCustomMeasureStr),
        customuom: paoCustomUom,
        customumprice: parseNumberOrNull(paoCustomUmPriceStr),
        totalprice: parseNumberOrNull(paoTotalPriceStr),
        notes1: paoNotes1,
        notes2: paoNotes2,
      };
      if (paoEditingId) {
        const res = await fetch(`/api/projectareaobjects/${paoEditingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      } else {
        const qoRes = await fetch("/api/quote-objects");
        const qoData = (await qoRes.json()) as {
          quoteObjects?: QuoteObjectPublic[];
          error?: string;
        };
        if (!qoRes.ok) throw new Error(qoData.error ?? "Failed to load quote objects");
        const quoteObj = qoData.quoteObjects?.find((o) => o.objectid === objectid);
        if (!quoteObj?.id) {
          throw new Error(
            "No quote object document matches that object ID. Use Setup → Quote Objects.",
          );
        }
        const res = await fetch("/api/projectareaobjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectAreaDocId: selectedProjectAreaDocIdForObjects,
            quoteObjectDocId: quoteObj.id,
            dateadded: dateInputToIso(paoDateAdded),
            custommeasure: parseNumberOrNull(paoCustomMeasureStr),
            customuom: paoCustomUom,
            customumprice: parseNumberOrNull(paoCustomUmPriceStr),
            totalprice: parseNumberOrNull(paoTotalPriceStr),
            notes1: paoNotes1,
            notes2: paoNotes2,
          }),
        });
        const data = (await res.json()) as { error?: string; details?: unknown };
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      }
      openProjectAreaObjectCreate();
      await loadProjectAreaObjects(numericProjectId, selectedProjectAreaDocIdForObjects);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save project area object");
    } finally {
      setPaoSaving(false);
    }
  }

  async function confirmProjectAreaObjectDelete() {
    if (!paoDeleteId || numericProjectId == null || selectedProjectAreaDocIdForObjects == null)
      return;
    setPaoSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projectareaobjects/${paoDeleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      setPaoDeleteId(null);
      await loadProjectAreaObjects(numericProjectId, selectedProjectAreaDocIdForObjects);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project area object");
    } finally {
      setPaoSaving(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  const projectPendingDelete = deleteId
    ? projects.find((p) => p.id === deleteId)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-normal tracking-tight text-sf-text md:text-2xl dark:text-zinc-50">
            Projects
          </h1>
          <p className={sfSectionLead}>
            Live renovation projects. The table shows name and description; edit a project to manage
            all fields.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add project
        </button>
      </div>

      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className={sfDataSurface}>
        {loading ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No projects yet. Add one to create the{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              projects
            </code>{" "}
            collection in Firestore.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">
                    Name
                  </th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                  >
                    <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">
                      {p.projectname}
                    </td>
                    <td className="max-w-md px-4 py-3 text-sf-text-secondary dark:text-zinc-300 md:px-5 md:py-3.5">
                      <span className="line-clamp-3 md:line-clamp-2">
                        {p.projectdescription || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className={sfRowIconBtn}
                          aria-label="Edit project"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(p.id)}
                          className={sfRowIconBtnDanger}
                          aria-label="Delete project"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(mode === "create" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-2xl sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2
                id="project-form-title"
                className="text-lg font-semibold md:text-xl"
              >
                {mode === "create" ? "New project" : "Edit project"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Project ID
                  </span>
                  <input
                    readOnly
                    value={
                      mode === "create"
                        ? "—"
                        : numericProjectId != null
                          ? String(numericProjectId)
                          : "—"
                    }
                    className={`${inputClass} bg-sf-page dark:bg-zinc-900`}
                    title="Assigned automatically when the project is created"
                  />
                  {mode === "create" ? (
                    <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
                      Assigned automatically when you create the project.
                    </span>
                  ) : numericProjectId == null ? (
                    <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                      No numeric ID on this record yet. Legacy data may need a one-time ID
                      backfill before project areas can be used.
                    </span>
                  ) : null}
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Name
                  </span>
                  <input
                    required
                    value={projectname}
                    onChange={(e) => setProjectname(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <ProjectDefaultTierFields
                  priceLevelId={defaultPriceLevelId}
                  onPriceLevelIdChange={setDefaultPriceLevelId}
                  projectFinish={defaultProjectFinish}
                  onProjectFinishChange={setDefaultProjectFinish}
                  style={defaultStyle}
                  colour={defaultColour}
                  onStyleChange={setDefaultStyle}
                  onColourChange={setDefaultColour}
                  priceLevelClassName={inputClass}
                  cascadeSelectClassName={inputClass}
                  priceLevelRequired={mode === "create"}
                  disabled={saving}
                />
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Description
                  </span>
                  <textarea
                    value={projectdescription}
                    onChange={(e) => setProjectdescription(e.target.value)}
                    rows={3}
                    className={`${inputClass} min-h-[5rem] resize-y`}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Address
                  </span>
                  <input
                    value={projectaddress}
                    onChange={(e) => setProjectaddress(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Contact
                  </span>
                  <input
                    value={projectcontact}
                    onChange={(e) => setProjectcontact(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={projecttel}
                    onChange={(e) => setProjecttel(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Email
                  </span>
                  <input
                    type="email"
                    value={projectemail}
                    onChange={(e) => setProjectemail(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Brief
                  </span>
                  <textarea
                    value={projectbrief}
                    onChange={(e) => setProjectbrief(e.target.value)}
                    rows={2}
                    className={`${inputClass} min-h-[4rem] resize-y`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Target start date
                  </span>
                  <input
                    type="date"
                    value={targetstartdate}
                    onChange={(e) => setTargetstartdate(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Spec 2
                  </span>
                  <input
                    value={spec2}
                    onChange={(e) => setSpec2(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Spec 3
                  </span>
                  <input
                    value={spec3}
                    onChange={(e) => setSpec3(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Notes
                  </span>
                  <textarea
                    value={projectnotes}
                    onChange={(e) => setProjectnotes(e.target.value)}
                    rows={3}
                    className={`${inputClass} min-h-[5rem] resize-y`}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Quoted by
                  </span>
                  <select
                    value={quotedby}
                    onChange={(e) => setQuotedby(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select sales staff</option>
                    {salesStaff.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                    Quoted on
                  </span>
                  <input
                    type="date"
                    value={quotedon}
                    onChange={(e) => setQuotedon(e.target.value)}
                    className={inputClass}
                  />
                </label>

                {mode === "edit" ? (
                  <div className="sm:col-span-2 space-y-4 rounded-xl border border-sf-border p-4 dark:border-zinc-700">
                    <div>
                      <h3 className="text-base font-semibold">Project Areas</h3>
                      <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                        Add multiple areas to this project. New areas auto-seed objects from
                        setup defaults.
                      </p>
                    </div>

                    {numericProjectId == null ? (
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        A numeric project ID is required for areas. It is assigned automatically
                        for new projects; legacy projects may need an ID backfill.
                      </p>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                              Area
                            </span>
                            <select
                              value={paAreaIdStr}
                              onChange={(e) => setPaAreaIdStr(e.target.value)}
                              className={inputClass}
                            >
                              <option value="">Select area</option>
                              {areas
                                .filter((a) => a.areaid != null)
                                .map((a) => (
                                  <option key={a.id} value={String(a.areaid)}>
                                    {a.areaname}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                              Finish
                            </span>
                            <PriceLevelSelect
                              value={paFinish}
                              onChange={setPaFinish}
                              className={inputClass}
                              emptyLabel="Select price level"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                              Area notes 1
                            </span>
                            <input
                              value={paNotes1}
                              onChange={(e) => setPaNotes1(e.target.value)}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                              Area notes 2
                            </span>
                            <input
                              value={paNotes2}
                              onChange={(e) => setPaNotes2(e.target.value)}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                              Area m2
                            </span>
                            <input
                              value={paM2Str}
                              onChange={(e) => setPaM2Str(e.target.value)}
                              inputMode="decimal"
                              className={inputClass}
                            />
                          </label>
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={() => void submitProjectArea()}
                              disabled={paSaving}
                              className="min-h-11 rounded-lg bg-sf-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {paSaving
                                ? "Saving…"
                                : paEditingId
                                  ? "Update area"
                                  : "Add area"}
                            </button>
                            {paEditingId ? (
                              <button
                                type="button"
                                onClick={openProjectAreaCreate}
                                className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2 text-sm font-medium dark:border-zinc-600"
                              >
                                Cancel edit
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-sf-border dark:border-zinc-700">
                          {projectAreasLoading ? (
                            <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                              Loading project areas…
                            </p>
                          ) : projectAreas.length === 0 ? (
                            <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                              No areas added yet.
                            </p>
                          ) : (
                            <table className="w-full min-w-[640px] text-left text-sm">
                              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                                <tr>
                                  <th className="px-3 py-2 font-semibold">Area</th>
                                  <th className="px-3 py-2 font-semibold">Finish</th>
                                  <th className="px-3 py-2 font-semibold">m2</th>
                                  <th className="px-3 py-2 text-right font-semibold">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {projectAreas.map((pa) => {
                                  return (
                                    <tr
                                      key={pa.id}
                                      className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                                    >
                                      <td className="px-3 py-2">{projectAreaHeading(pa, areas)}</td>
                                      <td className="px-3 py-2">{pa.areafinish || "—"}</td>
                                      <td className="px-3 py-2">{pa.aream2 ?? "—"}</td>
                                      <td className="px-3 py-2 text-right">
                                        <div className="flex justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => openProjectAreaEdit(pa)}
                                            className={sfRowIconBtn}
                                            aria-label="Edit project area"
                                          >
                                            <IconPencil className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (numericProjectId == null) return;
                                              setSelectedProjectAreaDocIdForObjects(pa.id);
                                              openProjectAreaObjectCreate();
                                              await loadProjectAreaObjects(numericProjectId, pa.id);
                                            }}
                                            className="inline-flex min-h-8 shrink-0 items-center justify-center rounded border border-sf-border-strong bg-sf-surface px-2.5 py-1 text-xs font-medium text-sf-text shadow-sm hover:bg-sf-page dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                          >
                                            Objects
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setPaDeleteId(pa.id)}
                                            className={sfRowIconBtnDanger}
                                            aria-label="Delete project area"
                                          >
                                            <IconTrash className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {selectedProjectAreaDocIdForObjects != null ? (
                          <div className="space-y-3 rounded-lg border border-sf-border p-3 dark:border-zinc-700">
                            <h4 className="text-sm font-semibold">
                              Project area lines —{" "}
                              {(() => {
                                const sel = projectAreas.find(
                                  (p) => p.id === selectedProjectAreaDocIdForObjects,
                                );
                                return sel ? projectAreaHeading(sel, areas) : "Area";
                              })()}
                            </h4>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Object ID
                                </span>
                                <input
                                  value={paoObjectIdStr}
                                  onChange={(e) => setPaoObjectIdStr(e.target.value)}
                                  inputMode="numeric"
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Date added
                                </span>
                                <input
                                  type="date"
                                  value={paoDateAdded}
                                  onChange={(e) => setPaoDateAdded(e.target.value)}
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Custom measure
                                </span>
                                <input
                                  value={paoCustomMeasureStr}
                                  onChange={(e) => setPaoCustomMeasureStr(e.target.value)}
                                  inputMode="decimal"
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Custom UOM
                                </span>
                                <input
                                  value={paoCustomUom}
                                  onChange={(e) => setPaoCustomUom(e.target.value)}
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Custom UOM price
                                </span>
                                <input
                                  value={paoCustomUmPriceStr}
                                  onChange={(e) => setPaoCustomUmPriceStr(e.target.value)}
                                  inputMode="decimal"
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Total price
                                </span>
                                <input
                                  value={paoTotalPriceStr}
                                  onChange={(e) => setPaoTotalPriceStr(e.target.value)}
                                  inputMode="decimal"
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Notes 1
                                </span>
                                <input
                                  value={paoNotes1}
                                  onChange={(e) => setPaoNotes1(e.target.value)}
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Notes 2
                                </span>
                                <input
                                  value={paoNotes2}
                                  onChange={(e) => setPaoNotes2(e.target.value)}
                                  className={inputClass}
                                />
                              </label>
                              <div className="sm:col-span-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void submitProjectAreaObject()}
                                  disabled={paoSaving}
                                  className="min-h-11 rounded-lg bg-sf-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                                >
                                  {paoSaving
                                    ? "Saving…"
                                    : paoEditingId
                                      ? "Update object"
                                      : "Add object"}
                                </button>
                                {paoEditingId ? (
                                  <button
                                    type="button"
                                    onClick={openProjectAreaObjectCreate}
                                    className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2 text-sm font-medium dark:border-zinc-600"
                                  >
                                    Cancel edit
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-sf-border dark:border-zinc-700">
                              {projectAreaObjectsLoading ? (
                                <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                                  Loading project area objects…
                                </p>
                              ) : projectAreaObjects.length === 0 ? (
                                <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                                  No objects in this project area yet.
                                </p>
                              ) : (
                                <table className="w-full min-w-[640px] text-left text-sm">
                                  <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                                    <tr>
                                      <th className="px-3 py-2 font-semibold">Object ID</th>
                                      <th className="px-3 py-2 font-semibold">Measure</th>
                                      <th className="px-3 py-2 font-semibold">UOM</th>
                                      <th className="px-3 py-2 font-semibold">Price</th>
                                      <th className="px-3 py-2 text-right font-semibold">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {projectAreaObjects.map((row) => (
                                      <tr
                                        key={row.id}
                                        className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                                      >
                                        <td className="px-3 py-2">{row.objectid}</td>
                                        <td className="px-3 py-2">
                                          {row.custommeasure ?? "—"}
                                        </td>
                                        <td className="px-3 py-2">{row.customuom || "—"}</td>
                                        <td className="px-3 py-2">
                                          {row.customumprice ?? "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => openProjectAreaObjectEdit(row)}
                                              className={sfRowIconBtn}
                                              aria-label="Edit project area object"
                                            >
                                              <IconPencil className="h-4 w-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setPaoDeleteId(row.id)}
                                              className={sfRowIconBtnDanger}
                                              aria-label="Delete project area object"
                                            >
                                              <IconTrash className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white hover:bg-sf-brand-hover disabled:opacity-50"
                >
                  {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-project-area-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-project-area-title" className="text-lg font-semibold">
              Delete project area?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This removes the area and all project-specific objects in that area.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPaDeleteId(null)}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmProjectAreaDelete()}
                disabled={paSaving}
                className="min-h-12 rounded-lg bg-red-600 px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {paSaving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paoDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-project-area-object-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-project-area-object-title" className="text-lg font-semibold">
              Delete project area object?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              This only removes the object from this project area.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPaoDeleteId(null)}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmProjectAreaObjectDelete()}
                disabled={paoSaving}
                className="min-h-12 rounded-lg bg-red-600 px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {paoSaving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <div className="w-full max-w-md rounded-lg border border-sf-border bg-sf-surface p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="delete-project-title" className="text-lg font-semibold">
              Delete project?
            </h2>
            <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
              {projectPendingDelete ? (
                <>
                  <span className="font-medium text-sf-text dark:text-zinc-200">
                    {projectPendingDelete.projectname}
                  </span>
                  {typeof projectPendingDelete.projectid === "number" ? (
                    <>
                      {" "}
                      <span className="text-sf-text-weak dark:text-sf-text-weak">
                        (project ID {projectPendingDelete.projectid})
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                "This project"
              )}{" "}
              will be removed from Firestore along with its project areas and
              area objects. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={saving}
                className="min-h-12 rounded-lg bg-red-600 px-5 py-3 text-base font-medium text-white disabled:opacity-50"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
