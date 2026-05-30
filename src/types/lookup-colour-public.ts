import type { LookupColour } from "@/types/lookup-colour";

export type LookupColourPublic = LookupColour & {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
