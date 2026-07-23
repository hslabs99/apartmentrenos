"use client";

import { CascadeElevateSelect } from "@/components/cascade-elevate-select";
import {
  CascadeColourSelect,
  CascadeStyleColourFields,
} from "@/components/cascade-style-colour-fields";
import { clActionBtnActiveClass, clActionBtnClass } from "@/components/cl-checklist-layout";
import { ModalFrame } from "@/components/modal-frame";
import { cascadeLevelFromPriceLevel } from "@/lib/cascades/cascade-level-from-price-level";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import type { PriceLevelPublic } from "@/types/price-level";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import { useEffect, useState } from "react";

export const CL_CLEAR_TIER_STYLE_COLOUR = {
  pricelevelid: null,
  style: null,
  colour: null,
} as const;

export function hasClNonStandardTierStyleColour(entity: {
  pricelevelid?: number | null;
  style?: string | null;
  colour?: string | null;
}): boolean {
  return (
    entity.pricelevelid != null ||
    Boolean(entity.style?.trim()) ||
    Boolean(entity.colour?.trim())
  );
}

const selectClass =
  "min-h-11 w-full rounded border border-sf-border-strong bg-sf-surface px-2 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400/60 dark:border-zinc-600 dark:bg-zinc-950";

type TierDraft = {
  pricelevelid: number | null;
  style: string;
  colour: string;
};

function draftFromEntity(entity: {
  pricelevelid?: number | null;
  style?: string | null;
  colour?: string | null;
}): TierDraft {
  return {
    pricelevelid: entity.pricelevelid ?? null,
    style: entity.style?.trim() ?? "",
    colour: entity.colour?.trim() ?? "",
  };
}

function draftToPatch(draft: TierDraft): Record<string, unknown> {
  const hasOverride =
    draft.pricelevelid != null ||
    Boolean(draft.style.trim()) ||
    Boolean(draft.colour.trim());
  if (!hasOverride) return { ...CL_CLEAR_TIER_STYLE_COLOUR };
  return {
    pricelevelid: draft.pricelevelid,
    style: draft.style.trim() ? draft.style.trim() : null,
    colour: draft.colour.trim() ? draft.colour.trim() : null,
  };
}

export type ClNonStdModalTarget =
  | { kind: "area"; paId: string; label: string }
  | { kind: "line"; lineId: string; label: string };

function priceLevelLabel(
  priceLevels: PriceLevelPublic[],
  pricelevelid: number | null | undefined,
): string {
  if (pricelevelid == null) return "—";
  const hit = priceLevels.find((l) => l.pricelevelid === pricelevelid);
  return hit?.pricelevel?.trim() || `#${pricelevelid}`;
}

function inheritedPriceLevelId(
  target: ClNonStdModalTarget,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): number | null {
  if (target.kind === "area") return project?.defaultpricelevelid ?? null;
  return pa.pricelevelid ?? project?.defaultpricelevelid ?? null;
}

function inheritedStyle(
  target: ClNonStdModalTarget,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string {
  if (target.kind === "area") {
    return project?.defaultstyle?.trim() || "—";
  }
  return pa.style?.trim() || project?.defaultstyle?.trim() || "—";
}

function inheritedColour(
  target: ClNonStdModalTarget,
  pa: ProjectAreaPublic,
  project: ProjectPublic | null,
): string {
  if (target.kind === "area") {
    return project?.defaultcolour?.trim() || "—";
  }
  return pa.colour?.trim() || project?.defaultcolour?.trim() || "—";
}

type ClNonStdTierOpenButtonProps = {
  active: boolean;
  disabled?: boolean;
  label: string;
  onOpen: () => void;
  compact?: boolean;
};

/** Checklist row control — opens Non Std popup (no inline tier/style/colour). */
export function ClNonStdTierOpenButton({
  active,
  disabled = false,
  label,
  onOpen,
  compact = false,
}: ClNonStdTierOpenButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={
        active
          ? `${label}: non-standard Elevate, Style, or Colour set`
          : `${label}: use default Elevate, Style, and Colour`
      }
      aria-label={`Non-standard finishes for ${label}`}
      onClick={onOpen}
      className={
        active
          ? `h-8 whitespace-nowrap rounded-md border border-sf-accent bg-sf-accent/80 px-3 text-xs font-semibold text-white transition-colors hover:bg-sf-accent disabled:opacity-50 ${compact ? "w-full" : ""}`
          : `${clActionBtnClass} ${compact ? "w-full" : ""}`
      }
    >
      Non Std{active ? " · on" : ""}
    </button>
  );
}

type ClNonStdTierModalProps = {
  target: ClNonStdModalTarget;
  pa: ProjectAreaPublic;
  line: ProjectAreaObjectPublic | null;
  project: ProjectPublic | null;
  cascades: CascadeRow[];
  priceLevels: PriceLevelPublic[];
  styleOptions: string[];
  styleOptionsSeen: Set<string>;
  disabled?: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => void | Promise<void>;
};

