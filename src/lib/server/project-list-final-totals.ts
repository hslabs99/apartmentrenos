import { type DocumentData, type Firestore } from "firebase-admin/firestore";
import { lineFinalPrice } from "@/lib/client/line-final-price";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { isSettingsMetaDocument } from "@/lib/firestore/settings-collection";
import { docToProjectAreaObjectPublic } from "@/lib/server/project-area-object-doc";
import { loadAllContractLabourRates } from "@/lib/server/labour-hours";
import { marginPercentFromSettings } from "@/lib/settings-margin";
import type { ProjectPublic } from "@/types/project";
import type { SettingPublic } from "@/types/setting";

async function loadMarginPercent(db: Firestore): Promise<number> {
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
  return marginPercentFromSettings(settings);
}

/**
 * Checklist-facing project totals (material + labour × settings margin %).
 * Matches Check List “Total price” / project total — no workbench painting site fee.
 */
export async function finalTotalsByProjectDocId(
  db: Firestore,
  projects: ProjectPublic[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  for (const p of projects) totals.set(p.id, 0);

  const withNumericId = projects.filter(
    (p): p is ProjectPublic & { projectid: number } =>
      typeof p.projectid === "number" && Number.isInteger(p.projectid),
  );
  if (withNumericId.length === 0) return totals;

  const projectDocIdByNumericId = new Map<number, string>();
  for (const p of withNumericId) {
    projectDocIdByNumericId.set(p.projectid, p.id);
  }

  const [marginPct, contractLabourRates, objSnap] = await Promise.all([
    loadMarginPercent(db),
    loadAllContractLabourRates(db),
    db.collection("projectareaobjects").get(),
  ]);

  const sumByNumericId = new Map<number, number>();
  for (const d of objSnap.docs) {
    if (isProjectAreaObjectsMetaDocument(d.id)) continue;
    const data = d.data() as DocumentData;
    const projectid = Number(data.projectid);
    if (!Number.isInteger(projectid) || !projectDocIdByNumericId.has(projectid)) continue;
    const row = docToProjectAreaObjectPublic(d.id, data);
    const f = lineFinalPrice(
      row,
      marginPct,
      undefined,
      undefined,
      undefined,
      contractLabourRates,
    );
    if (f == null || !Number.isFinite(f)) continue;
    sumByNumericId.set(projectid, (sumByNumericId.get(projectid) ?? 0) + f);
  }

  for (const p of withNumericId) {
    const raw = sumByNumericId.get(p.projectid) ?? 0;
    totals.set(p.id, Math.round(raw * 100) / 100);
  }

  return totals;
}
