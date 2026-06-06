import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureDataBuildingElementsBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_BUILDING_ELEMENTS_COLLECTION,
  isDataBuildingElementsMetaDocument,
} from "@/lib/firestore/data-building-elements-collection";
import { fetchBuildingElementsRows } from "@/lib/google/fetch-building-elements-rows";
import { BUILDING_ELEMENTS_DATA_START_ROW_1_BASED } from "@/lib/google/parse-building-elements";

const WRITE_BATCH_SIZE = 100;
const DELETE_BATCH_SIZE = 500;

export type ImportBuildingElementsResult = {
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

export async function runImportBuildingElements(
  db: Firestore,
): Promise<ImportBuildingElementsResult> {
  const fetched = await fetchBuildingElementsRows();

  if (fetched.elements.length === 0) {
    const detail =
      fetched.errors.length > 0
        ? ` ${fetched.errors.slice(0, 5).join(" ")}`
        : " No element columns found.";
    throw new Error(`No building elements to import from "${fetched.tabTitle}".${detail}`);
  }

  await ensureDataBuildingElementsBootstrap(db);

  const snap = await db.collection(DATA_BUILDING_ELEMENTS_COLLECTION).get();
  const deleteRefs = snap.docs
    .filter((d) => !isDataBuildingElementsMetaDocument(d.id))
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
      const ref = db.collection(DATA_BUILDING_ELEMENTS_COLLECTION).doc();
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
    dataStartRow1Based: BUILDING_ELEMENTS_DATA_START_ROW_1_BASED,
    parsedElements: fetched.elements.length,
    parsedLines: fetched.parsedLines,
    written,
    deletedPrior,
    parseErrors: fetched.errors,
  };
}
