"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ScopeAnswerObjectPicker } from "@/components/scope-answer-object-picker";
import { ScopeMetricsEditor } from "@/components/scope-metrics-editor";
import {
  draftToPayload,
  publicAnswersToDraft,
  type ScopeFormDraftAnswer,
} from "@/lib/client/scope-form-draft";
import { readApiJson } from "@/lib/client/read-api-json";
import { loadCatalogSkuData } from "@/lib/client/load-catalog-sku-data";
import {
  DEFAULT_SCOPE_TOOL_TYPE,
  SCOPE_TOOL_TYPES,
  scopeToolTypeLabel,
  type ScopeToolType,
} from "@/lib/scope-tools";
import {
  DEFAULT_SYSTEM_SCOPE_TYPE,
  isSystemScopeObjectId,
  SYSTEM_SCOPE_TYPES,
  systemScopeObjectId,
  type SystemScopeType,
} from "@/lib/system-scope-types";
import type { AreaPublic } from "@/types/area";
import type { InheritMeasureSource } from "@/types/scope-metric";
import type { ScopeMetricPublic } from "@/types/scope-metric";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { ScopePublic } from "@/types/scope";
import { sfTabStripClass, sfUnderlineTabClass } from "@/lib/sf-tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ScopeFormTab = "details" | "answers";

export type ScopeFormMode =
  | "create"
  | "create-header"
  | "edit"
  | "edit-header"
  | "edit-footer";

const inputClass =
  "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

function cloneScopeMetricsDraft(metrics: ScopeMetricPublic[] | undefined): ScopeMetricPublic[] {
  return (metrics ?? []).map((m) => ({
    metricid: m.metricid,
    label: m.label,
    uom: m.uom,
    answerids: [...m.answerids],
  }));
}

const EMPTY_AREA_DOC_IDS: string[] = [];
const EMPTY_SCOPES: ScopePublic[] = [];

