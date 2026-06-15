"use client";

import { CascadeElevateSelect } from "@/components/cascade-elevate-select";
import { CascadeStyleColourFields } from "@/components/cascade-style-colour-fields";
import { useCascades } from "@/lib/client/use-cascades";
import { usePriceLevels } from "@/lib/client/use-price-levels";
import { cascadeLevelFromPriceLevel } from "@/lib/cascades/cascade-level-from-price-level";

type Props = {
  priceLevelId: number | null;
  onPriceLevelIdChange: (id: number | null) => void;
  projectFinish?: string;
  onProjectFinishChange?: (value: string) => void;
  style: string;
  colour: string;
  onStyleChange: (value: string) => void;
  onColourChange: (value: string) => void;
  priceLevelClassName: string;
  cascadeSelectClassName: string;
  priceLevelRequired?: boolean;
  disabled?: boolean;
  showPriceLevelHint?: boolean;
  showCascadeHint?: boolean;
};

export function ProjectDefaultTierFields({
  priceLevelId,
  onPriceLevelIdChange,
  projectFinish = "",
  onProjectFinishChange,
  style,
  colour,
  onStyleChange,
  onColourChange,
  priceLevelClassName,
  cascadeSelectClassName,
  priceLevelRequired = false,
  disabled = false,
  showPriceLevelHint = true,
  showCascadeHint = true,
}: Props) {
  const { levels: priceLevels, loading: priceLevelsLoading } = usePriceLevels();
  const { cascades } = useCascades();

  const cascadeLevel = cascadeLevelFromPriceLevel(
    priceLevels,
    priceLevelId,
    projectFinish,
    cascades,
  );

  function handleElevateChange(next: { priceLevelId: number | null; projectFinish: string }) {
    onPriceLevelIdChange(next.priceLevelId);
    onProjectFinishChange?.(next.projectFinish);
    onStyleChange("");
    onColourChange("");
  }

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-sf-text-secondary dark:text-zinc-300">
          Default price level
          {priceLevelRequired ? (
            <span className="ml-1 text-red-600 dark:text-red-400">*</span>
          ) : null}
        </span>
        <CascadeElevateSelect
          cascades={cascades}
          priceLevels={priceLevels}
          priceLevelId={priceLevelId}
          projectFinish={projectFinish}
          onChange={handleElevateChange}
          className={priceLevelClassName}
          disabled={disabled || priceLevelsLoading}
          emptyLabel={priceLevelRequired ? "Select tier (required)" : "Not set"}
        />
        {showPriceLevelHint ? (
          <span className="mt-1 block text-xs text-sf-text-weak dark:text-zinc-400">
            Used for scope answers and line pricing when an area uses the project default tier.
            {priceLevelRequired ? " Required when creating a project." : ""}
          </span>
        ) : null}
        {!priceLevelsLoading && priceLevels.length === 0 ? (
          <span className="mt-1 block text-xs text-amber-800 dark:text-amber-200">
            No price levels yet. Add one under System → Price Levels, then create a project.
          </span>
        ) : null}
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <CascadeStyleColourFields
          cascades={cascades}
          level={cascadeLevel}
          style={style}
          colour={colour}
          disabled={disabled || priceLevelId == null}
          selectClassName={cascadeSelectClassName}
          styleEmptyLabel="Not set"
          colourEmptyLabel="Not set"
          onStyleChange={(v) => {
            onStyleChange(v);
            onColourChange("");
          }}
          onColourChange={onColourChange}
        />
        {showCascadeHint ? (
          <span className="text-xs text-sf-text-weak dark:text-zinc-400">
            Style and colour options come from Cascades (Import). Choose a price level first.
          </span>
        ) : null}
      </div>
    </>
  );
}
