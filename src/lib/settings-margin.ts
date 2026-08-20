import type { SettingPublic } from "@/types/setting";

const DEFAULT_MARGIN_PERCENT = 20;

/** True if this setting name is the reserved `margin` key (case-insensitive). */
export function isMarginSettingKey(name: string): boolean {
  return name.trim().toLowerCase() === "margin";
}

/** Parse stored margin value: "20", "20%", " 15 " → number; invalid → default. */
export function parseMarginPercent(raw: string | undefined | null): number {
  if (raw == null || !String(raw).trim()) return DEFAULT_MARGIN_PERCENT;
  const t = String(raw).trim().replace(/%$/u, "");
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MARGIN_PERCENT;
  return Math.min(n, 999);
}

/** Margin % from settings rows (first `margin`, case-insensitive). */
export function marginPercentFromSettings(settings: SettingPublic[]): number {
  const row = settings.find((s) => isMarginSettingKey(s.settingname));
  return parseMarginPercent(row?.settingvalue);
}

/**
 * Project-stored workbench margin, or `fallback` (typically settings) when unset.
 */
export function projectMarginPercent(
  stored: number | null | undefined,
  fallback: number,
): number {
  if (stored == null || !Number.isFinite(stored)) return fallback;
  return parseMarginPercent(String(stored));
}
