export type AreaObjectPublic = {
  id: string;
  sortOrder?: number | null;
  areaid: number;
  objectid: number;
  notes3: string;
  notes4: string;
  default: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/** Enriched row for global area-object pickers (e.g. scopes). */
export type AreaObjectCatalogRow = {
  id: string;
  areaid: number;
  objectid: number;
  areaname: string;
  objectname: string;
};

/** Quote object row for scope pickers (catalog includes these plus areaobjects). */
export type QuoteObjectCatalogRow = {
  id: string;
  objectid: number;
  objectname: string;
};
