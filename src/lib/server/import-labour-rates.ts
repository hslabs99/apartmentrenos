import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureDataLabourratesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_LABOURRATES_COLLECTION,
  isDataLabourratesMetaDocument,
} from "@/lib/firestore/data-labourrates-collection";
import { fetchLabourRatesRows } from "@/lib/google/fetch-labour-rates-rows";
import { LABOUR_RATES_DATA_START_ROW_1_BASED } from "@/lib/google/parse-labour-rates";

const WRITE_BATCH_SIZE = 400;
const DELETE_BATCH_SIZE = 500;

export type ImportLabourRatesResult = {
  tabTitle: string;
  range: string;
  headerRow1Based: number;
  dataStartRow1Based: number;
  parsed: number;
  written: number;
  deletedPrior: number;
  parseErrors: string[];
};

export async function runImportLabourRates(db: Firestore): Promise<ImportLabourRatesResult> {
  const fetched = await fetchLabourRatesRows();

  if (fetched.headerRow1Based === 0) {
    throw new Error(
      fetched.errors[0] ??
        `Could not find labour rates header row on "${fetched.tabTitle}" (${fetched.range}).`,
    );
  }

  if (fetched.rows.length === 0) {
    const detail =
      fetched.errors.length > 0
        ? ` ${fetched.errors.slice(0, 5).join(" ")}`
        : " No data rows after the header.";
    throw new Error(`No labour rates to import from "${fetched.tabTitle}".${detail}`);
  }

  await ensureDataLabourratesBootstrap(db);

  const snap = await db.collection(DATA_LABOURRATES_COLLECTION).get();
  const deleteRefs = snap.docs
    .filter((d) => !isDataLabourratesMetaDocument(d.id))
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

  for (let i = 0; i < fetched.rows.length; i += WRITE_BATCH_SIZE) {
    const chunk = fetched.rows.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      const ref = db.collection(DATA_LABOURRATES_COLLECTION).doc();
      batch.set(ref, {
        category: row.category,
        productType: row.productType,
        product: row.product,
        priceExcGst: row.priceExcGst,
        uom: row.uom,
        sheetRow: row.sheetRow,
        importedAt: now,
      });
    }
    await batch.commit();
    written += chunk.length;
  }

  return {
    tabTitle: fetched.tabTitle,
    range: fetched.range,
    headerRow1Based: fetched.headerRow1Based,
    dataStartRow1Based: LABOUR_RATES_DATA_START_ROW_1_BASED,
    parsed: fetched.rows.length,
    written,
    deletedPrior,
    parseErrors: fetched.errors,
  };
}
