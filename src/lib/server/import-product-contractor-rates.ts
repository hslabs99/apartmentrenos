import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureDataProductcontractorratesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_PRODUCTCONTRACTORRATES_COLLECTION,
  isDataProductcontractorratesMetaDocument,
} from "@/lib/firestore/data-productcontractorrates-collection";
import { fetchProductContractorRatesRows } from "@/lib/google/fetch-product-contractor-rates-rows";
import { PRODUCT_CONTRACTOR_RATES_DATA_START_ROW_1_BASED } from "@/lib/google/parse-product-contractor-rates";

const WRITE_BATCH_SIZE = 400;
const DELETE_BATCH_SIZE = 500;

export type ImportProductContractorRatesResult = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  dataStartRow1Based: number;
  parsed: number;
  written: number;
  deletedPrior: number;
  parseErrors: string[];
};

export async function runImportProductContractorRates(
  db: Firestore,
): Promise<ImportProductContractorRatesResult> {
  const fetched = await fetchProductContractorRatesRows();

  if (fetched.headerRow1Based === 0) {
    throw new Error(
      fetched.errors[0] ??
        `Could not find contractor rates header row on "${fetched.tabTitle}" (${fetched.range}).`,
    );
  }

  if (fetched.rows.length === 0) {
    const detail =
      fetched.errors.length > 0
        ? ` ${fetched.errors.slice(0, 5).join(" ")}`
        : " No data rows after the header.";
    throw new Error(
      `No contractor rates to import from "${fetched.tabTitle}".${detail}`,
    );
  }

  await ensureDataProductcontractorratesBootstrap(db);

  const snap = await db.collection(DATA_PRODUCTCONTRACTORRATES_COLLECTION).get();
  const deleteRefs = snap.docs
    .filter((d) => !isDataProductcontractorratesMetaDocument(d.id))
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
      const ref = db.collection(DATA_PRODUCTCONTRACTORRATES_COLLECTION).doc();
      batch.set(ref, {
        productType: row.productType,
        specification: row.specification,
        labourDesc: row.labourDesc,
        base: row.base,
        m2: row.m2,
        lm: row.lm,
        unit: row.unit,
        notes: row.notes,
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
    dataStartRow1Based: PRODUCT_CONTRACTOR_RATES_DATA_START_ROW_1_BASED,
    parsed: fetched.rows.length,
    written,
    deletedPrior,
    parseErrors: fetched.errors,
  };
}
