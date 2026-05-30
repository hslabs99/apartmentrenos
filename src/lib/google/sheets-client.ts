import { google } from "googleapis";
import { loadServiceAccountCredentials } from "@/lib/server/service-account-credentials";

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export function getSheetsApiClient() {
  const loaded = loadServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: loaded.credentials,
    scopes: [SHEETS_READONLY_SCOPE],
  });
  return { sheets: google.sheets({ version: "v4", auth }), loaded };
}
