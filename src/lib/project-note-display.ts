/** Shared note list / report formatting helpers. */

export function formatProjectNoteDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** First-line preview for the notes index. CSS truncate clips at the column edge. */
export function noteIndexPreview(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t || "—";
}

export function formatProjectNoteSkuLabel(
  skuId: string | null | undefined,
  labelForSkuId: (skuId: string) => string | undefined,
): string {
  const id = skuId?.trim();
  if (!id) return "—";
  const label = labelForSkuId(id)?.trim();
  return label || id;
}
