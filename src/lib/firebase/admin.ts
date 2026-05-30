import { existsSync, readFileSync } from "fs";
import { join, isAbsolute } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "apartmentrenos-1575e";

function assertServiceAccountProject(parsed: Record<string, unknown>) {
  const saProject = parsed.project_id;
  if (typeof saProject !== "string" || !saProject) return;
  if (saProject !== PROJECT_ID) {
    throw new Error(
      `Firebase Admin service account is for project "${saProject}" but NEXT_PUBLIC_FIREBASE_PROJECT_ID is "${PROJECT_ID}". ` +
        `Download a new private key from Firebase Console → Project settings → Service accounts for **${PROJECT_ID}**, ` +
        `or set NEXT_PUBLIC_FIREBASE_* to match the project in your service account JSON.`,
    );
  }
}

function loadServiceAccountFromFile(): Record<string, unknown> | null {
  const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!rawPath) return null;
  const resolved = isAbsolute(rawPath)
    ? rawPath
    : join(process.cwd(), rawPath);
  if (!existsSync(resolved)) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_PATH: file not found at ${resolved}`,
    );
  }
  const json = readFileSync(resolved, "utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * Firestore Admin — used only on the server (API routes). Cloud Firestore only.
 */
function initAdminApp(): void {
  if (getApps().length) return;

  if (process.env.FIRESTORE_EMULATOR_HOST?.trim()) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is set, but this project uses cloud Firestore only. Remove it from .env.local and any shell profile.",
    );
  }

  const fromFile = loadServiceAccountFromFile();
  if (fromFile) {
    assertServiceAccountProject(fromFile);
    initializeApp({
      credential: cert(fromFile),
    });
    return;
  }

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (sa) {
    const parsed = JSON.parse(sa) as Record<string, unknown>;
    assertServiceAccountProject(parsed);
    initializeApp({
      credential: cert(parsed),
    });
    return;
  }

  try {
    initializeApp();
  } catch {
    throw new Error(
      "Firebase Admin: set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON for cloud Firestore.",
    );
  }
}

export function getAdminFirestore() {
  initAdminApp();
  return getFirestore();
}
