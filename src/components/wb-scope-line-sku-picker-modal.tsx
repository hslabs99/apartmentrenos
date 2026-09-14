"use client";

import { ModalFrame } from "@/components/modal-frame";
import { formatMoney } from "@/lib/client/format-money";
import {
  encodeScopeLineSkuPickValue,
  SCOPE_LINE_SKU_SPEC_ALL,
  scopeLineSkuPickDescriptionLabel,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";
import { formatAppendSlotsSummary } from "@/lib/sku/data-sku-append-slots";

type Props = {
  open: boolean;
  picks: ScopeLineSkuPick[];
  selectedValue: string;
  objectLabel: string;
  /** Quote object category (e.g. Appliances). */
  objectCategory?: string;
  specOptions?: string[];
  specFilter?: string;
  onSpecFilterChange?: (spec: string) => void;
  pickTitle?: (pick: ScopeLineSkuPick) => string;
  showAddBlankLineOption?: boolean;
  /** When set, show the “Show all priorities” control in the modal. */
  showAllPriorities?: boolean;
  onShowAllPrioritiesChange?: (checked: boolean) => void;
  showShowAllPrioritiesCheckbox?: boolean;
  onClose: () => void;
  onPick: (pick: ScopeLineSkuPick) => void;
  onAddBlankLine?: () => void;
};

function priceLabel(pick: ScopeLineSkuPick): string {
  if (pick.priceExcGst == null) return "—";
  const base = `$${formatMoney(pick.priceExcGst)} ex GST`;
  if (pick.discountPctApplied != null && pick.discountPctApplied > 0) {
    return `${base} (−${pick.discountPctApplied}%)`;
  }
  return base;
}

export function WbScopeLineSkuPickerModal({
  open,
  picks,
  selectedValue,
  objectLabel,
  objectCategory = "",
  specOptions = [],
  specFilter = SCOPE_LINE_SKU_SPEC_ALL,
  onSpecFilterChange,
  pickTitle,
  showAddBlankLineOption = false,
  showAllPriorities = false,
  onShowAllPrioritiesChange,
  showShowAllPrioritiesCheckbox = false,
  onClose,
  onPick,
  onAddBlankLine,
}: Props) {
  if (!open) return null;

  const specIsAll = specFilter.trim() === SCOPE_LINE_SKU_SPEC_ALL;
  const showSpecFilter = specOptions.length > 0 && Boolean(onSpecFilterChange);
  const defaultModeHint = specIsAll
    ? `Best available priority per ${objectLabel || "matching"} specification (P1, else P2…).`
    : "Best available priority for this specification (P1, else P2…).";
  const allModeHint = specIsAll
    ? `All supplier priorities across every ${objectLabel || "matching"} specification.`
    : "All supplier priorities for this specification (P1, P2, P3…).";
  const scopeHint = specIsAll
    ? `All ${objectLabel || "object"} specifications`
    : specFilter.trim();

  return (
    <ModalFrame
      title="Select SKU"
      onClose={onClose}
      wide
      panelClassName="sm:max-w-3xl"
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showAddBlankLineOption && onAddBlankLine ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddBlankLine();
              }}
              className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium text-sf-brand hover:bg-sf-page dark:border-zinc-600 dark:text-emerald-400 dark:hover:bg-zinc-800"
            >
              Add Manual Row
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium dark:border-zinc-600"
          >
            Cancel
          </button>
        </div>
      }
    >
      <div className="mb-3 rounded-lg border border-sf-border bg-sf-page px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/50">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
          Object
        </p>
        <p className="mt-0.5 text-lg font-semibold leading-tight text-sf-text dark:text-zinc-50">
          {objectLabel || "—"}
        </p>
        {objectCategory ? (
          <p className="mt-0.5 text-sm text-sf-text-secondary dark:text-zinc-400">
            {objectCategory}
          </p>
        ) : null}
        <p className="mt-1.5 text-xs text-sf-text-secondary dark:text-zinc-400">
          {scopeHint} · {picks.length} option{picks.length === 1 ? "" : "s"}
        </p>
      </div>

      {showSpecFilter || showShowAllPrioritiesCheckbox ? (
        <div className="mb-3 space-y-3 rounded-lg border border-sf-border bg-sf-page px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/50">
          {showSpecFilter ? (
            <label className="block min-w-0">
              <span className="block text-sm font-medium text-sf-text dark:text-zinc-100">
                Specification
              </span>
              <select
                className="mt-1.5 min-h-10 w-full rounded-md border border-sf-border-strong bg-sf-surface px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={specFilter}
                onChange={(e) => onSpecFilterChange?.(e.target.value)}
              >
                <option value={SCOPE_LINE_SKU_SPEC_ALL}>
                  All {objectLabel || "specifications"}
                </option>
                {specOptions.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showShowAllPrioritiesCheckbox ? (
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-sf-border-strong"
                checked={showAllPriorities}
                onChange={(e) => onShowAllPrioritiesChange?.(e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-sf-text dark:text-zinc-100">
                  Show all priorities
                </span>
                <span className="mt-0.5 block text-xs text-sf-text-secondary dark:text-zinc-400">
                  {showAllPriorities ? allModeHint : defaultModeHint}
                </span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
      <ul className="divide-y divide-sf-border dark:divide-zinc-700">
        {picks.map((pick) => {
          const value = encodeScopeLineSkuPickValue(pick.skuId, pick.supplierOption);
          const selected = value === selectedValue;
          const description = scopeLineSkuPickDescriptionLabel(pick);
          const supplierName = pick.supplier.trim() || "—";
          const supplierSku = pick.supplierSku.trim();
          const model = pick.model.trim();
          const appendSummary = formatAppendSlotsSummary(pick.appendSlots ?? []);
          return (
            <li key={value}>
              <div
                role="button"
                tabIndex={0}
                title={pickTitle?.(pick)}
                onClick={() => {
                  onPick(pick);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(pick);
                    onClose();
                  }
                }}
                className={`flex w-full cursor-pointer flex-col gap-1.5 px-3 py-3 text-left transition-colors hover:bg-sf-page dark:hover:bg-zinc-800/80 ${
                  selected
                    ? "bg-teal-50 ring-1 ring-inset ring-teal-600/30 dark:bg-teal-950/40 dark:ring-teal-400/30"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-sf-text dark:text-zinc-100">
                    {supplierName}{" "}
                    <span className="font-medium text-sf-text-secondary dark:text-zinc-400">
                      (P{pick.supplierOption})
                    </span>
                    {appendSummary ? (
                      <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
                        Append
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-sm font-medium text-teal-900 dark:text-teal-200">
                    {priceLabel(pick)}
                  </span>
                </div>
                <p className="text-sm text-sf-text dark:text-zinc-200">
                  {model || "—"}
                </p>
                <p
                  className={
                    appendSummary
                      ? "rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
                      : "text-xs text-sf-text-secondary dark:text-zinc-400"
                  }
                >
                  {appendSummary
                    ? `This priority also adds: ${appendSummary}`
                    : "This priority has no append"}
                </p>
                {supplierSku ? (
                  <p className="text-xs text-sf-text-secondary dark:text-zinc-400">
                    Supplier SKU: {supplierSku}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sf-text-secondary dark:text-zinc-400">
                  <span className="min-w-0 truncate">{description}</span>
                  {pick.link ? (
                    <a
                      href={pick.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-medium text-sf-brand underline-offset-2 hover:underline dark:text-[#58a9f5]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open URL
                    </a>
                  ) : (
                    <span className="shrink-0">No URL</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </ModalFrame>
  );
}
