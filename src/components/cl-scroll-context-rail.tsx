"use client";

import {
  clScrollContextRailAccentBarClass,
  clScrollContextRailAreaLabelClass,
  clScrollContextRailAreaNameClass,
  clScrollContextRailClass,
  clScrollContextRailDividerClass,
  clScrollContextRailJumpSelectClass,
  clScrollContextRailMoneyClass,
  clScrollContextRailSectionClass,
  clScrollContextRailSectionLabelClass,
} from "@/components/cl-checklist-layout";
import type { ChecklistHealthIssue } from "@/lib/client/checklist-project-health";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type ClScrollContextArea = {
  id: string;
  name: string;
  totalLabel: string;
};

type Props = {
  areas: readonly ClScrollContextArea[];
  projectTotalLabel: string;
  healthIssues?: readonly ChecklistHealthIssue[];
};

type RailPos = { left: number; top: number };

const STORAGE_KEY = "apartmentrenos.clScrollContextRailPos";
const JUMP_TO_TOP = "__top__";

/** Checklist area header id — used by Jump to Area nav and the floating totals dropdown. */
export function clAreaAnchorId(projectAreaDocId: string): string {
  return `cl-area-${projectAreaDocId}`;
}

/** Checklist / workbench line id — health check deep-links to orphaned SKU rows. */
export function clLineAnchorId(lineId: string): string {
  return `cl-line-${lineId}`;
}

function jumpToClTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (window.location.hash) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

