import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import type { LookupPublic } from "@/types/lookup";

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

export function lookupDocToPublic(id: string, data: DocumentData): LookupPublic {
  return {
    id,
    lookupid: numOrNull(data.lookupid),
    lookuptype: String(data.lookuptype ?? ""),
    lookupvalue: String(data.lookupvalue ?? ""),
    notes: String(data.notes ?? ""),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
