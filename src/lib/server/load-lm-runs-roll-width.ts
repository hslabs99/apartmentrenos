import { type DocumentData, type Firestore } from "firebase-admin/firestore";
import { isSettingsMetaDocument } from "@/lib/firestore/settings-collection";
import { lmRunsRollWidthMFromSettings } from "@/lib/settings-lm-runs-roll-width";
import type { SettingPublic } from "@/types/setting";

/** One small settings-collection read; used when converting LM-Runs measures on the server. */
export async function loadLmRunsRollWidthMFromDb(db: Firestore): Promise<number> {
  const snap = await db.collection("settings").get();
  const settings: SettingPublic[] = snap.docs
    .filter((d) => !isSettingsMetaDocument(d.id))
    .map((d) => {
      const data = d.data() as DocumentData;
      return {
        id: d.id,
        settingname: String(data.settingname ?? ""),
        settingvalue: String(data.settingvalue ?? ""),
      };
    });
  return lmRunsRollWidthMFromSettings(settings);
}