type Props = {
  open: boolean;
  mode: ScopeFormMode;
  /** Required for edit modes when `scopeDocId` is not used. */
  scope?: ScopePublic | null;
  /** Fetch full scope from API on open (answers + attachments). Used from Data Objects grid. */
  scopeDocId?: string | null;
  areas: AreaPublic[];
  quoteObjects: QuoteObjectPublic[];
  /** Used for scope id display and header insert-after on create. */
  scopes?: ScopePublic[];
  selectedScopeRowId?: string | null;
  /** Pre-fill area tags when creating a question scope. */
  defaultAreaDocIds?: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function ScopeFormModal({
  open,
  mode,
  scope = null,
  scopeDocId = null,
  areas,
  quoteObjects: quoteObjectsProp,
  scopes = EMPTY_SCOPES,
  selectedScopeRowId = null,
  defaultAreaDocIds = EMPTY_AREA_DOC_IDS,
  onClose,
  onSaved,
}: Props) {
  const [fetchedScope, setFetchedScope] = useState<ScopePublic | null>(null);
  const [fetchingScope, setFetchingScope] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [areaDocId, setAreaDocId] = useState("");
  const [questionAreaDocIds, setQuestionAreaDocIds] = useState<string[]>([]);
  const [tagAllAreasDraft, setTagAllAreasDraft] = useState(false);
  const [questionAreaPickerKey, setQuestionAreaPickerKey] = useState(0);
  const [question, setQuestion] = useState("");
  const [draftAnswers, setDraftAnswers] = useState<ScopeFormDraftAnswer[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [quoteObjects, setQuoteObjects] = useState<QuoteObjectPublic[]>(quoteObjectsProp);
  const [quoteObjectsLoading, setQuoteObjectsLoading] = useState(false);
  const [catalogSkus, setCatalogSkus] = useState<DataSkuPublic[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerRemoveConfirmId, setAnswerRemoveConfirmId] = useState<string | null>(null);
  const [systemScopeDraft, setSystemScopeDraft] = useState(false);
  const [systemScopeTypeDraft, setSystemScopeTypeDraft] =
    useState<SystemScopeType>(DEFAULT_SYSTEM_SCOPE_TYPE);
  const [exposeToolDraft, setExposeToolDraft] = useState(false);
  const [scopeToolTypeDraft, setScopeToolTypeDraft] =
    useState<ScopeToolType>(DEFAULT_SCOPE_TOOL_TYPE);
  const [scopeMetricsDraft, setScopeMetricsDraft] = useState<ScopeMetricPublic[]>([]);
  const [activeTab, setActiveTab] = useState<ScopeFormTab>("details");
  const formInitializedForRef = useRef<string | null>(null);

  const activeScope = scopeDocId?.trim() ? fetchedScope : scope;
  const activeScopeId = activeScope?.id ?? null;

  const effectiveMode: ScopeFormMode =
    scopeDocId?.trim() && fetchedScope ? scopeFormModeForScope(fetchedScope) : mode;

  const defaultAreaDocIdsKey = defaultAreaDocIds.join("\u0001");

  /** Stable key — effect runs once per open/edit target, not on every parent render. */
  const formInitKey = useMemo(() => {
    if (!open) return null;
    const docId = scopeDocId?.trim();
    if (docId) {
      if (fetchingScope || !fetchedScope) return `fetch:${docId}`;
      return `doc:${docId}`;
    }
    if (effectiveMode === "create") return `create:${defaultAreaDocIdsKey}`;
    if (effectiveMode === "create-header") {
      return `create-header:${selectedScopeRowId ?? ""}:${defaultAreaDocIdsKey}`;
    }
    if (activeScopeId) return `scope:${activeScopeId}:${effectiveMode}`;
    return effectiveMode;
  }, [
    open,
    scopeDocId,
    fetchingScope,
    fetchedScope,
    effectiveMode,
    activeScopeId,
    selectedScopeRowId,
    defaultAreaDocIdsKey,
  ]);

  const isSectionMarkerForm =
    effectiveMode === "create-header" ||
    effectiveMode === "edit-header" ||
    effectiveMode === "edit-footer";

  const editingId =
    effectiveMode === "edit" ||
    effectiveMode === "edit-header" ||
    effectiveMode === "edit-footer"
      ? activeScope?.id ?? null
      : null;

  const isEditMode =
    effectiveMode === "edit" ||
    effectiveMode === "edit-header" ||
    effectiveMode === "edit-footer";

  const areasForFilter = useMemo(() => {
    return [...areas].sort((a, b) => {
      const ao = a.sortOrder;
      const bo = b.sortOrder;
      const aHas = typeof ao === "number" && Number.isFinite(ao);
      const bHas = typeof bo === "number" && Number.isFinite(bo);
      if (aHas && bHas && ao !== bo) return ao - bo;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.areaname.localeCompare(b.areaname, undefined, { sensitivity: "base" });
    });
  }, [areas]);

  const quoteById = useMemo(() => {
    const m = new Map<string, QuoteObjectPublic>();
    for (const q of quoteObjects) m.set(q.id, q);
    return m;
  }, [quoteObjects]);

  const areasToAddForQuestion = useMemo(() => {
    if (tagAllAreasDraft) return [];
    return areasForFilter.filter((a) => !questionAreaDocIds.includes(a.id));
  }, [areasForFilter, questionAreaDocIds, tagAllAreasDraft]);

  const loadQuoteObjects = useCallback(async (): Promise<QuoteObjectPublic[]> => {
    setQuoteObjectsLoading(true);
    try {
      const quoteRes = await fetch("/api/quote-objects");
      const quoteData = await readApiJson<{ quoteObjects?: QuoteObjectPublic[]; error?: string }>(
        quoteRes,
      );
      if (!quoteRes.ok) throw new Error(quoteData.error ?? "Failed to load quote objects");
      const list = quoteData.quoteObjects ?? [];
      setQuoteObjects(list);
      return list;
    } finally {
      setQuoteObjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setCatalogSkus([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { skus } = await loadCatalogSkuData();
        if (!cancelled) setCatalogSkus(skus);
      } catch {
        if (!cancelled) setCatalogSkus([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuoteObjects(quoteObjectsProp);
    }
  }, [open, quoteObjectsProp]);

  useEffect(() => {
    if (!open) {
      setFetchedScope(null);
      setFetchingScope(false);
      setFormReady(false);
      formInitializedForRef.current = null;
      return;
    }
    const docId = scopeDocId?.trim();
    if (!docId) return;

    let cancelled = false;
    setFetchingScope(true);
    setFormReady(false);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/scopes/${encodeURIComponent(docId)}`);
        const data = await readApiJson<{ scope?: ScopePublic; error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to load scope");
        if (!cancelled) setFetchedScope(data.scope ?? null);
      } catch (e) {
        if (!cancelled) {
          setFetchedScope(null);
          setError(e instanceof Error ? e.message : "Failed to load scope");
        }
      } finally {
        if (!cancelled) setFetchingScope(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, scopeDocId]);

  useEffect(() => {
    if (!open || !formInitKey) {
      if (!open) formInitializedForRef.current = null;
      return;
    }
    if (formInitKey.startsWith("fetch:")) {
      setFormReady(false);
      return;
    }
    if (formInitializedForRef.current === formInitKey) return;
    formInitializedForRef.current = formInitKey;

    setError(null);
    setSaving(false);
    setAnswerRemoveConfirmId(null);
    setActiveTab("details");
    setFormReady(false);

    if (effectiveMode === "create") {
      setAreaDocId("");
      setTagAllAreasDraft(false);
      setQuestionAreaDocIds([...defaultAreaDocIds]);
      setQuestionAreaPickerKey((k) => k + 1);
      setQuestion("");
      const first = {
        answerid: crypto.randomUUID(),
        label: "Yes",
        attachedQuoteObjectIds: [] as string[],
        attachedObjectTools: {},
        attachedObjectShowAll: {},
        attachedObjectNoCharge: {},
        attachedObjectForce: {},
        attachedObjectInheritM2Source: {},
        attachedObjectInheritMeasureLocked: {},
      };
      setDraftAnswers([first]);
      setSelectedAnswerId(first.answerid);
      setSystemScopeDraft(false);
      setSystemScopeTypeDraft(DEFAULT_SYSTEM_SCOPE_TYPE);
      setExposeToolDraft(false);
      setScopeToolTypeDraft(DEFAULT_SCOPE_TOOL_TYPE);
      setScopeMetricsDraft([]);
      void loadQuoteObjects().then(() => setFormReady(true));
      return;
    }

    if (effectiveMode === "create-header") {
      const sel = selectedScopeRowId ? scopes.find((s) => s.id === selectedScopeRowId) : null;
      setAreaDocId(sel?.areaDocId ?? defaultAreaDocIds[0] ?? "");
      setTagAllAreasDraft(false);
      setQuestionAreaDocIds([]);
      setQuestion("");
      setDraftAnswers([]);
      setSelectedAnswerId(null);
      setScopeMetricsDraft([]);
      setFormReady(true);
      return;
    }

    if (!activeScope) return;

    setAreaDocId(activeScope.areaDocId);
    setTagAllAreasDraft(false);
    setQuestionAreaDocIds([...activeScope.areaDocIds]);
    setQuestion(activeScope.question);
    setSystemScopeDraft(activeScope.systemScope === true);
    setSystemScopeTypeDraft(activeScope.systemScopeType ?? DEFAULT_SYSTEM_SCOPE_TYPE);
    setExposeToolDraft(activeScope.exposeTool === true);
    setScopeToolTypeDraft(activeScope.scopeToolType ?? DEFAULT_SCOPE_TOOL_TYPE);
    setScopeMetricsDraft(cloneScopeMetricsDraft(activeScope.scopeMetrics));

    if (activeScope.kind === "header") {
      setDraftAnswers([]);
      setSelectedAnswerId(null);
      setScopeMetricsDraft([]);
      setFormReady(true);
      return;
    }
    if (activeScope.kind === "footer") {
      setDraftAnswers([]);
      setSelectedAnswerId(null);
      setScopeMetricsDraft([]);
      setFormReady(true);
      return;
    }

    void (async () => {
      try {
        const qos = await loadQuoteObjects();
        const byId = new Map(qos.map((q) => [q.id, q]));
        const drafts = publicAnswersToDraft(activeScope.answers, byId);
        setDraftAnswers(drafts);
        setSelectedAnswerId(drafts[0]?.answerid ?? null);
        setFormReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load quote objects");
      }
    })();
  }, [formInitKey, effectiveMode, activeScope, defaultAreaDocIds, selectedScopeRowId, scopes, loadQuoteObjects, open]);

  function stripSystemAttachmentsFromAnswers() {
    setDraftAnswers((prev) =>
      prev.map((a) => ({
        ...a,
        attachedQuoteObjectIds: a.attachedQuoteObjectIds.filter((id) => !isSystemScopeObjectId(id)),
      })),
    );
  }

  function pruneSystemAttachmentsForType(type: SystemScopeType) {
    const allowedId = systemScopeObjectId(type);
    setDraftAnswers((prev) =>
      prev.map((a) => ({
        ...a,
        attachedQuoteObjectIds: a.attachedQuoteObjectIds.filter(
          (id) => !isSystemScopeObjectId(id) || id === allowedId,
        ),
      })),
    );
  }

  function addAnswer() {
    const id = crypto.randomUUID();
    setDraftAnswers((prev) => [
      ...prev,
      {
        answerid: id,
        label: `Option ${prev.length + 1}`,
        attachedQuoteObjectIds: [],
        attachedObjectTools: {},
        attachedObjectShowAll: {},
        attachedObjectNoCharge: {},
        attachedObjectForce: {},
        attachedObjectInheritM2Source: {},
        attachedObjectInheritMeasureLocked: {},
      },
    ]);
    setSelectedAnswerId(id);
  }

  function removeAnswer(answerid: string) {
    setScopeMetricsDraft((prev) =>
      prev.map((m) => ({
        ...m,
        answerids: m.answerids.filter((id) => id !== answerid),
      })),
    );
    setDraftAnswers((prev) => {
      const next = prev.filter((a) => a.answerid !== answerid);
      setSelectedAnswerId((sel) => (sel === answerid ? (next[0]?.answerid ?? null) : sel));
      return next;
    });
    setAnswerRemoveConfirmId(null);
  }

  function updateAnswerLabel(answerid: string, label: string) {
    setDraftAnswers((prev) =>
      prev.map((a) => (a.answerid === answerid ? { ...a, label } : a)),
    );
  }

  function setAnswerQuoteObjectIds(answerid: string, ids: string[]) {
    setDraftAnswers((prev) =>
      prev.map((a) => {
        if (a.answerid !== answerid) return a;
        const idSet = new Set(ids);
        const attachedObjectTools: Partial<Record<string, ScopeToolType>> = {};
        for (const [key, tool] of Object.entries(a.attachedObjectTools)) {
          if (idSet.has(key)) attachedObjectTools[key] = tool;
        }
        const attachedObjectShowAll: Partial<Record<string, boolean>> = {};
        const attachedObjectNoCharge: Partial<Record<string, boolean>> = {};
        const attachedObjectForce: Partial<Record<string, boolean>> = {};
        const attachedObjectInheritM2Source: Partial<Record<string, InheritMeasureSource>> =
          {};
        const attachedObjectInheritMeasureLocked: Partial<Record<string, boolean>> = {};
        for (const [key, flag] of Object.entries(a.attachedObjectShowAll)) {
          if (idSet.has(key) && flag) attachedObjectShowAll[key] = true;
        }
        for (const [key, flag] of Object.entries(a.attachedObjectNoCharge)) {
          if (idSet.has(key) && flag) attachedObjectNoCharge[key] = true;
        }
        for (const [key, flag] of Object.entries(a.attachedObjectForce)) {
          if (idSet.has(key) && flag) attachedObjectForce[key] = true;
        }
        for (const [key, src] of Object.entries(a.attachedObjectInheritM2Source)) {
          if (idSet.has(key) && src) attachedObjectInheritM2Source[key] = src;
        }
        for (const [key, locked] of Object.entries(a.attachedObjectInheritMeasureLocked)) {
          if (idSet.has(key) && locked === false) attachedObjectInheritMeasureLocked[key] = false;
        }
        return {
          ...a,
          attachedQuoteObjectIds: ids,
          attachedObjectTools,
          attachedObjectShowAll,
          attachedObjectNoCharge,
          attachedObjectForce,
          attachedObjectInheritM2Source,
          attachedObjectInheritMeasureLocked,
        };
      }),
    );
  }

  function setAnswerObjectTools(
    answerid: string,
    tools: Partial<Record<string, ScopeToolType>>,
  ) {
    setDraftAnswers((prev) =>
      prev.map((a) => (a.answerid === answerid ? { ...a, attachedObjectTools: tools } : a)),
    );
  }

  function setAnswerObjectShowAll(
    answerid: string,
    showAll: Partial<Record<string, boolean>>,
  ) {
    setDraftAnswers((prev) =>
      prev.map((a) => (a.answerid === answerid ? { ...a, attachedObjectShowAll: showAll } : a)),
    );
  }

  function setAnswerObjectNoCharge(
    answerid: string,
    noCharge: Partial<Record<string, boolean>>,
  ) {
    setDraftAnswers((prev) =>
      prev.map((a) => (a.answerid === answerid ? { ...a, attachedObjectNoCharge: noCharge } : a)),
    );
  }

  function setAnswerObjectForce(
    answerid: string,
    force: Partial<Record<string, boolean>>,
  ) {
    setDraftAnswers((prev) =>
      prev.map((a) => (a.answerid === answerid ? { ...a, attachedObjectForce: force } : a)),
    );
  }

  function setAnswerObjectInheritM2Source(
    answerid: string,
    inheritM2Source: Partial<Record<string, InheritMeasureSource>>,
  ) {
    setDraftAnswers((prev) =>
      prev.map((a) =>
        a.answerid === answerid ? { ...a, attachedObjectInheritM2Source: inheritM2Source } : a,
      ),
    );
  }

  function setAnswerObjectInheritMeasureLocked(
    answerid: string,
    inheritMeasureLocked: Partial<Record<string, boolean>>,
  ) {
    setDraftAnswers((prev) =>
      prev.map((a) =>
        a.answerid === answerid
          ? { ...a, attachedObjectInheritMeasureLocked: inheritMeasureLocked }
          : a,
      ),
    );
  }

  function removeQuestionAreaTag(id: string) {
    setQuestionAreaDocIds((prev) => prev.filter((x) => x !== id));
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!isSectionMarkerForm && !tagAllAreasDraft && questionAreaDocIds.length === 0) {
      setError("Select at least one template area, or use “All template areas”.");
      return;
    }
    if (isSectionMarkerForm && !areaDocId) {
      setError("Select an area.");
      return;
    }
    if (!isSectionMarkerForm && systemScopeDraft && !systemScopeTypeDraft) {
      setError("Select a system scope type.");
      return;
    }
    if (!isSectionMarkerForm && exposeToolDraft && !scopeToolTypeDraft) {
      setError("Select a tool.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isHeader = effectiveMode === "create-header" || effectiveMode === "edit-header";
      const isFooterEdit = effectiveMode === "edit-footer";
      if (isHeader) {
        const payload: Record<string, unknown> = {
          areaDocId,
          question,
          kind: "header" as const,
          pairFooter: true,
        };
        const sel = selectedScopeRowId ? scopes.find((x) => x.id === selectedScopeRowId) : null;
        if (sel && sel.areaDocIds.includes(areaDocId)) {
          payload.insertAfterScopeDocId = selectedScopeRowId;
        }
        if (effectiveMode === "create-header") {
          const res = await fetch("/api/scopes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await readApiJson<{ error?: string; details?: unknown }>(res);
          if (!res.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : JSON.stringify(data.details ?? data);
            throw new Error(msg);
          }
        } else if (effectiveMode === "edit-header" && editingId) {
          const patchPayload = { areaDocId, question, kind: "header" as const };
          const res = await fetch(`/api/scopes/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchPayload),
          });
          const data = await readApiJson<{ error?: string; details?: unknown }>(res);
          if (!res.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : JSON.stringify(data.details ?? data);
            throw new Error(msg);
          }
        }
      } else if (isFooterEdit && editingId) {
        const payload = { areaDocId, question, kind: "footer" as const };
        const res = await fetch(`/api/scopes/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await readApiJson<{ error?: string; details?: unknown }>(res);
        if (!res.ok) {
          const msg =
            typeof data.error === "string" ? data.error : JSON.stringify(data.details ?? data);
          throw new Error(msg);
        }
      } else {
        const payload: Record<string, unknown> = {
          question,
          answers: draftToPayload(draftAnswers, quoteById),
          scopeMetrics: scopeMetricsDraft.map((m) => ({
            metricid: m.metricid,
            label: m.label.trim(),
            uom: m.uom.trim(),
            answerids: [...m.answerids],
          })),
          systemScope: systemScopeDraft,
          systemScopeType: systemScopeDraft ? systemScopeTypeDraft : null,
          exposeTool: exposeToolDraft,
          scopeToolType: exposeToolDraft ? scopeToolTypeDraft : null,
        };
        if (tagAllAreasDraft) {
          payload.tagAllAreas = true;
        } else {
          payload.areaDocIds = questionAreaDocIds;
        }
        if (effectiveMode === "create") {
          const res = await fetch("/api/scopes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await readApiJson<{ error?: string; details?: unknown }>(res);
          if (!res.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : JSON.stringify(data.details ?? data);
            throw new Error(msg);
          }
        } else if (effectiveMode === "edit" && editingId) {
          const res = await fetch(`/api/scopes/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await readApiJson<{ error?: string; details?: unknown }>(res);
          if (!res.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : JSON.stringify(data.details ?? data);
            throw new Error(msg);
          }
        }
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedAnswer = draftAnswers.find((a) => a.answerid === selectedAnswerId) ?? null;
  const pendingRemoveAnswerLabel =
    draftAnswers.find((a) => a.answerid === answerRemoveConfirmId)?.label?.trim() || "";

  if (!open) return null;

  const title =
    effectiveMode === "create-header"
      ? "New section header"
      : effectiveMode === "edit-header"
        ? "Edit section header"
        : effectiveMode === "edit-footer"
          ? "Edit section footer"
          : effectiveMode === "create"
            ? "New scope"
            : "Edit scope";

  const showLoading = fetchingScope || ((isEditMode || effectiveMode === "create") && !formReady && !error);

  const saveDisabled =
    saving ||
    (isSectionMarkerForm
      ? !question.trim()
      : draftAnswers.length === 0 ||
        (!tagAllAreasDraft && questionAreaDocIds.length === 0));

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-form-title"
        onClick={() => {
          if (answerRemoveConfirmId) {
            setAnswerRemoveConfirmId(null);
            return;
          }
          onClose();
        }}
      >
        <div
          className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-[96rem] sm:rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-sf-border px-5 py-4 dark:border-zinc-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 id="scope-form-title" className="text-lg font-semibold md:text-xl">
                    {title}
                  </h2>
                  {!isSectionMarkerForm && !showLoading ? (
                    <input
                      readOnly
                      tabIndex={-1}
                      size={10}
                      aria-label="Scope ID"
                      title={
                        effectiveMode === "edit" && activeScope
                          ? `Scope ID ${activeScope.scopeid ?? "—"}`
                          : "Scope ID assigned on save"
                      }
                      value={
                        effectiveMode === "edit" && activeScope
                          ? String(activeScope.scopeid ?? "—")
                          : "—"
                      }
                      className="w-[10ch] min-h-0 shrink-0 rounded border border-sf-border/60 bg-sf-page/50 px-1.5 py-0.5 text-xs font-normal text-sf-text-weak dark:border-zinc-700/60 dark:bg-zinc-900/50 dark:text-zinc-500"
                    />
                  ) : null}
                </div>
                {isSectionMarkerForm ? (
                  <p className="mt-2 text-sm text-sf-text-secondary dark:text-zinc-400">
                    {effectiveMode === "edit-footer" ? (
                      <>
                        Footers mark the end of a section block (for future section-level actions). They
                        do not collect answers or add lines—move this row with ↑ ↓ to wrap the questions
                        between the header and footer.
                      </>
                    ) : (
                      <>
                        Section headers are labels only. They do not collect answers or add lines—use
                        them to group scope questions in the checklist.
                      </>
                    )}
                  </p>
                ) : null}
              </div>
              {!showLoading ? (
                <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600 sm:min-h-10 sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="scope-form"
                    disabled={saveDisabled}
                    className="min-h-11 rounded-lg bg-sf-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:min-h-10 sm:text-base"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {error ? (
            <div
              className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {showLoading ? (
            <p className="px-5 py-10 text-sm text-sf-text-secondary dark:text-zinc-400">
              {fetchingScope ? "Loading scope…" : "Loading quote objects…"}
            </p>
          ) : (
          <form id="scope-form" onSubmit={submitForm} className="space-y-4 px-5 py-5">
            {!isSectionMarkerForm ? (
              <div className={sfTabStripClass} role="tablist" aria-label="Scope sections">
                <button
                  type="button"
                  className={sfUnderlineTabClass(activeTab === "details")}
                  role="tab"
                  aria-selected={activeTab === "details"}
                  onClick={() => setActiveTab("details")}
                >
                  Scope Details
                </button>
                <button
                  type="button"
                  className={sfUnderlineTabClass(activeTab === "answers")}
                  role="tab"
                  aria-selected={activeTab === "answers"}
                  onClick={() => setActiveTab("answers")}
                >
                  Scope Answers
                </button>
              </div>
            ) : null}

            {!isSectionMarkerForm && activeTab === "details" ? (
              <div className="space-y-2 rounded-lg border border-sf-border bg-sf-page/40 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <span className="block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Area tags
                </span>
                <p className="text-xs text-sf-text-weak dark:text-zinc-400">
                  Link this scope to one or more template areas (same pattern as Setup → Quote
                  Objects).
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-sf-text dark:text-zinc-200">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-sf-border-strong"
                    checked={tagAllAreasDraft}
                    onChange={(e) => setTagAllAreasDraft(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">All template areas</span>
                    <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                      Snapshots every area at save. New areas you add later are not included until you
                      edit this scope.
                    </span>
                  </span>
                </label>
                {!tagAllAreasDraft ? (
                  <>
                    {questionAreaDocIds.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {questionAreaDocIds.map((id) => {
                          const label = areas.find((a) => a.id === id)?.areaname?.trim() || id;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-full bg-sf-surface px-2.5 py-1 text-sm text-sf-text shadow-sm dark:bg-zinc-800 dark:text-zinc-200"
                            >
                              {label}
                              <button
                                type="button"
                                onClick={() => removeQuestionAreaTag(id)}
                                className="rounded-full p-0.5 text-sf-text-weak hover:bg-sf-border/50 hover:text-sf-text dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                                aria-label={`Remove ${label}`}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                    <select
                      key={questionAreaPickerKey}
                      className={`${inputClass} max-w-md`}
                      defaultValue=""
                      aria-label="Add template area tag"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setQuestionAreaDocIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
                        setQuestionAreaPickerKey((k) => k + 1);
                      }}
                    >
                      <option value="">— Add area…</option>
                      {areasToAddForQuestion.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.areaname}
                        </option>
                      ))}
                    </select>
                    {areasForFilter.length === 0 ? (
                      <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                        Add template areas under Setup → Areas first.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-sf-text-weak dark:text-zinc-400">
                    All areas is on — turn it off to pick individual tags.
                  </p>
                )}
              </div>
            ) : isSectionMarkerForm ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                  Area
                </span>
                <select
                  required
                  value={areaDocId}
                  onChange={(e) => setAreaDocId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select area</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.areaname}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {isSectionMarkerForm || activeTab === "details" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                {effectiveMode === "edit-footer"
                  ? "Footer label (max 200 characters)"
                  : isSectionMarkerForm
                    ? "Section heading (max 200 characters)"
                    : "Scope question (max 200 characters)"}
              </span>
              <textarea
                required
                maxLength={200}
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className={inputClass}
                placeholder={
                  effectiveMode === "edit-footer"
                    ? "e.g. Footer"
                    : isSectionMarkerForm
                      ? "e.g. Appliances"
                      : "e.g. Full kitchen makeover?"
                }
              />
              <span className="mt-1 block text-xs text-sf-text-weak">{question.length}/200</span>
            </label>
            ) : null}

            {!isSectionMarkerForm && activeTab === "details" ? (
              <div className="space-y-3 rounded-lg border border-sf-border bg-sf-page/40 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-sf-text dark:text-zinc-200">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-sf-border-strong"
                    checked={systemScopeDraft}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSystemScopeDraft(checked);
                      if (!checked) stripSystemAttachmentsFromAnswers();
                    }}
                  />
                  <span>
                    <span className="font-medium">System scope</span>
                    <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                      Tag this scope for built-in system rules (e.g. blinds workflows).
                    </span>
                  </span>
                </label>
                {systemScopeDraft ? (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      System scope type
                    </span>
                    <select
                      required
                      value={systemScopeTypeDraft}
                      onChange={(e) => {
                        const next = e.target.value as SystemScopeType;
                        setSystemScopeTypeDraft(next);
                        pruneSystemAttachmentsForType(next);
                      }}
                      className={inputClass}
                    >
                      {SYSTEM_SCOPE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            {!isSectionMarkerForm && activeTab === "details" ? (
              <div className="space-y-3 rounded-lg border border-sf-border bg-sf-page/40 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-sf-text dark:text-zinc-200">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-sf-border-strong"
                    checked={exposeToolDraft}
                    onChange={(e) => setExposeToolDraft(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Expose tool</span>
                    <span className="mt-0.5 block text-xs text-sf-text-weak dark:text-zinc-400">
                      After a scope is answered on the checklist, show a calculator the user can open.
                    </span>
                  </span>
                </label>
                {exposeToolDraft ? (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
                      Tool
                    </span>
                    <select
                      required
                      value={scopeToolTypeDraft}
                      onChange={(e) => setScopeToolTypeDraft(e.target.value as ScopeToolType)}
                      className={inputClass}
                    >
                      {SCOPE_TOOL_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {scopeToolTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            {!isSectionMarkerForm && activeTab === "answers" ? (
              <ScopeMetricsEditor
                metrics={scopeMetricsDraft}
                answers={draftAnswers}
                onChange={setScopeMetricsDraft}
                disabled={saving}
                inputClassName={inputClass}
              />
            ) : null}

            {!isSectionMarkerForm && activeTab === "answers" ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(200px,260px)_1fr]">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">Answers</h3>
                    <button
                      type="button"
                      onClick={addAnswer}
                      className="shrink-0 rounded-lg border border-sf-border-strong px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
                    >
                      Add answer
                    </button>
                  </div>
                  {draftAnswers.length === 0 ? (
                    <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                      No answers yet. Add at least one option (e.g. Yes / No).
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {draftAnswers.map((a) => (
                        <li key={a.answerid}>
                          <div
                            className={`rounded-lg border p-2 ${
                              selectedAnswerId === a.answerid
                                ? "border-sf-text bg-sf-page dark:border-zinc-200 dark:bg-zinc-800/60"
                                : "border-sf-border dark:border-zinc-700"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedAnswerId(a.answerid)}
                              className="mb-2 w-full text-left text-sm font-medium text-sf-text dark:text-zinc-100"
                            >
                              {a.label || "(untitled)"}
                            </button>
                            <input
                              value={a.label}
                              onChange={(e) => updateAnswerLabel(a.answerid, e.target.value)}
                              onFocus={() => setSelectedAnswerId(a.answerid)}
                              className={`${inputClass} mb-2 min-h-10 py-2 text-sm`}
                              placeholder="Answer label"
                              maxLength={200}
                            />
                            <button
                              type="button"
                              onClick={() => setAnswerRemoveConfirmId(a.answerid)}
                              className="text-xs font-medium text-red-700 hover:underline dark:text-red-400"
                            >
                              Remove answer
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="mb-2 text-base font-semibold">Attached quote objects</h3>
                  <p className="mb-3 text-xs text-sf-text-weak dark:text-zinc-400">
                    Expand each object type (+/−), then multi-select quote objects. Drag selected
                    objects to set checklist order. Use Show All on an object to create one row per
                    matching SKU instead of a dropdown. Use No Charge to import the line at $0.
                    For each selected object you can attach a
                    calculator (e.g. benchtop m² on the benchtop). On the checklist, that icon
                    appears on the SKU row and can fill the measure field.
                    Every row from Setup → Quote Objects is listed.
                    {systemScopeDraft
                      ? ` With System scope on, attach ${systemScopeObjectId(systemScopeTypeDraft)} from the System group.`
                      : null}{" "}
                    Area tags on a quote object still apply at project runtime.
                  </p>
                  {!selectedAnswer ? (
                    <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                      Select an answer on the left to attach objects.
                    </p>
                  ) : quoteObjectsLoading ? (
                    <p className="text-sm text-sf-text-secondary dark:text-zinc-400">
                      Loading quote objects…
                    </p>
                  ) : (
                    <ScopeAnswerObjectPicker
                      quoteObjects={quoteObjects}
                      catalogSkus={catalogSkus}
                      scopeMetrics={scopeMetricsDraft}
                      answerid={selectedAnswer.answerid}
                      systemScopeType={systemScopeDraft ? systemScopeTypeDraft : null}
                      selectedIds={selectedAnswer.attachedQuoteObjectIds}
                      objectTools={selectedAnswer.attachedObjectTools}
                      objectShowAll={selectedAnswer.attachedObjectShowAll}
                      objectNoCharge={selectedAnswer.attachedObjectNoCharge}
                      objectForce={selectedAnswer.attachedObjectForce}
                      objectInheritM2Source={selectedAnswer.attachedObjectInheritM2Source}
                      objectInheritMeasureLocked={selectedAnswer.attachedObjectInheritMeasureLocked}
                      onChange={(ids) => setAnswerQuoteObjectIds(selectedAnswer.answerid, ids)}
                      onObjectToolsChange={(tools) =>
                        setAnswerObjectTools(selectedAnswer.answerid, tools)
                      }
                      onObjectShowAllChange={(showAll) =>
                        setAnswerObjectShowAll(selectedAnswer.answerid, showAll)
                      }
                      onObjectNoChargeChange={(noCharge) =>
                        setAnswerObjectNoCharge(selectedAnswer.answerid, noCharge)
                      }
                      onObjectForceChange={(force) =>
                        setAnswerObjectForce(selectedAnswer.answerid, force)
                      }
                      onObjectInheritM2SourceChange={(inheritM2Source) =>
                        setAnswerObjectInheritM2Source(selectedAnswer.answerid, inheritM2Source)
                      }
                      onObjectInheritMeasureLockedChange={(inheritMeasureLocked) =>
                        setAnswerObjectInheritMeasureLocked(
                          selectedAnswer.answerid,
                          inheritMeasureLocked,
                        )
                      }
                      disabled={saving}
                      inputClassName={inputClass}
                    />
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-sf-border pt-4 dark:border-zinc-700">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-lg border border-sf-border-strong px-4 py-2.5 text-sm font-medium dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveDisabled}
                className="min-h-11 rounded-lg bg-sf-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(answerRemoveConfirmId)}
        title="Remove this answer?"
        description={
          pendingRemoveAnswerLabel
            ? `Removing “${pendingRemoveAnswerLabel}” deletes its attached category links in this editor. After you save, projects that had this answer selected may lose scope-linked lines or show an empty choice until you pick another answer. This cannot be undone from the project side automatically.`
            : "Removing this answer deletes its attached category links. After you save, projects that used this answer may be affected. This cannot be undone automatically."
        }
        confirmLabel="Remove answer"
        cancelLabel="Cancel"
        variant="danger"
        pending={false}
        onCancel={() => setAnswerRemoveConfirmId(null)}
        onConfirm={() => {
          if (answerRemoveConfirmId) removeAnswer(answerRemoveConfirmId);
        }}
      />
    </>
  );
}

export function scopeFormModeForScope(scope: ScopePublic): ScopeFormMode {
  if (scope.kind === "header") return "edit-header";
  if (scope.kind === "footer") return "edit-footer";
  return "edit";
}
