import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ensureDataObjectlabourratesBootstrap } from "@/lib/firestore/collection-bootstrap";
import {
  DATA_OBJECTLABOURRATES_COLLECTION,
  isDataObjectlabourratesMetaDocument,
} from "@/lib/firestore/data-objectlabourrates-collection";
import { fetchIncrementalLabourProductsRows } from "@/lib/google/fetch-incremental-labour-products-rows";
import { INCREMENTAL_LABOUR_PRODUCTS_DATA_START_ROW_1_BASED } from "@/lib/google/parse-incremental-labour-products";
import { dataLabourRateKey } from "@/lib/data-labour-rate-key";

const WRITE_BATCH_SIZE = 400;

export type ImportObjectLabourRatesResult = {
  tabTitle: string;
  range: string;
  headerRow1Based: number;
  dataStartRow1Based: number;
  parsed: number;
  created: number;
  updated: number;
  parseErrors: string[];
};

function rowPayload(
  row: Awaited<ReturnType<typeof fetchIncrementalLabourProductsRows>>["rows"][number],
  now: ReturnType<typeof FieldValue.serverTimestamp>,
) {
  return {
    category: row.category,
    productType: row.productType,
    product: row.product,
    constructionAssistant: row.constructionAssistant,
    leadContractor: row.leadContractor,
    electrician: row.electrician,
    plumber: row.plumber,
    uom: row.uom,
    comments: row.comments,
    sheetRow: row.sheetRow,
    importedAt: now,
    updatedAt: now,
  };
}

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
  const existingByKey = new Map<string, string>();
  for (const doc of snap.docs) {
    if (isDataObjectlabourratesMetaDocument(doc.id)) continue;
    const data = doc.data();
    const key = dataLabourRateKey(
      String(data.category ?? ""),
      String(data.productType ?? ""),
      String(data.product ?? ""),
    );
    existingByKey.set(key, doc.id);
  }

  const now = FieldValue.serverTimestamp();
  let created = 0;
  let updated = 0;

  for (let i = 0; i < fetched.rows.length; i += WRITE_BATCH_SIZE) {
    const chunk = fetched.rows.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();

    for (const row of chunk) {
      const key = dataLabourRateKey(row.category, row.productType, row.product);
      const existingId = existingByKey.get(key);
      const data = rowPayload(row, now);

      if (existingId) {
        const ref = db.collection(DATA_OBJECTLABOURRATES_COLLECTION).doc(existingId);
        batch.update(ref, data);
        updated++;
      } else {
        const ref = db.collection(DATA_OBJECTLABOURRATES_COLLECTION).doc();
        batch.set(ref, {
          ...data,
          createdAt: now,
        });
        existingByKey.set(key, ref.id);
        created++;
      }
    }

    await batch.commit();
  }

  return {
    tabTitle: fetched.tabTitle,
    range: fetched.range,
    headerRow1Based: fetched.headerRow1Based,
    dataStartRow1Based: INCREMENTAL_LABOUR_PRODUCTS_DATA_START_ROW_1_BASED,
    parsed: fetched.rows.length,
    created,
    updated,
    parseErrors: fetched.errors,
  };
}
