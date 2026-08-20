"use client";

import { ModalFrame } from "@/components/modal-frame";
import { formatMoney } from "@/lib/client/format-money";
import {
  encodeScopeLineSkuPickValue,
  scopeLineSkuPickDescriptionLabel,
  type ScopeLineSkuPick,
} from "@/lib/client/scope-line-sku-match";

type Props = {
  open: boolean;
  picks: ScopeLineSkuPick[];
  selectedValue: string;
  objectLabel: string;
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

  const defaultModeHint =
    "Default list: best available priority per matching SKU (P1, else P2…).";
  const allModeHint = "Showing all matching supplier priorities (P1, P2, P3…).";

  return (
    <ModalFrame
      title="Select SKU"
      description={`Matching catalog options for “${objectLabel}” (${picks.length}).`}
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
      {showShowAllPrioritiesCheckbox ? (
        <div className="mb-3 rounded-lg border border-sf-border bg-sf-page px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/50">
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
                  </span>
                  <span className="tabular-nums text-sm font-medium text-teal-900 dark:text-teal-200">
                    {priceLabel(pick)}
                  </span>
                </div>
                <p className="text-sm text-sf-text dark:text-zinc-200">
                  {model || "—"}
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
