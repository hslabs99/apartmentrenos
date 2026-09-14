"use client";

import { ModalFrame } from "@/components/modal-frame";
import { useEffect, useState } from "react";

type CloneProjectDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  defaultName: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (projectname: string) => void;
};

export function CloneProjectDialog({
  open,
  title,
  description,
  confirmLabel,
  defaultName,
  saving,
  error,
  onClose,
  onConfirm,
}: CloneProjectDialogProps) {
  const [projectname, setProjectname] = useState(defaultName);

  useEffect(() => {
    if (open) setProjectname(defaultName);
  }, [open, defaultName]);

  if (!open) return null;

  return (
    <ModalFrame
      title={title}
      description={description}
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-12 rounded-lg border border-sf-border-strong px-4 py-3 text-base font-medium disabled:opacity-50 dark:border-zinc-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="clone-project-form"
            disabled={saving || !projectname.trim()}
            className="min-h-12 rounded-lg bg-sf-brand px-5 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {saving ? "Copying…" : confirmLabel}
          </button>
        </>
      }
    >
      <form
        id="clone-project-form"
        onSubmit={(e) => {
          e.preventDefault();
          const name = projectname.trim();
          if (!name || saving) return;
          onConfirm(name);
        }}
        className="space-y-4"
      >
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
            New name
          </span>
          <input
            required
            value={projectname}
            onChange={(e) => setProjectname(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-sf-border-strong bg-sf-surface px-3 py-2.5 text-base dark:border-zinc-600 dark:bg-zinc-950"
            autoFocus
          />
        </label>
      </form>
    </ModalFrame>
  );
}
