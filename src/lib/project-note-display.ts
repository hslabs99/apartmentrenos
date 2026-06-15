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

export function noteIndexPreview(text: string): string {
  const t = text.trim();
  if (!t) return "—";
  if (t.length <= 10) return t;
  return `${t.slice(0, 10)}....`;
}
