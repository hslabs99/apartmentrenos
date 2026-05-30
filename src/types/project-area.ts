/** Saved choice for a Setup → Scopes question on this project area. */
export type ProjectAreaScopeAnswerPublic = {
  scopeDocId: string;
  answerid: string;
};

export type ProjectAreaPublic = {
  id: string;
  projectid: number;
  areaid: number;
  /**
   * Optional label for this instance (e.g. "Master bedroom"). When empty, the Setup → Areas
   * template name is shown.
   */
  displayName?: string | null;
  /** Copied from template area at add time; drives list order with Setup → Areas. */
  sortOrder?: number | null;
  areanotes1: string;
  areanotes2: string;
  aream2?: number | null;
  areafinish: string;
  /** Optional override of project default price level for this area (null = use project default). */
  pricelevelid?: number | null;
  /** Optional override of project default Style for this area (null = use project default). */
  style?: string | null;
  /** Optional override of project default Colour for this area (null = use project default). */
  colour?: string | null;
  /** User’s scope answers; lines are materialized separately via scope-answer API. */
  scopeAnswers?: ProjectAreaScopeAnswerPublic[];
  /**
   * Optional Setup → Scopes document ids to include on this project area only (in addition to
   * scopes tagged for the template area). Lets users pull in extra questions on the checklist.
   */
  extraScopeDocIds?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
};
