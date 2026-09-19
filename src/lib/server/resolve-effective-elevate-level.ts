import type { Firestore } from "firebase-admin/firestore";
import { resolveCascadeLevelName } from "@/lib/cascades/cascade-level-from-price-level";
import type { CascadeRow } from "@/lib/cascades/cascade-filter-options";
import {
  CASCADES_COLLECTION,
  isCascadesMetaDocument,
} from "@/lib/firestore/cascades-collection";
import { resolveEffectivePriceLevelId } from "@/lib/server/resolve-effective-price-level";
import { resolveElevateLevelFromPriceLevelId } from "@/lib/server/resolve-elevate-level-from-price-level";

let cachedCascadeRows: CascadeRow[] | null = null;

async function loadCascadeRows(db: Firestore): Promise<CascadeRow[]> {
  if (cachedCascadeRows) return cachedCascadeRows;
  const snap = await db.collection(CASCADES_COLLECTION).get();
  const rows: CascadeRow[] = [];
  for (const doc of snap.docs) {
    if (isCascadesMetaDocument(doc.id)) continue;
    const data = doc.data();
    rows.push({
      level: String(data.level ?? "").trim(),
      style: String(data.style ?? "").trim(),
      colour: String(data.colour ?? "").trim(),
    });
  }
  cachedCascadeRows = rows;
  return rows;
}

/** Clear in-process cascade cache (tests / after import). */
export function clearCascadeRowsCache(): void {
  cachedCascadeRows = null;
}

export function projectFinishFromData(projectData: { projectfinish?: unknown } | undefined): string {
  return typeof projectData?.projectfinish === "string" ? projectData.projectfinish.trim() : "";
}

/**
 * Elevate / cascade level from an already-resolved price level and project finish.
 * Loads cascades + price-level names (in-process cached after the first call).
 */
export async function resolveElevateLevelFromPriceLevelAndFinish(
  db: Firestore,
  priceLevelId: number | null,
  projectFinish: string,
): Promise<string> {
  const [cascades, fromPl] = await Promise.all([
    loadCascadeRows(db),
    resolveElevateLevelFromPriceLevelId(db, priceLevelId),
  ]);
  const raw = fromPl || projectFinish;
  if (!raw) return "";
  if (cascades.length > 0) return resolveCascadeLevelName(raw, cascades);
  return raw;
}

async function loadProjectFinish(db: Firestore, projectid: number): Promise<string> {
  const projQ = await db.collection("projects").where("projectid", "==", projectid).limit(1).get();
  return projectFinishFromData(projQ.docs[0]?.data());
}

/**
 * Effective elevate / cascade level for SKU filtering on the server — mirrors checklist
 * `effectiveElevateLevelForLine` (price level name resolved through cascade sheet).
 */
export async function resolveEffectiveElevateLevel(
  db: Firestore,
  projectAreaDocId: string,
  projectid: number,
): Promise<string> {
  const [priceLevelId, projectFinish] = await Promise.all([
    resolveEffectivePriceLevelId(db, projectAreaDocId, projectid),
    loadProjectFinish(db, projectid),
  ]);
  return resolveElevateLevelFromPriceLevelAndFinish(db, priceLevelId, projectFinish);
}
