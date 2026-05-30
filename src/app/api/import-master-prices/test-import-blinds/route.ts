import { NextResponse } from "next/server";
import {
  BLINDS_PRICES_SPREADSHEET_ID,
  blindsPricesSpreadsheetEditUrl,
} from "@/lib/google/blinds-prices-spreadsheet";
import { summarizeBlindsWorkbookForTest } from "@/lib/google/fetch-blinds-workbook";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET — quick tab scan + drop/footer counts (no Firestore). */
export async function GET() {
  try {
    const summary = await summarizeBlindsWorkbookForTest();
    return NextResponse.json({
      ok: true,
      spreadsheetId: BLINDS_PRICES_SPREADSHEET_ID,
      url: blindsPricesSpreadsheetEditUrl(),
      tabsScanned: summary.tabsScanned,
      matrixTabs: summary.matrixTabs,
      skippedTabs: summary.skippedTabs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to test blinds import";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
