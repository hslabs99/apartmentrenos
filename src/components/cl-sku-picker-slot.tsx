"use client";

import type { ReactNode } from "react";
import {
  clAdditionalPromptBtnClass,
  clSkuFieldLabelClass,
  clSkuLabelRowClass,
  clSkuPickerWrapClass,
} from "@/components/cl-checklist-layout";

type Props = {
  showAdditionalPrompt: boolean;
  additionalObjectName: string;
  additionalDisabled?: boolean;
  onAdditional?: () => void;
  children: ReactNode;
};

/** Checklist SKU control; promptForMulti label sits top-right, picker stays full width. */
export function ClSkuPickerSlot({
  showAdditionalPrompt,
  additionalObjectName,
  additionalDisabled,
  onAdditional,
  children,
}: Props) {
  const label = `+ Additional ${additionalObjectName}`.trim();
  return (
    <>
      <div className={clSkuLabelRowClass}>
        <span className={clSkuFieldLabelClass}>SKU</span>
        {showAdditionalPrompt ? (
          <button
            type="button"
            className={clAdditionalPromptBtnClass}
            disabled={additionalDisabled}
            title={label}
            aria-label={label}
            onClick={onAdditional}
          >
            {label}
          </button>
        ) : null}
      </div>
      <div className={clSkuPickerWrapClass}>{children}</div>
    </>
  );
}
