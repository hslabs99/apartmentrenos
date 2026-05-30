/** Known system scope types — extend as new rule sets are added. */
export const SYSTEM_SCOPE_TYPES = ["Blinds"] as const;

export type SystemScopeType = (typeof SYSTEM_SCOPE_TYPES)[number];

export const DEFAULT_SYSTEM_SCOPE_TYPE: SystemScopeType = "Blinds";

export const SYSTEM_SCOPE_OBJECT_PREFIX = "System:";

export function systemScopeObjectId(type: SystemScopeType): string {
  return `${SYSTEM_SCOPE_OBJECT_PREFIX}${type}`;
}

export function isSystemScopeObjectId(id: string): boolean {
  const trimmed = id.trim();
  if (!trimmed.startsWith(SYSTEM_SCOPE_OBJECT_PREFIX)) return false;
  const type = trimmed.slice(SYSTEM_SCOPE_OBJECT_PREFIX.length);
  return isSystemScopeType(type);
}

export function parseSystemScopeObjectId(id: string): SystemScopeType | null {
  if (!isSystemScopeObjectId(id)) return null;
  return id.trim().slice(SYSTEM_SCOPE_OBJECT_PREFIX.length) as SystemScopeType;
}

export function systemScopeObjectLabel(id: string): string {
  return id.trim();
}

export function isSystemScopeType(value: string): value is SystemScopeType {
  return (SYSTEM_SCOPE_TYPES as readonly string[]).includes(value);
}

export function normalizeSystemScopeFields(input: {
  systemScope?: boolean | null;
  systemScopeType?: string | null;
}): { systemScope: boolean; systemScopeType: SystemScopeType | null } {
  const systemScope = input.systemScope === true;
  if (!systemScope) {
    return { systemScope: false, systemScopeType: null };
  }
  const raw = typeof input.systemScopeType === "string" ? input.systemScopeType.trim() : "";
  if (isSystemScopeType(raw)) {
    return { systemScope: true, systemScopeType: raw };
  }
  return { systemScope: true, systemScopeType: DEFAULT_SYSTEM_SCOPE_TYPE };
}

export function readSystemScopeFromFirestore(data: Record<string, unknown>): {
  systemScope: boolean;
  systemScopeType: SystemScopeType | null;
} {
  return normalizeSystemScopeFields({
    systemScope: data.systemScope === true,
    systemScopeType:
      typeof data.systemScopeType === "string" ? data.systemScopeType : null,
  });
}
