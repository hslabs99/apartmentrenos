"use client";

import { useCallback, useEffect, useRef } from "react";

export type TemplateReorderOptions = {
  /** Extra JSON fields for the reorder POST (e.g. `contextAreaDocId` for scopes). */
  getExtraBody?: () => Record<string, unknown>;
};

export function useTemplateReorder(
  reorderUrl: string,
  onReload: () => void | Promise<void>,
  onError: (message: string) => void,
  options?: TemplateReorderOptions,
) {
  const busy = useRef(false);
  const getExtraBodyRef = useRef(options?.getExtraBody);
  useEffect(() => {
    getExtraBodyRef.current = options?.getExtraBody;
  }, [options?.getExtraBody]);

  const moveRow = useCallback(
    async (id: string, direction: "up" | "down") => {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await fetch(reorderUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            direction,
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
      }
    },
    [reorderUrl, onReload, onError],
  );

  const onRowKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      void moveRow(id, e.key === "ArrowUp" ? "up" : "down");
    },
    [moveRow],
  );

  return { onRowKeyDown, moveRow };
}
