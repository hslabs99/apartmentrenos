import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureCascadesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  CASCADES_COLLECTION,
  isCascadesMetaDocument,
} from "@/lib/firestore/cascades-collection";
import { fetchCascadingRestrictionsRows } from "@/lib/google/fetch-cascading-restrictions-rows";

const WRITE_BATCH_SIZE = 400;
const DELETE_BATCH_SIZE = 500;

export type ImportCascadesResult = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  parsed: number;
  written: number;
  deletedPrior: number;
};

export async function runImportCascades(db: Firestore): Promise<ImportCascadesResult> {
  const fetched = await fetchCascadingRestrictionsRows();
  if (fetched.headerRow1Based === 0) {
    throw new Error(
      `Could not find Level / Style / Colour header row on "${fetched.tabTitle}" (${fetched.range}).`,
    );
  }

  await ensureCascadesBootstrap(db);

  const snap = await db.collection(CASCADES_COLLECTION).get();
  const deleteRefs = snap.docs
    .filter((d) => !isCascadesMetaDocument(d.id))
    .map((d) => d.ref);

  let deletedPrior = 0;
  for (let i = 0; i < deleteRefs.length; i += DELETE_BATCH_SIZE) {
    const chunk = deleteRefs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
    deletedPrior += chunk.length;
  }

  const now = FieldValue.serverTimestamp();
  let written = 0;
  const rows = fetched.rows;

  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const chunk = rows.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      const ref = db.collection(CASCADES_COLLECTION).doc();
      batch.set(ref, {
        level: row.level,
        style: row.style,
        colour: row.colour,
        sheetRow: row.sheetRow,
        importedAt: now,
      });
    }
    await batch.commit();
    written += chunk.length;
  }

  return {
    tabTitle: fetched.tabTitle,
    gid: fetched.gid,
    range: fetched.range,
    headerRow1Based: fetched.headerRow1Based,
    parsed: rows.length,
    written,
    deletedPrior,
  };
}
