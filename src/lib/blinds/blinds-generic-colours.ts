/** Placeholder colours until supplier colour lists are wired for blinds. */
export const BLIND_GENERIC_COLOURS = [
  "White",
  "Ivory",
  "Charcoal",
  "Natural",
  "Black",
  "Grey",
  "Beige",
] as const;

export type BlindGenericColour = (typeof BLIND_GENERIC_COLOURS)[number];
