import type { SettingPublic } from "@/types/setting";

/** Last-resort width (m) when the setting is missing or invalid. */
export const DEFAULT_LM_RUNS_ROLL_WIDTH_M = 3.2;

/** Protected System → Settings key: default carpet / LM-Runs roll width in metres. */
export const LM_RUNS_ROLL_WIDTH_SETTING_KEY = "lmRunsRollWidth";

export function isLmRunsRollWidthSettingKey(name: string): boolean {
  return name.trim().toLowerCase() === LM_RUNS_ROLL_WIDTH_SETTING_KEY.toLowerCase();
}

/** Parse stored metres: "3.2", " 3.66 " → number; invalid → default. */
export function parseLmRunsRollWidthM(raw: string | undefined | null): number {
  if (raw == null || !String(raw).trim()) return DEFAULT_LM_RUNS_ROLL_WIDTH_M;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LM_RUNS_ROLL_WIDTH_M;
  return n;
}

/** Roll width (m) from settings rows (first `lmRunsRollWidth`, case-insensitive). */
export function lmRunsRollWidthMFromSettings(settings: SettingPublic[]): number {
  const row = settings.find((s) => isLmRunsRollWidthSettingKey(s.settingname));
  return parseLmRunsRollWidthM(row?.settingvalue);
}

/**
 * Quote-object `runWidth` wins when set; otherwise the settings (or hardcoded) fallback.
 */
export function effectiveLmRunsRollWidthM(
  objectRunWidth: number | null | undefined,
  settingsFallback: number = DEFAULT_LM_RUNS_ROLL_WIDTH_M,
): number {
  if (objectRunWidth != null && Number.isFinite(objectRunWidth) && objectRunWidth > 0) {
    return objectRunWidth;
  }
  if (Number.isFinite(settingsFallback) && settingsFallback > 0) return settingsFallback;
  return DEFAULT_LM_RUNS_ROLL_WIDTH_M;
}