export function ClNonStdTierModal({
  target,
  pa,
  line,
  project,
  cascades,
  priceLevels,
  styleOptions,
  styleOptionsSeen,
  disabled = false,
  onClose,
  onSave,
}: ClNonStdTierModalProps) {
  const entity = target.kind === "area" ? pa : line!;
  const [draft, setDraft] = useState<TierDraft>(() => draftFromEntity(entity));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(draftFromEntity(entity));
  }, [entity.id, entity.pricelevelid, entity.style, entity.colour, target.kind]);

  const defaultPriceLevelId = inheritedPriceLevelId(target, pa, project);
  const defaultElevateLabel = priceLevelLabel(priceLevels, defaultPriceLevelId);
  const defaultStyleLabel = inheritedStyle(target, pa, project);
  const defaultColourLabel = inheritedColour(target, pa, project);

  const effectiveStyle =
    draft.style.trim() ||
    (defaultStyleLabel !== "—" ? defaultStyleLabel : "");

  const cascadeLevel = cascadeLevelFromPriceLevel(
    priceLevels,
    draft.pricelevelid ?? defaultPriceLevelId,
    project?.projectfinish,
    cascades,
  );

  const elevateEmptyLabel =
    target.kind === "area"
      ? `Default (project · ${defaultElevateLabel})`
      : `Default (area · ${defaultElevateLabel})`;

  const styleDefaultLabel =
    target.kind === "area"
      ? `Default (project · ${defaultStyleLabel})`
      : `Default (area · ${defaultStyleLabel})`;

  const colourEmptyLabel =
    target.kind === "area"
      ? `Default (project · ${defaultColourLabel})`
      : defaultColourLabel !== "—"
        ? `Default (area · ${defaultColourLabel})`
        : "Default (area)";

  const defaultsSource =
    target.kind === "area" ? "project header" : "area or project header";

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draftToPatch(draft));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      title="Non-standard finishes"
      description={target.label}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-sf-border px-4 py-2 text-sm font-medium text-sf-text hover:bg-sf-page dark:border-zinc-600 dark:hover:bg-zinc-800"
            disabled={saving || disabled}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-sf-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            disabled={saving || disabled}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-sf-border bg-sf-page px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
            Inherited defaults
          </p>
          <p className="mt-0.5 text-xs text-sf-text-weak dark:text-zinc-500">
            From {defaultsSource}. Leave a field on its default option to keep inheriting.
          </p>
          <dl className="mt-2.5 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                Elevate
              </dt>
              <dd className="font-medium text-sf-text dark:text-zinc-100">{defaultElevateLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                Style
              </dt>
              <dd className="font-medium text-sf-text dark:text-zinc-100">{defaultStyleLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-sf-text-secondary dark:text-zinc-400">
                Colour
              </dt>
              <dd className="font-medium text-sf-text dark:text-zinc-100">{defaultColourLabel}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
              Elevate
            </span>
            <CascadeElevateSelect
              cascades={cascades}
              priceLevels={priceLevels}
              priceLevelId={draft.pricelevelid}
              projectFinish={project?.projectfinish}
              onChange={({ priceLevelId }) =>
                setDraft((prev) => ({ ...prev, pricelevelid: priceLevelId }))
              }
              className={selectClass}
              disabled={disabled || saving}
              emptyLabel={elevateEmptyLabel}
            />
          </label>

          {target.kind === "area" ? (
              <>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                    Style
                  </span>
                  <CascadeStyleColourFields
                    cascades={cascades}
                    level={cascadeLevel}
                    style={draft.style}
                    colourFilterStyle={effectiveStyle}
                    colour={draft.colour}
                    disabled={disabled || saving}
                    selectClassName={selectClass}
                    styleSelectClassName={selectClass}
                    colourSelectClassName={selectClass}
                    layout="compact"
                    compactField="style"
                    suppressLabel
                    styleEmptyLabel={styleDefaultLabel}
                    colourEmptyLabel={colourEmptyLabel}
                    onStyleChange={(v) =>
                      setDraft((prev) => ({ ...prev, style: v, colour: "" }))
                    }
                    onColourChange={(v) => setDraft((prev) => ({ ...prev, colour: v }))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                    Colour
                  </span>
                  <CascadeStyleColourFields
                    cascades={cascades}
                    level={cascadeLevel}
                    style={draft.style}
                    colourFilterStyle={effectiveStyle}
                    colour={draft.colour}
                    disabled={disabled || saving}
                    selectClassName={selectClass}
                    styleSelectClassName={selectClass}
                    colourSelectClassName={selectClass}
                    layout="compact"
                    compactField="colour"
                    suppressLabel
                    styleEmptyLabel={styleDefaultLabel}
                    colourEmptyLabel={colourEmptyLabel}
                    onStyleChange={(v) =>
                      setDraft((prev) => ({ ...prev, style: v, colour: "" }))
                    }
                    onColourChange={(v) => setDraft((prev) => ({ ...prev, colour: v }))}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                    Style
                  </span>
                  <select
                    className={selectClass}
                    disabled={disabled || saving}
                    value={draft.style}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, style: e.target.value, colour: "" }))
                    }
                  >
                    <option value="">{styleDefaultLabel}</option>
                    {styleOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    {(() => {
                      const saved = draft.style.trim();
                      if (!saved || styleOptionsSeen.has(saved)) return null;
                      return <option value={saved}>{saved} (saved)</option>;
                    })()}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary dark:text-zinc-400">
                    Colour
                  </span>
                  <CascadeColourSelect
                    cascades={cascades}
                    level={cascadeLevel}
                    styleForFilter={effectiveStyle}
                    colour={draft.colour}
                    disabled={disabled || saving}
                    selectClassName={selectClass}
                    emptyLabel={colourEmptyLabel}
                    layout="compact"
                    suppressLabel
                    onColourChange={(v) => setDraft((prev) => ({ ...prev, colour: v }))}
                  />
                </label>
              </>
            )}
        </div>
      </div>
    </ModalFrame>
  );
}
