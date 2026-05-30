import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { blindsPriceDocId, blindsTypeSlug } from "@/lib/google/blinds-type-slug";
import { blindPricesToFirestoreFields } from "@/lib/google/parse-blinds-matrix";
import { fetchBlindsWorkbook } from "@/lib/google/fetch-blinds-workbook";
import { BLINDS_PRICES_SPREADSHEET_ID } from "@/lib/google/blinds-prices-spreadsheet";
import {
  ensureDataBlindsBootstrap,
  ensureDataBlindsFootersBootstrap,
  ensureDataBlindsTypesBootstrap,
} from "@/lib/firestore/collection-bootstrap";
import {
  DATA_BLINDS_COLLECTION,
  isDataBlindsMetaDocument,
} from "@/lib/firestore/data-blinds-collection";
import {
  DATA_BLINDS_FOOTERS_COLLECTION,
  isDataBlindsFootersMetaDocument,
} from "@/lib/firestore/data-blinds-footers-collection";
import {
  DATA_BLINDS_TYPES_COLLECTION,
  isDataBlindsTypesMetaDocument,
} from "@/lib/firestore/data-blinds-types-collection";
import {
  syncBlindsQuoteObjects,
  type SyncBlindsQuoteObjectsResult,
} from "@/lib/server/sync-blinds-quote-objects";

const WRITE_BATCH_SIZE = 400;
const DELETE_BATCH_SIZE = 500;

export type ImportDataBlindsTabSummary = {
  typeName: string;
  gid: number;
  range: string;
  headerRow1Based: number;
  priceRows: number;
  footers: number;
  warnings: string[];
  errors: string[];
};

export type ImportDataBlindsResult = {
  spreadsheetId: string;
  tabsScanned: number;
  matrixTabsImported: number;
  skippedTabs: { tabTitle: string; gid: number; reason: string }[];
  tabSummaries: ImportDataBlindsTabSummary[];
  writtenTypes: number;
  writtenPrices: number;
  writtenFooters: number;
  deletedTypesPrior: number;
  deletedPricesPrior: number;
  deletedFootersPrior: number;
  quoteObjects: SyncBlindsQuoteObjectsResult;
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

export async function runImportDataBlinds(
  db: Firestore,
  spreadsheetId: string = BLINDS_PRICES_SPREADSHEET_ID,
): Promise<ImportDataBlindsResult> {
  const fetched = await fetchBlindsWorkbook(spreadsheetId);

  if (fetched.matrixTabs.length === 0) {
    throw new Error(
      `No blind price matrix tabs found in workbook. Scanned ${fetched.tabs.length} tab(s); all skipped.`,
    );
  }

  const blockingErrors = fetched.matrixTabs.flatMap((t) =>
    t.parse.errors.length > 0
      ? t.parse.errors.map((e) => `${t.tab.tabTitle}: ${e}`)
      : [],
  );
  if (blockingErrors.length > 0) {
    throw new Error(blockingErrors.slice(0, 8).join(" "));
  }

  await ensureDataBlindsBootstrap(db);
  await ensureDataBlindsTypesBootstrap(db);
  await ensureDataBlindsFootersBootstrap(db);

  const deletedTypesPrior = await clearCollection(
    db,
    DATA_BLINDS_TYPES_COLLECTION,
    isDataBlindsTypesMetaDocument,
  );
  const deletedPricesPrior = await clearCollection(
    db,
    DATA_BLINDS_COLLECTION,
    isDataBlindsMetaDocument,
  );
  const deletedFootersPrior = await clearCollection(
    db,
    DATA_BLINDS_FOOTERS_COLLECTION,
    isDataBlindsFootersMetaDocument,
  );

  const now = FieldValue.serverTimestamp();
  let writtenTypes = 0;
  let writtenPrices = 0;
  let writtenFooters = 0;
  const tabSummaries: ImportDataBlindsTabSummary[] = [];

  for (const tabData of fetched.matrixTabs) {
    const { tab, range, parse, typeMeta, priceRows, footers } = tabData;
    const typeName = tab.tabTitle;
    const typeSlug = blindsTypeSlug(typeName);

    if (typeMeta) {
      const typeRef = db.collection(DATA_BLINDS_TYPES_COLLECTION).doc(typeSlug);
      await typeRef.set({
        ...typeMeta,
        importedAt: now,
        updatedAt: now,
      });
      writtenTypes++;
    }

    for (let i = 0; i < priceRows.length; i += WRITE_BATCH_SIZE) {
      const chunk = priceRows.slice(i, i + WRITE_BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        const docId = blindsPriceDocId(typeName, row.dropMm);
        const ref = db.collection(DATA_BLINDS_COLLECTION).doc(docId);
        batch.set(ref, {
          type: typeName,
          typeSlug,
          dropMm: row.dropMm,
          ...blindPricesToFirestoreFields(row.prices),
          minChainDropMm: row.minChainDropMm,
          sourceSheetRow: row.sheetRow,
          importedAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
      writtenPrices += chunk.length;
    }

    for (let i = 0; i < footers.length; i += WRITE_BATCH_SIZE) {
      const chunk = footers.slice(i, i + WRITE_BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        const ref = db.collection(DATA_BLINDS_FOOTERS_COLLECTION).doc();
        batch.set(ref, {
          type: row.type,
          typeSlug: row.typeSlug,
          sortOrder: row.sortOrder,
          noteText: row.noteText,
          impactPct: row.impactPct,
          sourceSheetRow: row.sourceSheetRow,
          importedAt: now,
        });
      }
      await batch.commit();
      writtenFooters += chunk.length;
    }

    tabSummaries.push({
      typeName,
      gid: tab.gid,
      range,
      headerRow1Based: parse.headerRow1Based,
      priceRows: priceRows.length,
      footers: footers.length,
      warnings: parse.warnings,
      errors: parse.errors,
    });
  }

  const typeNames = fetched.matrixTabs.map((t) => t.tab.tabTitle);
  const quoteObjects = await syncBlindsQuoteObjects(db, typeNames);

  return {
    spreadsheetId,
    tabsScanned: fetched.tabs.length,
    matrixTabsImported: fetched.matrixTabs.length,
    skippedTabs: fetched.skippedTabs,
    tabSummaries,
    writtenTypes,
    writtenPrices,
    writtenFooters,
    deletedTypesPrior,
    deletedPricesPrior,
    deletedFootersPrior,
    quoteObjects,
  };
}

