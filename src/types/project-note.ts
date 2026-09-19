export type ProjectNotePublic = {
  id: string;
  noteid: number;
  notedatetime: string | null;
  projectid: number;
  /** Template area id; absent for project-level notes. */
  areaid: number | null;
  /** Quote object id; present only for object-level notes (with areaid). */
  objectid: number | null;
  /**
   * Catalog SKU id when the note is attached to a specific SKU under the object.
   * Optional: object-level notes omit this even when the object has several SKUs.
   */
  skuId: string | null;
  notetype: string;
  /** One or more trade tags (Building, Plumbing, etc.). */
  trades: string[];
  author: string;
  note: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ProjectNoteUpdateBody = {
  notetype: string;
  trades: string[];
  note: string;
  objectid: number | null;
  skuId: string | null;
};
