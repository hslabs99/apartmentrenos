import type { DocumentData, Timestamp } from "firebase-admin/firestore";
import { buildLookupColourKey, type LookupColourKeyFields } from "@/lib/lookup-colour-key";
import type { LookupColourPublic } from "@/types/lookup-colour-public";

function tsToIso(t: Timestamp | undefined): string | null {
  if (!t) return null;
  return t.toDate().toISOString();
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function parseText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function canonicalLookupColourFields(
  fields: LookupColourKeyFields,
): LookupColourKeyFields {
  return {
    category: fields.category.trim() || "Colour",
    colourClass: fields.colourClass.trim(),
    descriptor: fields.descriptor.trim(),
  };
}

export function lookupColourKeyFromFields(fields: LookupColourKeyFields): string {
  return buildLookupColourKey(canonicalLookupColourFields(fields));
}

export function lookupColourDocToPublic(id: string, data: DocumentData): LookupColourPublic {
  const category = parseText(data.category) || "Colour";
  const colourClass = parseText(data.colourClass);
  const descriptor = parseText(data.descriptor);
  const notes = parseText(data.notes);
  const colourKey =
    parseText(data.colourKey) ||
    lookupColourKeyFromFields({ category, colourClass, descriptor });
  return {
    id,
    colourLookupId: numOrNull(data.colourLookupId) ?? 0,
    category,
    colourClass,
    descriptor,
    notes,
    colourKey,
    createdAt: tsToIso(data.createdAt as Timestamp | undefined),
    updatedAt: tsToIso(data.updatedAt as Timestamp | undefined),
  };
}
