export type UserType = "sales" | "admin" | "management";

export const USER_TYPES: readonly UserType[] = ["sales", "admin", "management"];

export const USER_TYPE_LABELS: Record<UserType, string> = {
  sales: "Sales",
  admin: "Admin",
  management: "Management",
};

export function isUserType(value: unknown): value is UserType {
  return typeof value === "string" && (USER_TYPES as readonly string[]).includes(value);
}

/** Normalizes Firestore `type`; legacy `user` maps to sales until data is migrated. */
export function normalizeUserType(value: unknown): UserType {
  if (isUserType(value)) return value;
  return "sales";
}

/** Public user fields (never includes password hash). */
export type UserPublic = {
  id: string;
  username: string;
  email: string;
  phone: string;
  type: UserType;
  businessName?: string | null;
  relationshipTypeLookupId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
