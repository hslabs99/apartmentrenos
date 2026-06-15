"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

export type DragListReorderOptions = {
  /** Extra JSON fields for the reorder POST (e.g. `contextAreaDocId` for scopes). */
  getExtraBody?: () => Record<string, unknown>;
};

function reorderIds(ids: string[], draggedId: string, targetId: string): string[] | null {
  if (draggedId === targetId) return null;
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}

export function useDragListReorder(
  reorderUrl: string,
  onReload: () => void | Promise<void>,
  onError: (message: string) => void,
  options?: DragListReorderOptions,
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const busy = useRef(false);
  const getExtraBodyRef = useRef(options?.getExtraBody);
  useEffect(() => {
    getExtraBodyRef.current = options?.getExtraBody;
  }, [options?.getExtraBody]);

  const persistOrder = useCallback(
    async (orderedIds: string[]) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await fetch(reorderUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderedIds,
            ...(getExtraBodyRef.current?.() ?? {}),
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Reorder failed");
        }
        await onReload();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Reorder failed");
      } finally {
        busy.current = false;
        setDragId(null);
      }
    },
    [reorderUrl, onReload, onError],
  );

  const dropOnTarget = useCallback(
    (ids: string[], draggedId: string, targetId: string) => {
      const next = reorderIds(ids, draggedId, targetId);
      if (!next) return;
      void persistOrder(next);
    },
    [persistOrder],
  );

  const onDragStart = useCallback((e: DragEvent<HTMLElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    const row = e.currentTarget.closest("tr");
    if (row instanceof HTMLElement) {
      e.dataTransfer.setDragImage(row, 24, 16);
    }
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLTableRowElement>, ids: string[], targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const dragged = dragId ?? e.dataTransfer.getData("text/plain");
      if (!dragged) {
        setDragId(null);
        return;
      }
      dropOnTarget(ids, dragged, targetId);
    },
    [dragId, dropOnTarget],
  );

  const onDragEnd = useCallback(() => {
    setDragId(null);
  }, []);

  const onRowKeyDown = useCallback(
    (ids: string[], id: string, e: React.KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const idx = ids.indexOf(id);
      if (idx < 0) return;
      const j = e.key === "ArrowUp" ? idx - 1 : idx + 1;
      if (j < 0 || j >= ids.length) return;
      const next = [...ids];
      [next[idx], next[j]] = [next[j], next[idx]];
      void persistOrder(next);
    },
    [persistOrder],
  );

  return {
    dragId,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onRowKeyDown,
  };
}
