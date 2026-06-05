import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  ensureDataSupplierDiscountRangesBootstrap,
  ensureDataSupplierDiscountsBootstrap,
} from "@/lib/firestore/collection-bootstrap";
import {
  DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION,
  isDataSupplierDiscountRangesMetaDocument,
} from "@/lib/firestore/data-supplier-discount-ranges-collection";
import {
  DATA_SUPPLIER_DISCOUNTS_COLLECTION,
  isDataSupplierDiscountsMetaDocument,
} from "@/lib/firestore/data-supplier-discounts-collection";
import { fetchSupplierDiscountsRows } from "@/lib/google/fetch-supplier-discounts-rows";

const WRITE_BATCH_SIZE = 400;
const DELETE_BATCH_SIZE = 500;

export type ImportSupplierDiscountsResult = {
  tabTitle: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  dataStartRow1Based: number;
  parsedSuppliers: number;
  writtenSuppliers: number;
  deletedSuppliersPrior: number;
  parsedRanges: number;
  writtenRanges: number;
  deletedRangesPrior: number;
  parseErrors: string[];
};

async function clearCollection(
  db: Firestore,
  collectionId: string,
  isMeta: (id: string) => boolean,
): Promise<number> {
  const snap = await db.collection(collectionId).get();
  const deleteRefs = snap.docs.filter((d) => !isMeta(d.id)).map((d) => d.ref);
  let deleted = 0;
  for (let i = 0; i < deleteRefs.length; i += DELETE_BATCH_SIZE) {
    const chunk = deleteRefs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = db.batch();
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

export async function runImportSupplierDiscounts(
  db: Firestore,
): Promise<ImportSupplierDiscountsResult> {
  const fetched = await fetchSupplierDiscountsRows();

  if (fetched.headerRow1Based === 0) {
    throw new Error(
      fetched.errors[0] ??
        `Could not find supplier discounts header row on "${fetched.tabTitle}" (${fetched.range}).`,
    );
  }

  if (fetched.ranges.length === 0) {
    throw new Error(
      `No range definitions found on "${fetched.tabTitle}" (expected $2,500–$9,999 on row ${fetched.headerRow1Based}).`,
    );
  }

  if (fetched.suppliers.length === 0) {
    const detail =
      fetched.errors.length > 0
        ? ` ${fetched.errors.slice(0, 5).join(" ")}`
        : " No supplier rows after the header.";
    throw new Error(`No supplier discounts to import from "${fetched.tabTitle}".${detail}`);
  }

  await ensureDataSupplierDiscountsBootstrap(db);
  await ensureDataSupplierDiscountRangesBootstrap(db);

  const deletedRangesPrior = await clearCollection(
    db,
    DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION,
    isDataSupplierDiscountRangesMetaDocument,
  );
  const deletedSuppliersPrior = await clearCollection(
    db,
    DATA_SUPPLIER_DISCOUNTS_COLLECTION,
    isDataSupplierDiscountsMetaDocument,
  );

  const now = FieldValue.serverTimestamp();
  let writtenRanges = 0;

  const rangeBatch = db.batch();
  for (const row of fetched.ranges) {
    const ref = db
      .collection(DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION)
      .doc(String(row.rangeName));
    rangeBatch.set(ref, {
      rangeName: row.rangeName,
      discount: row.discount,
      importedAt: now,
      updatedAt: now,
    });
    writtenRanges++;
  }
  await rangeBatch.commit();

  let writtenSuppliers = 0;
  for (let i = 0; i < fetched.suppliers.length; i += WRITE_BATCH_SIZE) {
    const chunk = fetched.suppliers.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      const ref = db.collection(DATA_SUPPLIER_DISCOUNTS_COLLECTION).doc();
      batch.set(ref, {
        supplier: row.supplier,
        default: row.default,
        range1: row.range1,
        range2: row.range2,
        range3: row.range3,
        range4: row.range4,
        ...(row.comment ? { comment: row.comment } : {}),
        sheetRow: row.sheetRow,
        importedAt: now,
      });
    }
    await batch.commit();
    writtenSuppliers += chunk.length;
  }

  return {
    tabTitle: fetched.tabTitle,
    gid: fetched.gid,
    range: fetched.range,
    headerRow1Based: fetched.headerRow1Based,
    dataStartRow1Based: fetched.dataStartRow1Based,
    parsedSuppliers: fetched.suppliers.length,
    writtenSuppliers,
    deletedSuppliersPrior,
    parsedRanges: fetched.ranges.length,
    writtenRanges,
    deletedRangesPrior,
    parseErrors: fetched.errors,
  };
}
