import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureDataPaintingElementsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_PAINTING_ELEMENTS_COLLECTION,
  isDataPaintingElementsMetaDocument,
} from "@/lib/firestore/data-painting-elements-collection";
import { fetchPaintingElementsRows } from "@/lib/google/fetch-painting-elements-rows";
import { PAINTING_ELEMENTS_DATA_START_ROW_1_BASED } from "@/lib/google/parse-painting-elements";

const WRITE_BATCH_SIZE = 100;
const DELETE_BATCH_SIZE = 500;

export type ImportPaintingElementsResult = {
  tabTitle: string;
  gid: number;
  range: string;
  dataStartRow1Based: number;
  parsedElements: number;
  parsedLines: number;
  written: number;
  deletedPrior: number;
  parseErrors: string[];
};

export async function runImportPaintingElements(
  db: Firestore,
): Promise<ImportPaintingElementsResult> {
  const fetched = await fetchPaintingElementsRows();

  if (fetched.elements.length === 0) {
    const detail =
      fetched.errors.length > 0
        ? ` ${fetched.errors.slice(0, 5).join(" ")}`
        : " No element columns found.";
    throw new Error(`No painting elements to import from "${fetched.tabTitle}".${detail}`);
  }

  await ensureDataPaintingElementsBootstrap(db);

  const snap = await db.collection(DATA_PAINTING_ELEMENTS_COLLECTION).get();
  const deleteRefs = snap.docs
    .filter((d) => !isDataPaintingElementsMetaDocument(d.id))
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

  for (let i = 0; i < fetched.elements.length; i += WRITE_BATCH_SIZE) {
    const chunk = fetched.elements.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();
    for (const element of chunk) {
      const ref = db.collection(DATA_PAINTING_ELEMENTS_COLLECTION).doc();
      batch.set(ref, {
        skuName: element.skuName,
        element: element.element,
        size: element.size,
        type: element.type,
        quantityUom: element.quantityUom,
        sheetColumn: element.sheetColumn,
        headerSheetRow: element.headerSheetRow,
        lines: element.lines,
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
    dataStartRow1Based: PAINTING_ELEMENTS_DATA_START_ROW_1_BASED,
    parsedElements: fetched.elements.length,
    parsedLines: fetched.parsedLines,
    written,
    deletedPrior,
    parseErrors: fetched.errors,
  };
}
