import { isMarginSettingKey } from "@/lib/settings-margin";
import { isLoadRateSettingKey } from "@/lib/settings-load-rates";
import { isLmRunsRollWidthSettingKey } from "@/lib/settings-lm-runs-roll-width";

/** Seeded rows that cannot be renamed or deleted from the UI. */
export function isProtectedSettingKey(name: string): boolean {
  return (
    isMarginSettingKey(name) ||
    isLoadRateSettingKey(name) ||
    isLmRunsRollWidthSettingKey(name)
  );
}
