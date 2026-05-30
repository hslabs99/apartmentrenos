import { type DocumentData, type Firestore } from "firebase-admin/firestore";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import type { ProjectPublic } from "@/types/project";

/** Above this many projects, one full scan of `projectareas` is cheaper than N count queries. */
const COUNT_QUERY_THRESHOLD = 50;
const COUNT_CHUNK = 24;

/**
 * Count docs matching `projectid`. Prefers aggregate `.count()` when the Admin/Firestore
 * version supports it (firebase-admin 11+); otherwise falls back to `.get().size` (older SDKs).
 */
async function countProjectAreasForProjectId(
  db: Firestore,
  projectid: number,
): Promise<number> {
  const q = db.collection("projectareas").where("projectid", "==", projectid);
  type QueryWithOptionalCount = {
    count?: () => { get: () => Promise<{ data: () => { count: number } }> };
  };
  const maybe = q as unknown as QueryWithOptionalCount;
  if (typeof maybe.count === "function") {
    const snap = await maybe.count().get();
    return snap.data().count;
  }
  const snap = await q.get();
  return snap.size;
}

/**
 * Maps each project document id to its number of rows in `projectareas`
 * (excluding collection meta).
 */
export async function areaCountsByProjectDocId(
  db: Firestore,
  projects: ProjectPublic[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const p of projects) counts.set(p.id, 0);

  const withNumericId = projects.filter(
    (p): p is ProjectPublic & { projectid: number } =>
      typeof p.projectid === "number" && Number.isInteger(p.projectid),
  );

  if (withNumericId.length === 0) return counts;

  if (withNumericId.length > COUNT_QUERY_THRESHOLD) {
    const paSnap = await db.collection("projectareas").get();
    const byPid = new Map<number, number>();
    for (const d of paSnap.docs) {
      if (isProjectAreasMetaDocument(d.id)) continue;
      const pid = Number((d.data() as DocumentData).projectid);
      if (!Number.isInteger(pid)) continue;
      byPid.set(pid, (byPid.get(pid) ?? 0) + 1);
    }
    for (const p of withNumericId) {
      counts.set(p.id, byPid.get(p.projectid) ?? 0);
    }
    return counts;
  }

  for (let i = 0; i < withNumericId.length; i += COUNT_CHUNK) {
    const chunk = withNumericId.slice(i, i + COUNT_CHUNK);
    await Promise.all(
      chunk.map(async (p) => {
        const n = await countProjectAreasForProjectId(db, p.projectid);
        counts.set(p.id, n);
      }),
    );
  }

  return counts;
}
