export type ProjectNotePublic = {
  id: string;
  noteid: number;
  notedatetime: string | null;
  projectid: number;
  /** Template area id; absent for project-level notes. */
  areaid: number | null;
  /** Quote object id; present only for object-level notes (with areaid). */
  objectid: number | null;
  notetype: string;
  /** One or more trade tags (Building, Plumbing, etc.). */
  trades: string[];
  author: string;
  note: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
