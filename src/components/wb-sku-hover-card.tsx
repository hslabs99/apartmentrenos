"use client";

import type { ScopeLineSkuPick } from "@/lib/client/scope-line-sku-match";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const HIDE_DELAY_MS = 400;

function productHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return `https://${t}`;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value.trim()) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm leading-snug text-sf-text dark:text-zinc-100">{value}</dd>
    </div>
  );
}

/**
 * Workbench SKU hover card: supplier details + clickable product URL.
 * Stays open briefly after mouse leave so the pointer can reach the link.
 */
export function WbSkuHoverCard({
  pick,
  objectType,
  children,
}: {
  pick: ScopeLineSkuPick | null | undefined;
  objectType: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(
    null,
  );
  const panelId = useId();

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(28 * 16, window.innerWidth - 24);
    const gap = 8;
    // Start at the SKU midpoint so the left half stays clear.
    let left = rect.left + rect.width * 0.5;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    if (left < 12) left = 12;
    const estimatedHeight = 280;
    if (rect.top + estimatedHeight > window.innerHeight - 12) {
      setCoords({ left, bottom: Math.max(12, window.innerHeight - rect.bottom) });
    } else {
      setCoords({ left, top: rect.top + gap });
    }
  }, []);

  const show = useCallback(() => {
    if (!pick) return;
    clearHideTimer();
    updatePosition();
    setOpen(true);
  }, [pick, clearHideTimer, updatePosition]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setOpen(false);
      hideTimer.current = null;
    }, HIDE_DELAY_MS);
  }, [clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    }
  }, [open, updatePosition]);

  if (!pick) return <>{children}</>;

  const type = objectType.trim();
  const description = pick.product.trim();
  const supplier = pick.supplier.trim();
  const model = pick.model.trim();
  const supplierSku = pick.supplierSku.trim();
  const linkText = pick.link.trim();
  const href = productHref(linkText);

  const card =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            id={panelId}
            role="tooltip"
            className="fixed z-[80] w-[28rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-sf-border bg-sf-surface p-4 shadow-xl shadow-black/20 dark:border-zinc-600 dark:bg-zinc-900"
            style={{
              left: coords.left,
              top: coords.top,
              bottom: coords.bottom,
            }}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
          >
            <dl className="space-y-3">
              <Detail label="Object type" value={type} />
              <Detail label="Description" value={description} />
              <Detail label="Supplier" value={supplier} />
              <Detail label="Model" value={model} />
              <Detail label="Supplier SKU" value={supplierSku} />
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-sf-text-weak dark:text-zinc-400">
                  Product URL
                </dt>
                <dd className="mt-1">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all rounded-md border border-sf-border bg-sf-page px-3 py-2 text-sm font-medium leading-snug text-sf-brand underline-offset-2 hover:bg-sf-accent-muted hover:underline dark:border-zinc-600 dark:bg-zinc-950 dark:text-[#58a9f5]"
                    >
                      {linkText}
                    </a>
                  ) : (
                    <span className="text-sm text-sf-text-weak dark:text-zinc-400">No URL</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={triggerRef}
      className="relative flex h-full min-w-0 flex-1 items-stretch"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      {children}
      {card}
    </div>
  );
}
