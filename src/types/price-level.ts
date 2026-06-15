export type PriceLevelPublic = {
  id: string;
  pricelevelid?: number | null;
  /**
   * Display order in System → Price Levels, Quote Objects, scopes, etc.
   * When omitted, `pricelevelid` is used for ordering (legacy).
   */
  sortOrder?: number | null;
  pricelevel: string;
  description: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
