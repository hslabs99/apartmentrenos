/** Toggle tags for project notes (multi-select). */
export const PROJECT_NOTE_TRADE_TAGS = [
  "Building",
  "Plumbing",
  "Electrical",
  "Demolition",
  "Cleaning",
  "Lead Contractor",
] as const;

export type ProjectNoteTradeTag = (typeof PROJECT_NOTE_TRADE_TAGS)[number];

export function formatProjectNoteTrades(trades: readonly string[]): string {
  const list = trades.map((t) => t.trim()).filter(Boolean);
  return list.length > 0 ? list.join(", ") : "—";
}
