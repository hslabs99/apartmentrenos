export type LookupPublic = {
  id: string;
  lookupid?: number | null;
  lookuptype: string;
  lookupvalue: string;
  /** Optional note (e.g. from Master Prices Lists sheet). */
  notes: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
