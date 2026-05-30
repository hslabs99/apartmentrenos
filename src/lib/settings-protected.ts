import { isMarginSettingKey } from "@/lib/settings-margin";
import { isLoadRateSettingKey } from "@/lib/settings-load-rates";

/** Margin and load-rate rows are seeded and cannot be renamed or deleted from the UI. */
export function isProtectedSettingKey(name: string): boolean {
  return isMarginSettingKey(name) || isLoadRateSettingKey(name);
}
