"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconPencil, IconTrash } from "@/components/icons/lightning-icons";
import { ReorderArrows } from "@/components/reorder-arrows";
import { useTemplateReorder } from "@/lib/client/use-template-reorder";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import {
  sfDataSurface,
  sfPrimaryToolbarButton,
  sfSectionHeading,
  sfSectionLead,
} from "@/lib/sf-layout";
import { sfRowIconBtn, sfRowIconBtnDanger } from "@/lib/sf-row-actions";
import type { AreaPublic } from "@/types/area";
import type { AreaQuestionPublic } from "@/types/area-question";
import type { AreaObjectPublic } from "@/types/area-object";
import type { LookupPublic } from "@/types/lookup";
import type { QuoteObjectPublic } from "@/types/quote-object";
import { useCallback, useEffect, useState } from "react";

type Mode = "idle" | "create" | "edit";
type EditTab = "details" | "objects" | "questions";

function numToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseNumberOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error("Area meters must be a valid number");
  return n;
}

function parseIntegerOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n)) throw new Error("Sort order must be an integer");
  return n;
}

export function AreasPanel() {
  const [areas, setAreas] = useState<AreaPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<EditTab>("details");

  const [displayAreaid, setDisplayAreaid] = useState<number | null>(null);
  const [areaname, setAreaname] = useState("");
  const [areadescription, setAreadescription] = useState("");
  const [areametersStr, setAreametersStr] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [quoteObjects, setQuoteObjects] = useState<QuoteObjectPublic[]>([]);
  const [areaObjects, setAreaObjects] = useState<AreaObjectPublic[]>([]);
  const [areaObjectsLoading, setAreaObjectsLoading] = useState(false);
  const [aoSaving, setAoSaving] = useState(false);
  const [aoDeleteId, setAoDeleteId] = useState<string | null>(null);
  const [aoEditingId, setAoEditingId] = useState<string | null>(null);
  const [aoQuoteObjectDocId, setAoQuoteObjectDocId] = useState("");
  const [aoNotes3, setAoNotes3] = useState("");
  const [aoNotes4, setAoNotes4] = useState("");
  const [aoDefault, setAoDefault] = useState(false);
  /** Inline add form only after explicit action; keeps area Save separate from object fields. */
  const [showAddObjectForm, setShowAddObjectForm] = useState(false);

  const [areaQuestions, setAreaQuestions] = useState<AreaQuestionPublic[]>([]);
  const [areaQuestionsLoading, setAreaQuestionsLoading] = useState(false);
  const [aqSaving, setAqSaving] = useState(false);
  const [aqDeleteId, setAqDeleteId] = useState<string | null>(null);
  const [aqEditingId, setAqEditingId] = useState<string | null>(null);
  const [aqQuestionText, setAqQuestionText] = useState("");
  const [aqDefaultAnswer, setAqDefaultAnswer] = useState("");
  const [aqTradeLookupIds, setAqTradeLookupIds] = useState<number[]>([]);
  const [aqSortOrderStr, setAqSortOrderStr] = useState("");
  const [aqActive, setAqActive] = useState(true);
  const [tradeLookups, setTradeLookups] = useState<LookupPublic[]>([]);
  const [tradeLookupsLoading, setTradeLookupsLoading] = useState(false);

  const quoteObjectsSortedByName = useCallback(() => {
    return [...quoteObjects].sort((a, b) =>
      (a.objectname || "").localeCompare(b.objectname || "", undefined, { sensitivity: "base" }),
    );
  }, [quoteObjects]);

  const load = useCallback(async (opts?: { skipPageLoading?: boolean }) => {
    const skipPage = opts?.skipPageLoading === true;
    if (!skipPage) setLoading(true);
    try {
      const res = await fetch("/api/areas");
      const data = (await res.json()) as { areas?: AreaPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load areas");
      setAreas(data.areas ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load areas");
      setAreas([]);
    } finally {
      if (!skipPage) setLoading(false);
    }
  }, []);

  const loadQuoteObjects = useCallback(async () => {
    try {
      const res = await fetch("/api/quote-objects");
      const data = (await res.json()) as {
        quoteObjects?: QuoteObjectPublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load quote objects");
      setQuoteObjects(data.quoteObjects ?? []);
    } catch {
      setQuoteObjects([]);
    }
  }, []);

  const loadAreaObjects = useCallback(async (areaid: number) => {
    setAreaObjectsLoading(true);
    try {
      const res = await fetch(`/api/areaobjects?areaid=${areaid}`);
      const data = (await res.json()) as {
        areaObjects?: AreaObjectPublic[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load area objects");
      setAreaObjects(data.areaObjects ?? []);
    } catch (e) {
      setAreaObjects([]);
      setError(e instanceof Error ? e.message : "Failed to load area objects");
    } finally {
      setAreaObjectsLoading(false);
    }
  }, []);

  const loadTrades = useCallback(async () => {
    setTradeLookupsLoading(true);
    try {
      const res = await fetch("/api/lookups");
      const data = (await res.json()) as { lookups?: LookupPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load trades");
      const rows = (data.lookups ?? []).filter((l) => l.lookuptype === "Trades");
      rows.sort((a, b) =>
        (a.lookupvalue || "").localeCompare(b.lookupvalue || "", undefined, { sensitivity: "base" }),
      );
      setTradeLookups(rows);
    } catch {
      setTradeLookups([]);
    } finally {
      setTradeLookupsLoading(false);
    }
  }, []);

  const loadAreaQuestions = useCallback(async (areaId: number) => {
    setAreaQuestionsLoading(true);
    try {
      const res = await fetch(`/api/areasquestions?areaId=${areaId}`);
      const data = (await res.json()) as { areaQuestions?: AreaQuestionPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load area questions");
      setAreaQuestions(data.areaQuestions ?? []);
    } catch (e) {
      setAreaQuestions([]);
      setError(e instanceof Error ? e.message : "Failed to load area questions");
    } finally {
      setAreaQuestionsLoading(false);
    }
  }, []);

  const reloadAreaQuestionsForEdit = useCallback(async () => {
    if (displayAreaid != null) await loadAreaQuestions(displayAreaid);
  }, [displayAreaid, loadAreaQuestions]);

  const reloadAreaObjectsForEdit = useCallback(async () => {
    if (displayAreaid != null) await loadAreaObjects(displayAreaid);
  }, [displayAreaid, loadAreaObjects]);

  const reorderAreas = useTemplateReorder("/api/areas/reorder", load, (msg) => setError(msg));

  const reorderAreaObjects = useTemplateReorder(
    "/api/areaobjects/reorder",
    reloadAreaObjectsForEdit,
    (msg) => setError(msg),
  );

  useEffect(() => {
    async function bootstrapThenLoad() {
      setLoading(true);
      setError(null);
      try {
        const [initRes, areaObjectsInitRes] = await Promise.all([
          fetch("/api/areas/init", { method: "POST" }),
          fetch("/api/areaobjects/init", { method: "POST" }),
        ]);
        const initData = (await initRes.json()) as { error?: string };
        const areaObjectsInitData = (await areaObjectsInitRes.json()) as {
          error?: string;
        };
        if (!initRes.ok || !areaObjectsInitRes.ok) {
          setError(initData.error ?? "Failed to initialize areas collection in Firestore");
          setAreas([]);
          return;
        }
        if (areaObjectsInitData.error) {
          setError(areaObjectsInitData.error);
          setAreas([]);
          return;
        }
        await Promise.all([load({ skipPageLoading: true }), loadQuoteObjects()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initialization failed");
        setAreas([]);
      } finally {
        setLoading(false);
      }
    }
    void bootstrapThenLoad();
  }, [load, loadQuoteObjects]);

  function openCreate() {
    setEditingId(null);
    setDisplayAreaid(null);
    setAreaname("");
    setAreadescription("");
    setAreametersStr("");
    setIsDefault(false);
    setEditTab("details");
    setAreaObjects([]);
    setShowAddObjectForm(false);
    setAoEditingId(null);
    setAoQuoteObjectDocId("");
    setAoNotes3("");
    setAoNotes4("");
    setAoDefault(false);
    setAreaQuestions([]);
    setAqEditingId(null);
    setAqDeleteId(null);
    setAqQuestionText("");
    setAqDefaultAnswer("");
    setAqTradeLookupIds([]);
    setAqSortOrderStr("");
    setAqActive(true);
    setMode("create");
  }

  async function openEdit(a: AreaPublic) {
    setEditTab("details");
    setShowAddObjectForm(false);
    setAoEditingId(null);
    setAoQuoteObjectDocId("");
    setAoNotes3("");
    setAoNotes4("");
    setAoDefault(false);
    setAqEditingId(null);
    setAqDeleteId(null);
    setAqQuestionText("");
    setAqDefaultAnswer("");
    setAqTradeLookupIds([]);
    setAqSortOrderStr("");
    setAqActive(true);
    setEditingId(a.id);
    setDisplayAreaid(a.areaid ?? null);
    setAreaname(a.areaname);
    setAreadescription(a.areadescription);
    setAreametersStr(numToInput(a.areameters));
    setIsDefault(a.default);
    const aid = a.areaid ?? null;
    if (aid != null) {
      await Promise.all([loadAreaObjects(aid), loadAreaQuestions(aid), loadTrades()]);
    } else {
      setAreaObjects([]);
      setAreaQuestions([]);
    }
    setMode("edit");
  }

  function closeForm() {
    setMode("idle");
    setEditingId(null);
    setEditTab("details");
    setShowAddObjectForm(false);
    setAoEditingId(null);
    setAoDeleteId(null);
    setAoQuoteObjectDocId("");
    setAoNotes3("");
    setAoNotes4("");
    setAoDefault(false);
    setAqEditingId(null);
    setAqDeleteId(null);
    setAqQuestionText("");
    setAqDefaultAnswer("");
    setAqTradeLookupIds([]);
    setAqSortOrderStr("");
    setAqActive(true);
  }

  function buildPayload(): Record<string, unknown> {
    return {
      areaname,
      areadescription,
      areameters: parseNumberOrNull(areametersStr),
      default: isDefault,
    };
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (mode === "create") {
        const res = await fetch("/api/areas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as {
          id?: string;
          areaid?: number;
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
        const res = await fetch(`/api/areas/${editingId}`, {
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
      const res = await fetch(`/api/areas/${deleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      setDeleteId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const currentAreaId = displayAreaid;

  function openAreaObjectCreate() {
    setAoEditingId(null);
    setAoQuoteObjectDocId("");
    setAoNotes3("");
    setAoNotes4("");
    setAoDefault(false);
  }

  function closeAreaObjectForm() {
    setShowAddObjectForm(false);
    openAreaObjectCreate();
  }

  function openAreaObjectEdit(row: AreaObjectPublic) {
    setShowAddObjectForm(true);
    setAoEditingId(row.id);
    setAoQuoteObjectDocId(quoteObjects.find((q) => q.objectid === row.objectid)?.id ?? "");
    setAoNotes3(row.notes3);
    setAoNotes4(row.notes4);
    setAoDefault(row.default);
  }

  async function submitAreaObject() {
    if (currentAreaId == null || !editingId) {
      setError("Save the area and wait for an area ID before adding default objects.");
      return;
    }
    if (!aoEditingId && !aoQuoteObjectDocId) {
      setError("Select a quote object.");
      return;
    }

    setAoSaving(true);
    setError(null);
    try {
      if (aoEditingId) {
        const payload = {
          notes3: aoNotes3,
          notes4: aoNotes4,
          default: aoDefault,
        };
        const res = await fetch(`/api/areaobjects/${aoEditingId}`, {
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
        const payload = {
          areaDocId: editingId,
          quoteObjectDocId: aoQuoteObjectDocId,
          notes3: aoNotes3,
          notes4: aoNotes4,
          default: aoDefault,
        };
        const res = await fetch("/api/areaobjects", {
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
      closeAreaObjectForm();
      await loadAreaObjects(currentAreaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save area object");
    } finally {
      setAoSaving(false);
    }
  }

  async function confirmAreaObjectDelete() {
    if (!aoDeleteId || currentAreaId == null) return;
    setAoSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/areaobjects/${aoDeleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      }
      setAoDeleteId(null);
      await loadAreaObjects(currentAreaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete area object");
    } finally {
      setAoSaving(false);
    }
  }

  function openAreaQuestionCreate() {
    setAqEditingId(null);
    setAqQuestionText("");
    setAqDefaultAnswer("");
    setAqTradeLookupIds([]);
    setAqSortOrderStr("");
    setAqActive(true);
  }

  function openAreaQuestionEdit(row: AreaQuestionPublic) {
    setAqEditingId(row.id);
    setAqQuestionText(row.questionText);
    setAqDefaultAnswer(row.defaultAnswer ?? "");
    setAqTradeLookupIds(row.applicableTradeLookupIds ?? []);
    setAqSortOrderStr(numToInput(row.sortOrder));
    setAqActive(row.active !== false);
  }

  async function submitAreaQuestion() {
    if (currentAreaId == null) {
      setError("Save the area and wait for an area ID before adding questions.");
      return;
    }
    const qt = aqQuestionText.trim();
    if (!qt) {
      setError("Question text is required.");
      return;
    }
    setAqSaving(true);
    setError(null);
    try {
      const payload = {
        areaId: currentAreaId,
        questionText: qt,
        defaultAnswer: aqDefaultAnswer,
        applicableTradeLookupIds: aqTradeLookupIds,
        sortOrder: parseIntegerOrNull(aqSortOrderStr),
        active: aqActive,
      };
      if (aqEditingId) {
        const res = await fetch(`/api/areasquestions/${aqEditingId}`, {
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
        const res = await fetch("/api/areasquestions", {
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
      openAreaQuestionCreate();
      await loadAreaQuestions(currentAreaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save area question");
    } finally {
      setAqSaving(false);
    }
  }

  async function confirmAreaQuestionDelete() {
    if (!aqDeleteId || currentAreaId == null) return;
    setAqSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/areasquestions/${aqDeleteId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      }
      setAqDeleteId(null);
      await loadAreaQuestions(currentAreaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete area question");
    } finally {
      setAqSaving(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={sfSectionHeading}>Areas</h2>
          <p className={sfSectionLead}>
            Define standard project areas and defaults. Use the arrow buttons beside each area name
            (or row focus + arrow keys) to set the order areas appear when adding them to a project. In
            Edit area, the same controls reorder default objects (seed order on new project areas).
          </p>
        </div>
        <button type="button" onClick={openCreate} className={sfPrimaryToolbarButton}>
          Add area
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
        ) : areas.length === 0 ? (
          <p className="p-6 text-sf-text-secondary dark:text-zinc-400">
            No areas yet. Add one to create the{" "}
            <code className="rounded bg-sf-page px-1 font-mono text-sm dark:bg-zinc-800">
              areas
            </code>{" "}
            collection in Firestore.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm md:text-base">
              <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Area name</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Description</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Meters</th>
                  <th className="px-4 py-3 font-semibold md:px-5 md:py-4">Default</th>
                  <th className="px-4 py-3 text-right font-semibold md:px-5 md:py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a, i) => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onKeyDown={(e) => reorderAreas.onRowKeyDown(a.id, e)}
                    aria-label={`${a.areaname}. Arrow keys also reorder.`}
                    className="border-b border-sf-border last:border-0 outline-none focus-visible:bg-sf-page focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sf-brand/40 dark:border-zinc-700/80 dark:focus-visible:bg-zinc-800/40 dark:focus-visible:ring-sf-brand/40"
                  >
                    <td className="px-4 py-3 font-medium md:px-5 md:py-3.5">
                      <div className="flex w-full min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0">{a.areaname}</span>
                        <ReorderArrows
                          itemLabel={a.areaname}
                          onUp={() => void reorderAreas.moveRow(a.id, "up")}
                          onDown={() => void reorderAreas.moveRow(a.id, "down")}
                          disabledUp={i === 0}
                          disabledDown={i === areas.length - 1}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{a.areadescription || "—"}</td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">
                      {a.areameters ?? "—"}
                    </td>
                    <td className="px-4 py-3 md:px-5 md:py-3.5">{a.default ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-right md:px-5 md:py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className={sfRowIconBtn}
                          aria-label="Edit area"
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(a.id)}
                          className={sfRowIconBtnDanger}
                          aria-label="Delete area"
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
          aria-labelledby="area-form-title"
          onClick={closeForm}
        >
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-3xl sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
              <h2 id="area-form-title" className="text-lg font-semibold md:text-xl">
                {mode === "create" ? "New area" : "Edit area"}
              </h2>
            </div>
            <form onSubmit={submitForm} className="space-y-4 px-5 py-5">
              {mode === "edit" ? (
                <div className={sfTabStripClass} role="tablist" aria-label="Edit area tabs">
                  <button
                    type="button"
                    className={sfUnderlineTabClass(editTab === "details")}
                    role="tab"
                    aria-selected={editTab === "details"}
                    onClick={() => setEditTab("details")}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className={sfUnderlineTabClass(editTab === "objects")}
                    role="tab"
                    aria-selected={editTab === "objects"}
                    onClick={() => setEditTab("objects")}
                  >
                    Objects
                  </button>
                  <button
                    type="button"
                    className={sfUnderlineTabClass(editTab === "questions")}
                    role="tab"
                    aria-selected={editTab === "questions"}
                    onClick={() => {
                      setEditTab("questions");
                      if (currentAreaId != null) {
                        void Promise.all([reloadAreaQuestionsForEdit(), loadTrades()]);
                      }
                    }}
                  >
                    Questions
                  </button>
                </div>
              ) : null}

              {mode !== "edit" || editTab === "details" ? (
                <>
                  <div className="block">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Area ID
                    </span>
                    <input
                      readOnly
                      value={displayAreaid != null ? String(displayAreaid) : "— (assigned on save)"}
                      className={`${inputClass} bg-sf-page dark:bg-zinc-900`}
                    />
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Area name
                    </span>
                    <input
                      required
                      value={areaname}
                      onChange={(e) => setAreaname(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Description
                    </span>
                    <input
                      value={areadescription}
                      onChange={(e) => setAreadescription(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Area meters
                    </span>
                    <input
                      value={areametersStr}
                      onChange={(e) => setAreametersStr(e.target.value)}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="h-5 w-5 rounded border-sf-border-strong"
                    />
                    <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Default area
                    </span>
                  </label>
                </>
              ) : null}

              {mode === "edit" && editTab !== "details" ? (
                <div className="space-y-3 rounded-xl border border-sf-border p-4 dark:border-zinc-700">

                  {editTab === "objects" ? (
                    <>
                      <div>
                        <h3 className="text-base font-semibold">Default Objects In This Area</h3>
                        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                          Link quote objects to this area; IDs are assigned automatically.
                        </p>
                      </div>

                      {currentAreaId == null ? (
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Save the area once so an area ID is assigned, then add default objects.
                        </p>
                      ) : (
                        <>
                          {!showAddObjectForm && !aoEditingId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddObjectForm(true);
                                openAreaObjectCreate();
                              }}
                              className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2 text-sm font-medium dark:border-zinc-600"
                            >
                              Add object to area
                            </button>
                          ) : null}

                          {showAddObjectForm || aoEditingId ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Object
                                </span>
                                <select
                                  disabled={Boolean(aoEditingId)}
                                  value={aoQuoteObjectDocId}
                                  onChange={(e) => setAoQuoteObjectDocId(e.target.value)}
                                  className={inputClass}
                                >
                                  <option value="">Select object</option>
                                  {quoteObjectsSortedByName().map((q) => (
                                    <option key={q.id} value={q.id}>
                                      {q.objectname?.trim() ||
                                        (q.objectid != null ? `Object #${q.objectid}` : "Unnamed object")}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex items-center gap-3 pt-8 sm:pt-9">
                                <input
                                  type="checkbox"
                                  checked={aoDefault}
                                  onChange={(e) => setAoDefault(e.target.checked)}
                                  className="h-5 w-5 rounded border-sf-border-strong"
                                />
                                <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Default item in area
                                </span>
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Notes 3
                                </span>
                                <input
                                  value={aoNotes3}
                                  onChange={(e) => setAoNotes3(e.target.value)}
                                  className={inputClass}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                  Notes 4
                                </span>
                                <input
                                  value={aoNotes4}
                                  onChange={(e) => setAoNotes4(e.target.value)}
                                  className={inputClass}
                                />
                              </label>
                              <div className="sm:col-span-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void submitAreaObject()}
                                  disabled={aoSaving}
                                  className="min-h-11 rounded-lg bg-sf-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                                >
                                  {aoSaving ? "Saving…" : aoEditingId ? "Update area object" : "Add area object"}
                                </button>
                                <button
                                  type="button"
                                  onClick={closeAreaObjectForm}
                                  className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2 text-sm font-medium dark:border-zinc-600"
                                >
                                  {aoEditingId ? "Cancel edit" : "Cancel"}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="overflow-x-auto rounded-lg border border-sf-border dark:border-zinc-700">
                            {areaObjectsLoading ? (
                              <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                                Loading linked objects…
                              </p>
                            ) : areaObjects.length === 0 ? (
                              <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                                No linked objects yet.
                              </p>
                            ) : (
                              <table className="w-full min-w-[720px] text-left text-sm">
                                <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">Object</th>
                                    <th className="px-3 py-2 font-semibold">Default</th>
                                    <th className="px-3 py-2 font-semibold">Tool tip (quote object)</th>
                                    <th className="px-3 py-2 font-semibold">Notes 3</th>
                                    <th className="px-3 py-2 font-semibold">Notes 4</th>
                                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {areaObjects.map((row, i) => {
                                    const obj = quoteObjects.find((q) => q.objectid === row.objectid);
                                    const label = obj?.objectname?.trim() ? obj.objectname : `Object #${row.objectid}`;
                                    return (
                                      <tr
                                        key={row.id}
                                        tabIndex={0}
                                        onKeyDown={(e) => reorderAreaObjects.onRowKeyDown(row.id, e)}
                                        aria-label={`${label}. Arrow keys also reorder.`}
                                        className="border-b border-sf-border last:border-0 outline-none focus-visible:bg-sf-page focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sf-brand/40 dark:border-zinc-700/80 dark:focus-visible:bg-zinc-800/40 dark:focus-visible:ring-sf-brand/40"
                                      >
                                        <td className="px-3 py-2">
                                          <div className="flex w-full min-w-0 items-center justify-between gap-2">
                                            <span className="min-w-0">{label}</span>
                                            <ReorderArrows
                                              dense
                                              itemLabel={label}
                                              onUp={() => void reorderAreaObjects.moveRow(row.id, "up")}
                                              onDown={() => void reorderAreaObjects.moveRow(row.id, "down")}
                                              disabledUp={i === 0}
                                              disabledDown={i === areaObjects.length - 1}
                                            />
                                          </div>
                                        </td>
                                        <td className="px-3 py-2">{row.default ? "Yes" : "No"}</td>
                                        <td className="max-w-[14rem] px-3 py-2 text-xs text-sf-text-secondary dark:text-zinc-400">
                                          {obj?.tooltip?.trim() ? obj.tooltip : "—"}
                                        </td>
                                        <td className="px-3 py-2">{row.notes3 || "—"}</td>
                                        <td className="px-3 py-2">{row.notes4 || "—"}</td>
                                        <td className="px-3 py-2 text-right">
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => openAreaObjectEdit(row)}
                                              className={sfRowIconBtn}
                                              aria-label="Edit area object"
                                            >
                                              <IconPencil className="h-4 w-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setAoDeleteId(row.id)}
                                              className={sfRowIconBtnDanger}
                                              aria-label="Delete area object"
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
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-base font-semibold">Area Questions</h3>
                        <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                          Define reusable questions for this template area. These will be copied to projects when the area is added.
                        </p>
                      </div>

                      {currentAreaId == null ? (
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Save the area once so an area ID is assigned, then add questions.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block sm:col-span-2">
                              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                Question Text
                              </span>
                              <input
                                required
                                value={aqQuestionText}
                                onChange={(e) => setAqQuestionText(e.target.value)}
                                className={inputClass}
                              />
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                Default Answer
                              </span>
                              <textarea
                                value={aqDefaultAnswer}
                                onChange={(e) => setAqDefaultAnswer(e.target.value)}
                                className={`${inputClass} min-h-28`}
                                rows={4}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                Applicable Trades
                              </span>
                              <select
                                multiple
                                value={aqTradeLookupIds.map(String)}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                                  setAqTradeLookupIds(selected.filter((n) => Number.isInteger(n)));
                                }}
                                className={inputClass}
                                disabled={tradeLookupsLoading}
                              >
                                {tradeLookups.length === 0 ? (
                                  <option value="" disabled>
                                    {tradeLookupsLoading ? "Loading…" : "No Trades lookups yet"}
                                  </option>
                                ) : (
                                  tradeLookups.map((t) => (
                                    <option key={t.id} value={t.lookupid ?? ""} disabled={t.lookupid == null}>
                                      {t.lookupvalue}
                                    </option>
                                  ))
                                )}
                              </select>
                              <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
                                Hold Ctrl (Windows) to select multiple.
                              </span>
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                Sort Order
                              </span>
                              <input
                                value={aqSortOrderStr}
                                onChange={(e) => setAqSortOrderStr(e.target.value)}
                                inputMode="numeric"
                                className={inputClass}
                              />
                            </label>
                            <label className="flex items-center gap-3 pt-1 sm:col-span-2">
                              <input
                                type="checkbox"
                                checked={aqActive}
                                onChange={(e) => setAqActive(e.target.checked)}
                                className="h-5 w-5 rounded border-sf-border-strong"
                              />
                              <span className="text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                                Active
                              </span>
                            </label>
                            <div className="sm:col-span-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void submitAreaQuestion()}
                                disabled={aqSaving}
                                className="min-h-11 rounded-lg bg-sf-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                              >
                                {aqSaving ? "Saving…" : aqEditingId ? "Update question" : "Add question"}
                              </button>
                              <button
                                type="button"
                                onClick={() => openAreaQuestionCreate()}
                                className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2 text-sm font-medium dark:border-zinc-600"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-sf-border dark:border-zinc-700">
                            {areaQuestionsLoading ? (
                              <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                                Loading questions…
                              </p>
                            ) : areaQuestions.length === 0 ? (
                              <p className="p-3 text-sm text-sf-text-secondary dark:text-zinc-400">
                                No questions yet.
                              </p>
                            ) : (
                              <table className="w-full min-w-[720px] text-left text-sm">
                                <thead className="border-b border-sf-border bg-sf-page dark:border-zinc-700 dark:bg-zinc-900">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">Question</th>
                                    <th className="px-3 py-2 font-semibold">Trades</th>
                                    <th className="px-3 py-2 font-semibold">Sort</th>
                                    <th className="px-3 py-2 font-semibold">Active</th>
                                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {areaQuestions.map((row) => {
                                    const tradeLabels = (row.applicableTradeLookupIds ?? [])
                                      .map((id) => tradeLookups.find((t) => t.lookupid === id)?.lookupvalue)
                                      .filter(Boolean)
                                      .join(", ");
                                    return (
                                      <tr
                                        key={row.id}
                                        className="border-b border-sf-border last:border-0 dark:border-zinc-700/80"
                                      >
                                        <td className="px-3 py-2">{row.questionText || "—"}</td>
                                        <td className="px-3 py-2 text-xs text-sf-text-secondary dark:text-zinc-400">
                                          {tradeLabels || "—"}
                                        </td>
                                        <td className="px-3 py-2">{row.sortOrder ?? "—"}</td>
                                        <td className="px-3 py-2">{row.active ? "Yes" : "No"}</td>
                                        <td className="px-3 py-2 text-right">
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => openAreaQuestionEdit(row)}
                                              className={sfRowIconBtn}
                                              aria-label="Edit area question"
                                            >
                                              <IconPencil className="h-4 w-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setAqDeleteId(row.id)}
                                              className={sfRowIconBtnDanger}
                                              aria-label="Delete area question"
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
                        </>
                      )}
                    </>
                  )}
                </div>
              ) : null}

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
                  className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(aoDeleteId)}
        title="Delete area object?"
        description="This removes the linked default object from this area."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        pending={aoSaving}
        onCancel={() => setAoDeleteId(null)}
        onConfirm={() => void confirmAreaObjectDelete()}
      />

      <ConfirmDialog
        open={Boolean(aqDeleteId)}
        title="Delete area question?"
        description="This removes the setup question from this template area."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        pending={aqSaving}
        onCancel={() => setAqDeleteId(null)}
        onConfirm={() => void confirmAreaQuestionDelete()}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete area?"
        description="This removes the area document from Firestore. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        pending={saving}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
