import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { isSettingsMetaDocument } from "@/lib/firestore/settings-collection";
import { LOAD_RATE_SETTING_KEYS } from "@/lib/settings-load-rates";

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

/** Canonical `settingname` for known protected keys (fixes casing drift). */
function canonicalSettingName(norm: string): string | null {
  const map: Record<string, string> = {
    margin: "margin",
    [LOAD_RATE_SETTING_KEYS.general.toLowerCase()]: LOAD_RATE_SETTING_KEYS.general,
    [LOAD_RATE_SETTING_KEYS.plumbing.toLowerCase()]: LOAD_RATE_SETTING_KEYS.plumbing,
    [LOAD_RATE_SETTING_KEYS.elec.toLowerCase()]: LOAD_RATE_SETTING_KEYS.elec,
    [LOAD_RATE_SETTING_KEYS.pm.toLowerCase()]: LOAD_RATE_SETTING_KEYS.pm,
  };
  return map[norm] ?? null;
}

function updatedAtMs(data: DocumentData): number {
  const u = data.updatedAt as { toDate?: () => Date } | undefined;
  const c = data.createdAt as { toDate?: () => Date } | undefined;
  const t = u?.toDate?.() ?? c?.toDate?.();
  return t ? t.getTime() : 0;
}

/**
 * Removes extra documents that share the same normalized `settingname`, keeps one
 * (newest `updatedAt`, then lexicographically smallest id). Optionally normalizes
 * `settingname` on the keeper to the canonical spelling for known keys.
 */
export async function dedupeSettingsByNormalizedName(
  db: Firestore,
): Promise<{ removed: number; normalized: number }> {
  const snap = await db.collection("settings").get();
  const groups = new Map<string, QueryDocumentSnapshot[]>();

  for (const d of snap.docs) {
    if (isSettingsMetaDocument(d.id)) continue;
    const raw = String(d.data().settingname ?? "").trim();
    const norm = normalizeName(raw);
    if (!norm) continue;
    const list = groups.get(norm) ?? [];
    list.push(d as QueryDocumentSnapshot);
    groups.set(norm, list);
  }

  let removed = 0;
  let normalized = 0;
  const toDelete: DocumentReference[] = [];
  const toNormalize: { ref: DocumentReference; name: string }[] = [];

  for (const [, docs] of groups) {
    if (docs.length <= 1) {
      const only = docs[0]!;
      const norm = normalizeName(String(only.data().settingname ?? ""));
      const canon = canonicalSettingName(norm);
      if (canon && String(only.data().settingname ?? "").trim() !== canon) {
        toNormalize.push({ ref: only.ref, name: canon });
      }
      continue;
    }

    const sorted = [...docs].sort((a, b) => {
      const ta = updatedAtMs(a.data());
      const tb = updatedAtMs(b.data());
      if (tb !== ta) return tb - ta;
      return a.id.localeCompare(b.id);
    });
    const keeper = sorted[0]!;
    const norm = normalizeName(String(keeper.data().settingname ?? ""));
    const canon = canonicalSettingName(norm);
    if (canon && String(keeper.data().settingname ?? "").trim() !== canon) {
      toNormalize.push({ ref: keeper.ref, name: canon });
    }
    for (let i = 1; i < sorted.length; i++) {
      toDelete.push(sorted[i]!.ref);
    }
  }

  const BATCH = 400;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const slice = toDelete.slice(i, i + BATCH);
    const batch = db.batch();
    for (const ref of slice) {
      batch.delete(ref);
    }
    await batch.commit();
    removed += slice.length;
  }

  for (const { ref, name } of toNormalize) {
    await ref.update({
      settingname: name,
      updatedAt: FieldValue.serverTimestamp(),
    });
    normalized += 1;
  }

  return { removed, normalized };
}
