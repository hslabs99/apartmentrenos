import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureDataObjectlabourratesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_OBJECTLABOURRATES_COLLECTION,
  isDataObjectlabourratesMetaDocument,
} from "@/lib/firestore/data-objectlabourrates-collection";
import { fetchIncrementalLabourProductsRows } from "@/lib/google/fetch-incremental-labour-products-rows";
import { INCREMENTAL_LABOUR_PRODUCTS_DATA_START_ROW_1_BASED } from "@/lib/google/parse-incremental-labour-products";

const WRITE_BATCH_SIZE = 400;
const DELETE_BATCH_SIZE = 500;

export type ImportObjectLabourRatesResult = {
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

function productForFirestore(product: string): string | null {
  const trimmed = product.trim();
  return trimmed === "" ? null : trimmed;
}

function rowPayload(
  row: Awaited<ReturnType<typeof fetchIncrementalLabourProductsRows>>["rows"][number],
  now: ReturnType<typeof FieldValue.serverTimestamp>,
) {
  return {
    category: row.category,
    productType: row.productType,
    product: productForFirestore(row.product),
    constructionAssistant: row.constructionAssistant,
    leadContractor: row.leadContractor,
    electrician: row.electrician,
    plumber: row.plumber,
    uom: row.uom,
    comments: row.comments,
    sheetRow: row.sheetRow,
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/** Replace `data_objectlabourrates` from `Incremental Labour - Products` (collection cleared first). */
export async function runImportObjectLabourRates(
  db: Firestore,
): Promise<ImportObjectLabourRatesResult> {
  const fetched = await fetchIncrementalLabourProductsRows();

  if (fetched.headerRow1Based === 0) {
    throw new Error(
      fetched.errors[0] ??
        `Could not find incremental labour products header row on "${fetched.tabTitle}" (${fetched.range}).`,
    );
  }

  if (fetched.rows.length === 0) {
    const detail =
      fetched.errors.length > 0
        ? ` ${fetched.errors.slice(0, 5).join(" ")}`
        : " No data rows after the header.";
    throw new Error(
      `No incremental labour products to import from "${fetched.tabTitle}".${detail}`,
    );
  }

  await ensureDataObjectlabourratesBootstrap(db);

  const snap = await db.collection(DATA_OBJECTLABOURRATES_COLLECTION).get();
  const deleteRefs = snap.docs
    .filter((d) => !isDataObjectlabourratesMetaDocument(d.id))
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
      const ref = db.collection(DATA_OBJECTLABOURRATES_COLLECTION).doc();
      batch.set(ref, rowPayload(row, now));
      written++;
    }

    await batch.commit();
  }

  return {
    tabTitle: fetched.tabTitle,
    gid: fetched.gid,
    range: fetched.range,
    headerRow1Based: fetched.headerRow1Based,
    dataStartRow1Based: INCREMENTAL_LABOUR_PRODUCTS_DATA_START_ROW_1_BASED,
    parsed: fetched.rows.length,
    written,
    deletedPrior,
    parseErrors: fetched.errors,
  };
}
