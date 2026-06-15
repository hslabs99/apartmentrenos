/** Allowed values for `status` on project documents. */
export const PROJECT_STATUS_OPTIONS = ["Live", "Archive"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS_OPTIONS)[number];

/** Project document fields (Firestore `projects` collection). */
export type ProjectPublic = {
  id: string;
  projectid?: number | null;
  /** Live = active; Archive = inactive / historical. */
  status: ProjectStatus;
  projectname: string;
  projectdescription: string;
  /** Total apartment/project m² (optional summary field for quoting). */
  projectm2?: number | null;
  /** Apartment hard-floor m² (optional). */
  projectm2hard?: number | null;
  /** Apartment soft-floor m² (optional). */
  projectm2soft?: number | null;
  /** Ceiling height (m) (optional). */
  ceilingheightm?: number | null;
  projectaddress: string;
  projectcontact: string;
  projecttel: string;
  projectemail: string;
  projectbrief: string;
  projectfinish: string;
  spec2: string;
  spec3: string;
  targetstartdate?: string | null;
  projectnotes: string;
  quotedby: string;
  quotedon?: string | null;
  /** Default System → Price Levels tier for new areas/lines unless overridden per area. */
  defaultpricelevelid?: number | null;
  /** Default Style for areas/lines unless overridden per area/line. Empty = not set. */
  defaultstyle?: string;
  /** Default Colour for areas/lines unless overridden per area/line. Empty = not set. */
  defaultcolour?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/** Projects list API includes area counts per project. */
export type ProjectListItem = ProjectPublic & { areaCount: number };
