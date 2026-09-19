import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";

export type EffectiveStyleColour = {
  style: string;
  colour: string;
};

/** Same rules as `resolveEffectiveStyleColour`, from already-loaded docs (no extra reads). */
export function effectiveStyleColourFromData(
  paData: DocumentData | undefined,
  projectData: DocumentData | undefined,
): EffectiveStyleColour {
  let style = "";
  let colour = "";
  if (typeof paData?.style === "string" && paData.style.trim()) style = paData.style.trim();
  if (typeof paData?.colour === "string" && paData.colour.trim()) colour = paData.colour.trim();
  if (!style && typeof projectData?.defaultstyle === "string" && projectData.defaultstyle.trim()) {
    style = projectData.defaultstyle.trim();
  }
  if (!colour && typeof projectData?.defaultcolour === "string" && projectData.defaultcolour.trim()) {
    colour = projectData.defaultcolour.trim();
  }
  return { style, colour };
}

export async function resolveEffectiveStyleColour(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
): Promise<EffectiveStyleColour> {
  let paData: DocumentData | undefined;
  if (!isProjectAreasMetaDocument(projectAreaDocId)) {
    const paSnap = await db.collection("projectareas").doc(projectAreaDocId).get();
    paData = paSnap.data();
  }

  const fromArea = effectiveStyleColourFromData(paData, undefined);
  if (fromArea.style && fromArea.colour) return fromArea;

  const projQ = await db.collection("projects").where("projectid", "==", projectid).limit(1).get();
  return effectiveStyleColourFromData(paData, projQ.docs[0]?.data());
}
