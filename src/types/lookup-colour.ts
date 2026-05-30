/** Firestore `lookups_colours` — colour codes by class (from Lists sheet). */
export type LookupColour = {
  colourLookupId: number;
  category: string;
  /** Sheet column “Class” (Heritage, Modern, All). */
  colourClass: string;
  descriptor: string;
  notes: string;
  /** Normalized composite key for dedupe. */
  colourKey: string;
};
