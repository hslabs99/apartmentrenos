"use client";

import type { DragEvent } from "react";

type DragReorderHandleProps = {
  itemLabel: string;
  dragging?: boolean;
  disabled?: boolean;
  dense?: boolean;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
};

export function DragReorderHandle({
  itemLabel,
  dragging,
  disabled,
  dense,
  onDragStart,
}: DragReorderHandleProps) {
  const size = dense ? "text-base leading-none" : "text-lg leading-none";

  return (
    <span
      draggable={!disabled}
      onDragStart={onDragStart}
      onClick={(e) => e.stopPropagation()}
      className={`shrink-0 select-none text-sf-text-weak dark:text-zinc-500 ${size} ${
        !disabled ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-40"
      } ${dragging ? "opacity-60" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Drag to reorder ${itemLabel}`}
      title="Drag to reorder"
    >
      ⠿
    </span>
  );
}
