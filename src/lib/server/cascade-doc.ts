import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { CascadePublic } from "@/types/cascade-public";

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

export function cascadeDocToPublic(id: string, data: DocumentData): CascadePublic {
  return {
    id,
    level: parseText(data.level),
    style: parseText(data.style),
    colour: parseText(data.colour),
    sheetRow: typeof data.sheetRow === "number" ? data.sheetRow : 0,
    importedAt: tsToIso(data.importedAt as Timestamp | undefined),
  };
}
