import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { backfillMissingProjectAreaDocIds } from "@/lib/server/project-area-line-backfill";
import {
  compareProjectAreaLineOrder,
  sortProjectAreaLines,
} from "@/lib/project-area-line-order";

type AreaLineRow = {
  id: string;
  objectid: number;
  lineSortOrder: number | null;
  dateadded: string | null;
};

function readLineSortOrder(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function readDateAddedIso(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null && "toDate" in raw) {
    const d = (raw as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

async function loadAreaLineRows(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
): Promise<AreaLineRow[]> {
  await backfillMissingProjectAreaDocIds(db, projectid);

  const snap = await db
    .collection("projectareaobjects")
    .where("projectAreaDocId", "==", projectAreaDocId)
    .get();

  return snap.docs
    .filter((d) => !isProjectAreaObjectsMetaDocument(d.id))
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        objectid: Number(data.objectid) || 0,
        lineSortOrder: readLineSortOrder(data.lineSortOrder),
        dateadded: readDateAddedIso(data.dateadded),
      };
    });
}

/**
 * Inserts `newLineDocId` directly after `insertAfterLineDocId` and renumbers
 * `lineSortOrder` for every line in the area (10, 20, 30, …).
 */
export async function insertProjectAreaLineAfter(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
  newLineDocId: string,
  insertAfterLineDocId: string,
): Promise<void> {
  const afterRef = db.collection("projectareaobjects").doc(insertAfterLineDocId);
  const afterSnap = await afterRef.get();
  if (!afterSnap.exists || isProjectAreaObjectsMetaDocument(insertAfterLineDocId)) {
    throw new Error("insertAfter line not found");
  }

  const rows = await loadAreaLineRows(db, projectAreaDocId, projectid);
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (!byId.has(newLineDocId)) {
    throw new Error("New line not found in this area");
  }
  if (!byId.has(insertAfterLineDocId)) {
    throw new Error("insertAfter line not found in this area");
  }

  const sorted = sortProjectAreaLines(rows);
  const withoutNew = sorted.filter((r) => r.id !== newLineDocId);
  const afterIdx = withoutNew.findIndex((r) => r.id === insertAfterLineDocId);
  if (afterIdx < 0) {
    throw new Error("insertAfter line not found in this area");
  }

  const merged = [
    ...withoutNew.slice(0, afterIdx + 1),
    byId.get(newLineDocId)!,
    ...withoutNew.slice(afterIdx + 1),
  ];

  const batch = db.batch();
  merged.forEach((row, index) => {
    batch.update(db.collection("projectareaobjects").doc(row.id), {
      lineSortOrder: (index + 1) * 10,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

export { compareProjectAreaLineOrder };
