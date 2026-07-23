import { google } from "googleapis";
import {
  loadServiceAccountCredentials,
  type LoadedServiceAccount,
} from "@/lib/server/service-account-credentials";

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function isMissingExplicitCredentialsError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("FIREBASE_SERVICE_ACCOUNT_PATH") ||
    message.includes("FIREBASE_SERVICE_ACCOUNT_JSON")
  );
}

/** App Hosting runs on Cloud Run (`K_SERVICE`); ADC is available there. */
function isCloudRuntime(): boolean {
  return Boolean(
    process.env.K_SERVICE?.trim() ||
      process.env.CLOUD_RUN_JOB?.trim() ||
      process.env.FIREBASE_CONFIG?.trim(),
  );
}

function applicationDefaultLoaded(): LoadedServiceAccount {
  return {
    credentials: {},
    source: "application_default_credentials",
    clientEmail: null,
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
      process.env.GCLOUD_PROJECT?.trim() ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
      null,
  };
}

/**
 * Google Sheets API client.
 *
 * Prefers `FIREBASE_SERVICE_ACCOUNT_PATH` / `FIREBASE_SERVICE_ACCOUNT_JSON`.
 * On App Hosting / Cloud Run (no explicit key), falls back to Application Default
 * Credentials — share the spreadsheet with the App Hosting compute SA as Viewer.
 */
export function getSheetsApiClient() {
  try {
    const loaded = loadServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials: loaded.credentials,
      scopes: [SHEETS_READONLY_SCOPE],
    });
    return { sheets: google.sheets({ version: "v4", auth }), loaded };
  } catch (err) {
    if (!isMissingExplicitCredentialsError(err) || !isCloudRuntime()) {
      throw err;
    }

    const loaded = applicationDefaultLoaded();
    const auth = new google.auth.GoogleAuth({
      scopes: [SHEETS_READONLY_SCOPE],
    });
    return { sheets: google.sheets({ version: "v4", auth }), loaded };
  }
}
