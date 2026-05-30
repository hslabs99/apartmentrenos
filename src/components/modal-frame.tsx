"use client";

export function ModalFrame({
  title,
  description,
  children,
  footer,
  onClose,
  wide,
  panelClassName,
  contentClassName,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  /** Extra classes on the dialog panel (e.g. larger supplier popup). */
  panelClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-frame-title"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-lg border border-sf-border bg-sf-surface shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-lg ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        } ${panelClassName ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-sf-border px-5 py-4 dark:border-zinc-700">
          <h2 id="modal-frame-title" className="text-lg font-semibold md:text-xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-sf-text-secondary dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 ${contentClassName ?? ""}`}>
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-sf-border px-5 py-4 dark:border-zinc-700 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
