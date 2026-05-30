export type UserType = "user" | "admin";

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
