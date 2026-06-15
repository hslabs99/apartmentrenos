import { z } from "zod";

/** Legacy stored type; template areas use the `areas` collection — do not add new Area lookups. */
export const LOOKUP_TYPE_AREA = "Area";
export const LOOKUP_TYPE_OBJECT_CATEGORY = "ObjectCategory";
export const LOOKUP_TYPE_RELATIONSHIP_TYPE = "RelationshipType";
export const LOOKUP_TYPE_TRADES = "Trades";
export const LOOKUP_TYPE_STYLE = "Style";
export const LOOKUP_TYPE_UOM = "UOM";
export const LOOKUP_TYPE_NOTE_TYPES = "NoteTypes";

/** Types allowed when creating a lookup (API + “New lookup” UI). */
export const CREATABLE_LOOKUP_TYPES = [
  LOOKUP_TYPE_OBJECT_CATEGORY,
  LOOKUP_TYPE_RELATIONSHIP_TYPE,
  LOOKUP_TYPE_TRADES,
  LOOKUP_TYPE_STYLE,
  LOOKUP_TYPE_UOM,
  LOOKUP_TYPE_NOTE_TYPES,
] as const;

/** Types that may exist in the DB or be selected when editing (includes legacy Area). */
export const APPROVED_LOOKUP_TYPES = [
  LOOKUP_TYPE_AREA,
  LOOKUP_TYPE_OBJECT_CATEGORY,
  LOOKUP_TYPE_RELATIONSHIP_TYPE,
  LOOKUP_TYPE_TRADES,
  LOOKUP_TYPE_STYLE,
  LOOKUP_TYPE_UOM,
  LOOKUP_TYPE_NOTE_TYPES,
] as const;

export type ApprovedLookupType = (typeof APPROVED_LOOKUP_TYPES)[number];

export const lookupTypeCreateSchema = z.enum([
  "ObjectCategory",
  "RelationshipType",
  "Trades",
  "Style",
  "UOM",
  "NoteTypes",
]);
/** PATCH may set legacy Area when updating old rows. */
export const lookupTypeUpdateSchema = z.enum([
  "Area",
  "ObjectCategory",
  "RelationshipType",
  "Trades",
  "Style",
  "UOM",
  "NoteTypes",
]);
