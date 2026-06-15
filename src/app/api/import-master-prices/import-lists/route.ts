import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { MASTER_PRICES_LISTS_TAB_TITLE } from "@/lib/google/master-prices-spreadsheet";
import { runImportListsColours } from "@/lib/server/import-lists-colours";
import { runImportListsStyles } from "@/lib/server/import-lists-styles";
import { runImportListsUom } from "@/lib/server/import-lists-uom";
import { clearColourLookupIndexCache } from "@/lib/server/load-colour-lookup-index";
import { importRunIdFromError, runSupportingImportWithLog } from "@/lib/server/supporting-import-log";

export const runtime = "nodejs";

export async function POST() {
  const db = getAdminFirestore();
  try {
    const { importRunId, result } = await runSupportingImportWithLog(
      db,
      {
        kind: "supporting_lists",
        tabTitle: MASTER_PRICES_LISTS_TAB_TITLE,
        sheetRange: "A4:C150, M4:O16, O4:Q16",
      },
      async () => {
        const [styles, colours, uom] = await Promise.all([
          runImportListsStyles(db),
          runImportListsColours(db),
          runImportListsUom(db),
        ]);
        return { styles, colours, uom };
      },
      ({ styles, colours, uom }) => {
        const parsed = styles.parsed + colours.parsed + uom.parsed;
        const created = styles.created + colours.created + uom.created;
        const updated = styles.updated + colours.updated + uom.updated;
        const skipped = styles.skipped + colours.skipped + uom.skipped;
        return {
          tabTitle: styles.tabTitle,
          gid: styles.gid ?? colours.gid ?? uom.gid,
          sheetRange: `styles ${styles.range}; colours ${colours.range}; uom ${uom.range}`,
          rowsFound: parsed,
          blankRows: skipped,
          rowsImported: created + updated,
          rowsCreated: created,
          rowsUpdated: updated,
          deletedPrior: 0,
          warnings: [
            `Styles: ${styles.parsed} parsed, ${styles.created} created, ${styles.updated} updated, ${styles.skipped} skipped`,
            `Colours: ${colours.parsed} parsed, ${colours.created} created, ${colours.updated} updated, ${colours.skipped} skipped`,
            `UOM: ${uom.parsed} parsed, ${uom.created} created, ${uom.updated} updated, ${uom.skipped} skipped`,
          ],
        };
      },
    );
    const { styles, colours, uom } = result;
    clearColourLookupIndexCache();
    return NextResponse.json({
      ok: true,
      importRunId,
      styles,
      colours,
      uom,
      tabTitle: styles.tabTitle,
      range: styles.range,
      parsed: styles.parsed,
      created: styles.created,
      updated: styles.updated,
      skipped: styles.skipped,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import lists";
    return NextResponse.json(
      { error: message, importRunId: importRunIdFromError(e) },
      { status: 500 },
    );
  }
}
