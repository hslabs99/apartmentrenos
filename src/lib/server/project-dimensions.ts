import type { DocumentData, Firestore } from "firebase-admin/firestore";

export type ProjectDimensions = {
  apartmentTotalM2: number | null;
  apartmentHardM2: number | null;
  apartmentSoftM2: number | null;
};

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export async function loadProjectDimensionsByProjectId(
  db: Firestore,
  projectid: number,
): Promise<ProjectDimensions> {
  const empty: ProjectDimensions = {
    apartmentTotalM2: null,
    apartmentHardM2: null,
    apartmentSoftM2: null,
  };
  if (!Number.isInteger(projectid)) return empty;
  const projQ = await db.collection("projects").where("projectid", "==", projectid).limit(1).get();
  const data = projQ.docs[0]?.data() as DocumentData | undefined;
  if (!data) return empty;
  return {
    apartmentTotalM2: numOrNull(data.projectm2),
    apartmentHardM2: numOrNull(data.projectm2hard),
    apartmentSoftM2: numOrNull(data.projectm2soft),
  };
}

