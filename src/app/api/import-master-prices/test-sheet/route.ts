import { NextResponse } from "next/server";
import {
  MASTER_PRICES_SKU_TAB_TITLE,
  MASTER_PRICES_SPREADSHEET_ID,
  masterPricesSpreadsheetEditUrl,
} from "@/lib/google/master-prices-spreadsheet";
import { resolveSkuImportSheetTab } from "@/lib/google/resolve-sheet-tab";
import { getSheetsApiClient } from "@/lib/google/sheets-client";

export const runtime = "nodejs";

function serializeError(err: unknown): Record<string, unknown> {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const out: Record<string, unknown> = {
      name: typeof e.name === "string" ? e.name : "Error",
      message: typeof e.message === "string" ? e.message : String(err),
    };
    if (typeof e.code === "string" || typeof e.code === "number") {
      out.code = e.code;
    }
    if (typeof e.status === "number") out.status = e.status;
    if (e.errors != null) out.errors = e.errors;
    if (e.response && typeof e.response === "object") {
      const res = e.response as Record<string, unknown>;
      if (res.data != null) out.responseData = res.data;
      if (typeof res.status === "number") out.responseStatus = res.status;
      if (typeof res.statusText === "string") out.responseStatusText = res.statusText;
    }
    if (typeof e.stack === "string") out.stack = e.stack;
    return out;
  }
  return { message: String(err) };
}

/**
 * GET — test Google Sheets API access and list workbook tabs with debug metadata.
 */
export async function GET() {
  const started = Date.now();
  const spreadsheetId = MASTER_PRICES_SPREADSHEET_ID;
  let importTab: Awaited<ReturnType<typeof resolveSkuImportSheetTab>>;
  try {
    importTab = await resolveSkuImportSheetTab(spreadsheetId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import tab not found";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        spreadsheet: { id: spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` },
        requiredTabTitle: MASTER_PRICES_SKU_TAB_TITLE,
        debug: { step: "resolve_import_tab_failed" },
        hint: `Create or rename a tab to exactly "${MASTER_PRICES_SKU_TAB_TITLE}".`,
      },
      { status: 404 },
    );
  }

  const requestedGid = importTab.gid;
  const spreadsheetUrl = masterPricesSpreadsheetEditUrl(requestedGid);

  const debug: Record<string, unknown> = {
    spreadsheetId,
    requestedGid,
    spreadsheetUrl,
    nextPublicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    steps: [] as string[],
  };

  try {
    debug.steps = [...(debug.steps as string[]), "load_service_account"];
    const { sheets, loaded } = getSheetsApiClient();
    debug.credentialSource = loaded.source;
    debug.serviceAccountEmail = loaded.clientEmail;
    debug.serviceAccountProjectId = loaded.projectId;
    if (loaded.resolvedPath) debug.serviceAccountPath = loaded.resolvedPath;

    debug.steps = [...(debug.steps as string[]), "spreadsheets_get"];
    const t0 = Date.now();
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });
    debug.spreadsheetsGetMs = Date.now() - t0;

    const data = res.data;
    const title = data.properties?.title ?? null;
    const locale = data.properties?.locale ?? null;
    const timeZone = data.properties?.timeZone ?? null;

    const sheetList = (data.sheets ?? []).map((s, index) => {
      const props = s.properties;
      const sheetId = props?.sheetId ?? null;
      const sheetTitle = props?.title ?? "(untitled)";
      const grid = props?.gridProperties;
      return {
        index,
        title: sheetTitle,
        sheetId,
        gid: sheetId,
        rowCount: grid?.rowCount ?? null,
        columnCount: grid?.columnCount ?? null,
        hidden: props?.hidden === true,
        tabColor: props?.tabColor ?? null,
        editUrl:
          sheetId != null ? masterPricesSpreadsheetEditUrl(sheetId) : null,
        matchesRequestedGid:
          sheetId === requestedGid ||
          sheetTitle.trim() === MASTER_PRICES_SKU_TAB_TITLE,
      };
    });

    const matchedTab = sheetList.find((s) => s.matchesRequestedGid) ?? null;

    debug.steps = [...(debug.steps as string[]), "success"];
    debug.totalMs = Date.now() - started;
    debug.sheetCount = sheetList.length;

    return NextResponse.json({
      ok: true,
      spreadsheet: {
        id: spreadsheetId,
        title,
        locale,
        timeZone,
        url: spreadsheetUrl,
      },
      requestedGid,
      matchedTab,
      sheets: sheetList,
      debug,
      hint:
        "Share the spreadsheet with the service account email as Viewer if you see 403 PERMISSION_DENIED.",
    });
  } catch (err) {
    debug.steps = [...(debug.steps as string[]), "error"];
    debug.totalMs = Date.now() - started;
    const serialized = serializeError(err);
    debug.error = serialized;

    const message =
      typeof serialized.message === "string"
        ? serialized.message
        : "Failed to access Google Sheet";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        spreadsheet: {
          id: spreadsheetId,
          url: spreadsheetUrl,
        },
        requestedGid,
        debug,
        hint:
          "Share the spreadsheet with firebase-adminsdk-fbsvc@apartmentrenos-1575e.iam.gserviceaccount.com (or your service account client_email) as Viewer. Ensure Google Sheets API is enabled in GCP.",
      },
      { status: 500 },
    );
  }
}