function jumpToClArea(projectAreaDocId: string) {
  if (projectAreaDocId === JUMP_TO_TOP) {
    jumpToClTop();
    return;
  }
  const id = clAreaAnchorId(projectAreaDocId);
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  const hash = `#${id}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, "", hash);
  }
}

function isRailInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "select, option, button, a, input, label, textarea, [data-cl-health-report]",
      ),
    )
  );
}

function readStoredPos(): RailPos | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const left = (parsed as { left?: unknown }).left;
    const top = (parsed as { top?: unknown }).top;
    if (typeof left !== "number" || typeof top !== "number") return null;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  } catch {
    return null;
  }
}

function writeStoredPos(pos: RailPos) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore quota / private mode */
  }
}

function clampPos(pos: RailPos, el: HTMLElement): RailPos {
  const maxLeft = Math.max(0, window.innerWidth - el.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - el.offsetHeight);
  return {
    left: Math.min(maxLeft, Math.max(0, pos.left)),
    top: Math.min(maxTop, Math.max(0, pos.top)),
  };
}

const HEALTH_KIND_LABEL: Record<ChecklistHealthIssue["kind"], string> = {
  orphan_sku: "No matching SKU",
  underpopulated: "Incomplete Show All",
  orphan_object: "Missing quote object",
  redundant_scope: "Redundant scope",
};

/**
 * Fixed rail for checklist: current area name + area total + project total.
 * Tracks which area section is under the reading line as the user scrolls (desktop + tablet).
 * Drag to reposition; left/top persist in localStorage.
 */
export function ClScrollContextRail({
  areas,
  projectTotalLabel,
  healthIssues = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(JUMP_TO_TOP);
  const [pos, setPos] = useState<RailPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const issueCount = healthIssues.length;
  const hasHealthIssues = issueCount > 0;

  useEffect(() => {
    if (!hasHealthIssues) setHealthOpen(false);
  }, [hasHealthIssues]);

  useEffect(() => {
    if (!healthOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHealthOpen(false);
    }
    function onDoc(e: MouseEvent) {
      const el = railRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setHealthOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [healthOpen]);

  const jumpToIssue = useCallback(
    (issue: ChecklistHealthIssue) => {
      if (issue.lineId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("line", issue.lineId);
        params.delete("redundant");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        window.setTimeout(() => {
          document
            .getElementById(clLineAnchorId(issue.lineId!))
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return;
      }
      if (issue.anchorId) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("line");
        params.set("redundant", issue.anchorId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        setHealthOpen(false);
        window.setTimeout(() => {
          document
            .getElementById(issue.anchorId!)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return;
      }
      if (issue.areaId) jumpToClArea(issue.areaId);
    },
    [pathname, router, searchParams],
  );

  useLayoutEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const stored = readStoredPos();
    if (!stored) return;
    setPos(clampPos(stored, el));
  }, []);

  useEffect(() => {
    function onResize() {
      const el = railRef.current;
      if (!el) return;
      setPos((prev) => {
        if (!prev) return prev;
        const next = clampPos(prev, el);
        writeStoredPos(next);
        return next;
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (areas.length === 0) {
      setActiveAreaId(null);
      return;
    }

    const ids = new Set(areas.map((a) => a.id));
    setActiveAreaId((prev) =>
      prev && (prev === JUMP_TO_TOP || ids.has(prev)) ? prev : JUMP_TO_TOP,
    );

    function resolveActiveArea() {
      const nodes = document.querySelectorAll<HTMLElement>("[data-cl-area-id]");
      if (nodes.length === 0) return;
      const marker = Math.min(160, Math.round(window.innerHeight * 0.22));
      let nextId: string = JUMP_TO_TOP;
      for (const el of nodes) {
        const id = el.dataset.clAreaId;
        if (!id || !ids.has(id)) continue;
        if (el.getBoundingClientRect().top <= marker) {
          nextId = id;
        }
      }
      setActiveAreaId(nextId);
    }

    resolveActiveArea();
    window.addEventListener("scroll", resolveActiveArea, { passive: true });
    window.addEventListener("resize", resolveActiveArea);
    return () => {
      window.removeEventListener("scroll", resolveActiveArea);
      window.removeEventListener("resize", resolveActiveArea);
    };
  }, [areas]);

  const endDrag = useCallback((el: HTMLElement) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const rect = el.getBoundingClientRect();
    const next = clampPos({ left: rect.left, top: rect.top }, el);
    setPos(next);
    writeStoredPos(next);
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (isRailInteractiveTarget(e.target)) return;
    e.preventDefault();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    draggingRef.current = true;
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPos({ left: rect.left, top: rect.top });
    setDragging(true);
    el.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    const next = clampPos(
      {
        left: e.clientX - offsetRef.current.x,
        top: e.clientY - offsetRef.current.y,
      },
      e.currentTarget,
    );
    setPos(next);
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      endDrag(e.currentTarget);
    },
    [endDrag],
  );

  if (areas.length === 0) return null;

  const active = areas.find((a) => a.id === activeAreaId) ?? areas[0]!;

  return (
    <aside
      ref={railRef}
      aria-label="Checklist scroll context. Drag to reposition."
      title="Drag to reposition"
      className={`${clScrollContextRailClass} ${dragging ? "cursor-grabbing touch-none" : "cursor-grab"}`}
      style={
        pos
          ? { left: pos.left, top: pos.top, bottom: "auto", right: "auto" }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={`${clScrollContextRailSectionClass} pb-2 pt-3`}>
        <span className={clScrollContextRailAreaLabelClass}>Area</span>
        <span className={clScrollContextRailAreaNameClass} title={active.name}>
          {active.name}
        </span>
        <span className={clScrollContextRailSectionLabelClass}>Area Total</span>
        <span className={clScrollContextRailMoneyClass}>{active.totalLabel}</span>
      </div>
      <div className={clScrollContextRailDividerClass} aria-hidden />
      <div className={`${clScrollContextRailSectionClass} pb-2 pt-2`}>
        <span className={clScrollContextRailAreaLabelClass}>Project Total</span>
        <span className="block text-base font-bold tabular-nums text-sf-brand dark:text-zinc-50">
          {projectTotalLabel}
        </span>
      </div>
      <div className={clScrollContextRailDividerClass} aria-hidden />
      <div className={`${clScrollContextRailSectionClass} pb-3 pt-2`}>
        <label className="block min-w-0">
          <span className={clScrollContextRailAreaLabelClass}>Jump to Area</span>
          <select
            aria-label="Jump to area"
            title="Jump to area"
            className={clScrollContextRailJumpSelectClass}
            value={activeAreaId ?? JUMP_TO_TOP}
            onChange={(e) => jumpToClArea(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <option value={JUMP_TO_TOP}>Top</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        {hasHealthIssues ? (
          <button
            type="button"
            className="mt-2 block w-full text-left text-[11px] font-semibold leading-snug text-red-700 underline decoration-red-700/60 underline-offset-2 hover:text-red-900 dark:text-red-400 dark:decoration-red-400/60 dark:hover:text-red-300"
            aria-expanded={healthOpen}
            aria-haspopup="dialog"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHealthOpen((v) => !v)}
          >
            Attention Required
          </button>
        ) : (
          <p className="mt-2 text-[10px] font-medium leading-snug text-emerald-800/80 dark:text-emerald-400/80">
            Health Okay
          </p>
        )}
      </div>
      {healthOpen && hasHealthIssues ? (
        <div
          data-cl-health-report
          role="dialog"
          aria-label="Project health report"
          className="absolute bottom-0 left-full z-[60] ml-2 w-[22rem] max-w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-red-200 bg-white shadow-xl dark:border-red-900/70 dark:bg-zinc-900"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-red-100 px-3 py-2 dark:border-red-900/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
              Attention required
            </p>
            <p className="mt-0.5 text-xs text-sf-text-secondary dark:text-zinc-400">
              {issueCount} item{issueCount === 1 ? "" : "s"} on this project. Open an item to
              jump to it. Leftover questions sit at the top of the area — they are not in the
              object list.
            </p>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {healthIssues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => jumpToIssue(issue)}
                >
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-red-800/80 dark:text-red-300/90">
                    {HEALTH_KIND_LABEL[issue.kind]}
                  </span>
                  {issue.areaName ? (
                    <span className="mt-0.5 block text-[11px] font-semibold text-sf-text dark:text-zinc-200">
                      Area: {issue.areaName}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-sm font-medium text-sf-text dark:text-zinc-100">
                    {issue.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-sf-text-secondary dark:text-zinc-400">
                    {issue.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={clScrollContextRailAccentBarClass} aria-hidden />
    </aside>
  );
}
