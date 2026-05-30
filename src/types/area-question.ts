export type AreaQuestionPublic = {
  id: string;
  questionId: number;
  /** Template area numeric id (areas.areaid). */
  areaId: number;
  questionText: string;
  defaultAnswer?: string | null;
  /** Lookup IDs (lookups.lookupid) where lookuptype === "Trades". */
  applicableTradeLookupIds: number[];
  sortOrder?: number | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

