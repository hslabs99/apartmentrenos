import { existsSync, readFileSync } from "fs";
import { isAbsolute, join } from "path";

export type ServiceAccountCredentialSource =
  | "FIREBASE_SERVICE_ACCOUNT_PATH"
  | "FIREBASE_SERVICE_ACCOUNT_JSON"
  | "application_default_credentials";

export type LoadedServiceAccount = {
  credentials: Record<string, unknown>;
  source: ServiceAccountCredentialSource;
  /** Resolved path when source is FIREBASE_SERVICE_ACCOUNT_PATH. */
  resolvedPath?: string;
  clientEmail: string | null;
  projectId: string | null;
};

function parseServiceAccount(
  parsed: Record<string, unknown>,
  source: ServiceAccountCredentialSource,
  resolvedPath?: string,
): LoadedServiceAccount {
  const clientEmail =
    typeof parsed.client_email === "string" ? parsed.client_email : null;
  const projectId =
    typeof parsed.project_id === "string" ? parsed.project_id : null;
  return { credentials: parsed, source, resolvedPath, clientEmail, projectId };
}

/**
 * Same env vars as Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_PATH` / `…_JSON`).
 */
export function loadServiceAccountCredentials(): LoadedServiceAccount {
  const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (rawPath) {
    const resolved = isAbsolute(rawPath)
      ? rawPath
      : join(process.cwd(), rawPath);
    if (!existsSync(resolved)) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_PATH: file not found at ${resolved}`,
      );
    }
    const json = readFileSync(resolved, "utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parseServiceAccount(
      parsed,
      "FIREBASE_SERVICE_ACCOUNT_PATH",
      resolved,
    );
  }

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (sa) {
    const parsed = JSON.parse(sa) as Record<string, unknown>;
    return parseServiceAccount(parsed, "FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  throw new Error(
    "Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON for Google Sheets API access.",
  );
}
