import type { SettingPublic } from "@/types/setting";

/** Stored in `settings` collection; values are dollars per load unit (e.g. per minute). */
export const LOAD_RATE_SETTING_KEYS = {
  general: "loadRateGeneral",
  plumbing: "loadRatePlumbing",
  elec: "loadRateElec",
  pm: "loadRatePm",
  cntr: "loadRateCntr",
  assCntr: "loadRateAssCntr",
} as const;

export function isLoadRateSettingKey(name: string): boolean {
  const t = name.trim().toLowerCase();
  return (
    t === LOAD_RATE_SETTING_KEYS.general.toLowerCase() ||
    t === LOAD_RATE_SETTING_KEYS.plumbing.toLowerCase() ||
    t === LOAD_RATE_SETTING_KEYS.elec.toLowerCase() ||
    t === LOAD_RATE_SETTING_KEYS.pm.toLowerCase() ||
    t === LOAD_RATE_SETTING_KEYS.cntr.toLowerCase() ||
    t === LOAD_RATE_SETTING_KEYS.assCntr.toLowerCase()
  );
}

/** Parse stored dollar amount: "45", "$45.50", " 12.25 " → number; invalid → 0. */
export function parseLoadRateDollars(raw: string | undefined | null): number {
  if (raw == null || !String(raw).trim()) return 0;
  const t = String(raw).trim().replace(/^\$/u, "");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export type LoadRateDollars = {
  general: number;
  plumbing: number;
  elec: number;
  pm: number;
  cntr: number;
  assCntr: number;
};

export function loadRateDollarsFromSettings(settings: SettingPublic[]): LoadRateDollars {
  const pick = (key: string) => {
    const row = settings.find((s) => s.settingname.trim().toLowerCase() === key.toLowerCase());
    return parseLoadRateDollars(row?.settingvalue);
  };
  return {
    general: pick(LOAD_RATE_SETTING_KEYS.general),
    plumbing: pick(LOAD_RATE_SETTING_KEYS.plumbing),
    elec: pick(LOAD_RATE_SETTING_KEYS.elec),
    pm: pick(LOAD_RATE_SETTING_KEYS.pm),
    cntr: pick(LOAD_RATE_SETTING_KEYS.cntr),
    assCntr: pick(LOAD_RATE_SETTING_KEYS.assCntr),
  };
}
