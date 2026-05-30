import type { Firestore } from "firebase-admin/firestore";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";

export type EffectiveStyleColour = {
  style: string;
  colour: string;
};

export async function resolveEffectiveStyleColour(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
): Promise<EffectiveStyleColour> {
  let style = "";
  let colour = "";

  if (!isProjectAreasMetaDocument(projectAreaDocId)) {
    const paSnap = await db.collection("projectareas").doc(projectAreaDocId).get();
    const pa = paSnap.data();
    if (typeof pa?.style === "string" && pa.style.trim()) style = pa.style.trim();
    if (typeof pa?.colour === "string" && pa.colour.trim()) colour = pa.colour.trim();
  }

  if (!style || !colour) {
    const projQ = await db.collection("projects").where("projectid", "==", projectid).limit(1).get();
    const pd = projQ.docs[0]?.data();
    if (!style && typeof pd?.defaultstyle === "string" && pd.defaultstyle.trim()) {
      style = pd.defaultstyle.trim();
    }
    if (!colour && typeof pd?.defaultcolour === "string" && pd.defaultcolour.trim()) {
      colour = pd.defaultcolour.trim();
    }
  }

  return { style, colour };
}
