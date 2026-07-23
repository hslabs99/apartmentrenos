export const DEFAULT_NOTE_TYPE = "General";

export const ESCALATION_NOTE_TYPE = "Escalation";

export const DEFAULT_NOTE_TYPES = [
  "General",
  "Style",
  "Other",
  ESCALATION_NOTE_TYPE,
] as const;

/** Retired note types (use trade tags instead). Kept for legacy notes only. */
export const RETIRED_NOTE_TYPES = ["Demolition"] as const;

export function isRetiredNoteType(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return RETIRED_NOTE_TYPES.some((t) => t.toLowerCase() === normalized);
}
