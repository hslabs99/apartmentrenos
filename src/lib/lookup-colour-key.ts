export type LookupColourKeyFields = {
  category: string;
  colourClass: string;
  descriptor: string;
};

export function normalizeLookupColourPart(value: string): string {
  return value.trim().toLowerCase();
}

export function buildLookupColourKey(fields: LookupColourKeyFields): string {
  return [
    normalizeLookupColourPart(fields.category),
    normalizeLookupColourPart(fields.colourClass),
    normalizeLookupColourPart(fields.descriptor),
  ].join("\x1e");
}
