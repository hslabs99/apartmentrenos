"use client";

type Props = {
  label: string;
  inputClassName: string;
};

/** Checklist SKU column for Labour lines — product name from labour rates, not a catalog SKU. */
export function ClLabourProductDisplay({ label, inputClassName }: Props) {
  return (
    <div
      className={`${inputClassName} flex h-full items-center bg-sf-page dark:bg-zinc-900`}
      title={label}
    >
      {label || "—"}
    </div>
  );
}
