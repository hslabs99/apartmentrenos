"use client";

import { ModalFrame } from "@/components/modal-frame";
import { ProjectDefaultTierFields } from "@/components/project-default-tier-fields";
import { usePriceLevels } from "@/lib/client/use-price-levels";
import { projectfinishForPriceLevelId } from "@/lib/cascades/cascade-level-from-price-level";
import { useCascades } from "@/lib/client/use-cascades";
import type { ProjectListItem } from "@/types/project";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

async function readApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  const text = await res.text();
  throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
}

type NewProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export function NewProjectDialog({ open, onClose, onCreated }: NewProjectDialogProps) {
  const router = useRouter();
  const { levels: priceLevels, loading: priceLevelsLoading } = usePriceLevels();
  const { cascades } = useCascades();
  const [projectname, setProjectname] = useState("");
  const [projectdescription, setProjectdescription] = useState("");
  const [projectm2Str, setProjectm2Str] = useState("");
  const [templateDocId, setTemplateDocId] = useState("");
  const [templates, setTemplates] = useState<ProjectListItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [defaultPriceLevelId, setDefaultPriceLevelId] = useState<number | null>(null);
  const [defaultProjectFinish, setDefaultProjectFinish] = useState("");
  const [defaultStyle, setDefaultStyle] = useState("");
  const [defaultColour, setDefaultColour] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setProjectname("");
    setProjectdescription("");
    setProjectm2Str("");
    setTemplateDocId("");
    setDefaultPriceLevelId(null);
    setDefaultProjectFinish("");
    setDefaultStyle("");
    setDefaultColour("");
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTemplatesLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/projects?template=true");
        const data = await readApiResponse<{ projects?: ProjectListItem[]; error?: string }>(res);
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load templates");
        setTemplates(data.projects ?? []);
      } catch {
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleClose() {
    if (!saving) {
      reset();
      onClose();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!priceLevelsLoading && priceLevels.length === 0) {
        throw new Error(
          "Add at least one price level under System → Price Levels before creating a project.",
        );
      }
      if (defaultPriceLevelId == null) {
        setError(
          "Select a default price level. It is saved on the project and used for scope-linked lines when an area does not set its own tier.",
        );
        setSaving(false);
        return;
      }
      const m2t = projectm2Str.trim();
      let projectm2: number | null = null;
      if (m2t) {
        const n = Number(m2t);
        if (!Number.isFinite(n)) throw new Error("m² must be a valid number");
        projectm2 = n;
      }
      const finish =
        defaultProjectFinish.trim() ||
        projectfinishForPriceLevelId(priceLevels, defaultPriceLevelId, cascades);
      const overlay = {
        projectdescription: projectdescription.trim(),
        projectm2,
        defaultpricelevelid: defaultPriceLevelId,
        projectfinish: finish,
        defaultstyle: defaultStyle.trim(),
        defaultcolour: defaultColour.trim(),
      };

      const res = templateDocId
        ? await fetch(`/api/projects/${encodeURIComponent(templateDocId)}/clone`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectname: projectname.trim(),
              template: false,
              overlay,
            }),
          })
        : await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectname: projectname.trim(),
              ...overlay,
            }),
          });
      const data = await readApiResponse<{
        id?: string;
        error?: string;
      }>(res);
      if (!res.ok || !data.id) throw new Error(data.error ?? "Create failed");
      reset();
      onClose();
      onCreated?.();
      router.push(`/projects/project?id=${encodeURIComponent(data.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const inputClass =
    "min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950";

  return (
    <ModalFrame
      title="New project"
      description="Name, default price tier, style, colour, description, and total m². Optionally seed from a template (full copy). Other fields can be edited on the project screen."
      onClose={handleClose}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium disabled:opacity-50 dark:border-zinc-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-project-form"
            disabled={saving || priceLevelsLoading || priceLevels.length === 0}
            className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Seed from template
          </span>
          <select
            value={templateDocId}
            onChange={(e) => setTemplateDocId(e.target.value)}
            disabled={saving || templatesLoading}
            className={inputClass}
          >
            <option value="">None — blank project</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.projectname}
              </option>
            ))}
          </select>
          {templatesLoading ? (
            <span className="mt-1 block text-xs text-sf-text-weak">Loading templates…</span>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            Project name
          </span>
          <input
            required
            value={projectname}
            onChange={(e) => setProjectname(e.target.value)}
            className={inputClass}
            autoFocus
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
          priceLevelRequired
          disabled={saving}
        />
        <label className="block">
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
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
            m² (total)
          </span>
          <input
            value={projectm2Str}
            onChange={(e) => setProjectm2Str(e.target.value)}
            inputMode="decimal"
            placeholder="Optional"
            className={inputClass}
          />
        </label>
      </form>
    </ModalFrame>
  );
}
