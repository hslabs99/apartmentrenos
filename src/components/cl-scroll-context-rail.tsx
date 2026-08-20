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
};

type RailPos = { left: number; top: number };

const STORAGE_KEY = "apartmentrenos.clScrollContextRailPos";
const JUMP_TO_TOP = "__top__";

/** Checklist area header id — used by Jump to Area nav and the floating totals dropdown. */
export function clAreaAnchorId(projectAreaDocId: string): string {
  return `cl-area-${projectAreaDocId}`;
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
    Boolean(target.closest("select, option, button, a, input, label, textarea"))
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

/**
 * Fixed rail for checklist: current area name + area total + project total.
 * Tracks which area section is under the reading line as the user scrolls (desktop + tablet).
 * Drag to reposition; left/top persist in localStorage.
 */
export function ClScrollContextRail({ areas, projectTotalLabel }: Props) {
  const [activeAreaId, setActiveAreaId] = useState<string | null>(JUMP_TO_TOP);
  const [pos, setPos] = useState<RailPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

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
      </div>
      <div className={clScrollContextRailAccentBarClass} aria-hidden />
    </aside>
  );
}
