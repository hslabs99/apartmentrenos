import type { DataObject } from "@/types/data-object";

export type DataObjectPublic = DataObject & {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
