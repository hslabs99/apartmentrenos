import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureSettingsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isSettingsMetaDocument } from "@/lib/firestore/settings-collection";
import { dedupeSettingsByNormalizedName } from "@/lib/server/settings-dedupe";
import { LOAD_RATE_SETTING_KEYS } from "@/lib/settings-load-rates";

export const runtime = "nodejs";

const SEED: { name: string; value: string }[] = [
  { name: "margin", value: "20" },
  { name: LOAD_RATE_SETTING_KEYS.general, value: "0" },
  { name: LOAD_RATE_SETTING_KEYS.plumbing, value: "0" },
  { name: LOAD_RATE_SETTING_KEYS.elec, value: "0" },
  { name: LOAD_RATE_SETTING_KEYS.pm, value: "0" },
];

/**
 * Idempotent: ensures `settings` exists, seeds margin + load-rate rows if missing (inside a
 * transaction so parallel calls cannot double-seed), then removes duplicate rows per normalized name.
 */
export async function POST() {
  try {
    const db = getAdminFirestore();
    await ensureSettingsBootstrap(db);

    let seededInTxn = 0;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(db.collection("settings"));
      const existingNames = new Set<string>();
      for (const d of snap.docs) {
        if (isSettingsMetaDocument(d.id)) continue;
        const n = String(d.data().settingname ?? "").trim().toLowerCase();
        if (n) existingNames.add(n);
      }

      for (const { name, value } of SEED) {
        const key = name.toLowerCase();
        if (existingNames.has(key)) continue;
        const ref = db.collection("settings").doc();
        transaction.set(ref, {
          settingname: name,
          settingvalue: value,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        existingNames.add(key);
        seededInTxn += 1;
      }
    });

    const deduped = await dedupeSettingsByNormalizedName(db);

    return NextResponse.json({
      created: seededInTxn > 0 || deduped.removed > 0,
      seededCount: seededInTxn,
      duplicatesRemoved: deduped.removed,
      namesNormalized: deduped.normalized,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to initialize settings collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
