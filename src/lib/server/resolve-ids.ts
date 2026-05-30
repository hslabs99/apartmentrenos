import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";

function numOrNull(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/**
 * Returns numeric projectid for a project doc. If missing (legacy), allocates and saves.
 */
export async function ensureProjectNumericId(
  db: Firestore,
  projectDocId: string,
): Promise<number> {
  if (isProjectsMetaDocument(projectDocId)) {
    throw new Error("Invalid project reference");
  }
  const ref = db.collection("projects").doc(projectDocId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Project not found");
  const data = snap.data() as DocumentData;
  const existing = numOrNull(data.projectid);
  if (existing != null) return existing;
  const next = await allocateNextSequence(db, "projectid");
  await ref.update({
    projectid: next,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return next;
}

/**
 * Returns numeric areaid for an area doc. If missing (legacy), allocates and saves.
 */
export async function ensureAreaNumericId(
  db: Firestore,
  areaDocId: string,
): Promise<number> {
  if (isAreasMetaDocument(areaDocId)) throw new Error("Invalid area reference");
  const ref = db.collection("areas").doc(areaDocId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Area not found");
  const data = snap.data() as DocumentData;
  const existing = numOrNull(data.areaid);
  if (existing != null) return existing;
  const next = await allocateNextSequence(db, "areaid");
  await ref.update({
    areaid: next,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return next;
}

export async function getProjectAreaKeys(
  db: Firestore,
  projectAreaDocId: string,
): Promise<{ projectid: number; areaid: number }> {
  if (isProjectAreasMetaDocument(projectAreaDocId)) {
    throw new Error("Invalid project area reference");
  }
  const ref = db.collection("projectareas").doc(projectAreaDocId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Project area not found");
  const d = snap.data() as DocumentData;
  const projectid = Number(d.projectid);
  const areaid = Number(d.areaid);
  if (!Number.isInteger(projectid) || !Number.isInteger(areaid)) {
    throw new Error("Invalid project area data");
  }
  return { projectid, areaid };
}

export async function getQuoteObjectNumericIdFromDoc(
  db: Firestore,
  quoteObjectDocId: string,
): Promise<number> {
  if (isQuoteObjectsMetaDocument(quoteObjectDocId)) {
    throw new Error("Invalid quote object reference");
  }
  const ref = db.collection("quote_objects").doc(quoteObjectDocId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Quote object not found");
  const oid = numOrNull((snap.data() as DocumentData).objectid);
  if (oid == null) throw new Error("Quote object has no object id; re-save in Setup");
  return oid;
}
