import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import { parseScopeAnswersFromFirestore } from "@/lib/server/project-area-scope-answers";
import type { ProjectAreaPublic } from "@/types/project-area";

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function extraScopeDocIdsFromFirestore(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const ids = raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : undefined;
}

export function projectAreaDocToPublic(id: string, data: DocumentData): ProjectAreaPublic {
  const dnRaw = data.displayName;
  const displayName =
    typeof dnRaw === "string" && dnRaw.trim() ? dnRaw.trim() : null;
  return {
    id,
    projectid: Number(data.projectid ?? 0),
    areaid: Number(data.areaid ?? 0),
    displayName,
    sortOrder: numOrNull(data.sortOrder) ?? null,
    areanotes1: String(data.areanotes1 ?? ""),
    areanotes2: String(data.areanotes2 ?? ""),
    aream2: numOrNull(data.aream2),
    areafinish: String(data.areafinish ?? ""),
    pricelevelid: numOrNull(data.pricelevelid) ?? null,
    style: typeof data.style === "string" && data.style.trim() ? data.style.trim() : null,
    colour: typeof data.colour === "string" && data.colour.trim() ? data.colour.trim() : null,
    scopeAnswers: parseScopeAnswersFromFirestore(data.scopeAnswers),
    extraScopeDocIds: extraScopeDocIdsFromFirestore(data.extraScopeDocIds),
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
