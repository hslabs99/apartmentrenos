import { type DocumentData, Timestamp } from "firebase-admin/firestore";
import type { ProjectNotePublic } from "@/types/project-note";

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isInteger(v)) return v;
  return null;
}

function readTrades(data: DocumentData): string[] {
  const raw = data.trades;
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) out.push(item.trim());
    }
    if (out.length > 0) return out;
  }
  const legacy = data.trade;
  if (typeof legacy === "string" && legacy.trim()) return [legacy.trim()];
  return [];
}

export function projectNoteDocToPublic(id: string, data: DocumentData): ProjectNotePublic {
  const notedAt = data.notedatetime ?? data.createdAt;
  return {
    id,
    noteid: Number(data.noteid ?? 0),
    notedatetime: tsToIso(notedAt as Timestamp | undefined),
    projectid: Number(data.projectid ?? 0),
    areaid: intOrNull(data.areaid),
    objectid: intOrNull(data.objectid),
    notetype: String(data.notetype ?? ""),
    trades: readTrades(data),
    author: String(data.author ?? ""),
    note: String(data.note ?? ""),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
