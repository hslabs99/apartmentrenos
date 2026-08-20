import { z } from "zod";

export const numberOrNull = z.union([z.number(), z.null()]);

export const priceLevelRowSchema = z.object({
  pricelevelid: z.number().int(),
  uomprice: numberOrNull.optional(),
  totalprice: numberOrNull.optional(),
  spec1: z.string().optional().default(""),
  spec2: z.string().optional().default(""),
  spec3: z.string().optional().default(""),
});

export const quoteObjectCreateSchema = z.object({
  objectname: z.string().min(1).max(255),
  product: z.string().optional().default(""),
  objecttype: z.string().optional().default(""),
  category: z.string().optional().default(""),
  areaTagIds: z.array(z.string().min(1)).optional().default([]),
  uom: z.string().optional().default(""),
  inheritM2Source: z
    .enum([
      "none",
      "apartment_total_m2",
      "apartment_soft_m2",
      "apartment_hard_m2",
      "area_m2",
    ])
    .optional()
    .default("none"),
  /** Legacy boolean (kept for backwards compatibility); prefer `inheritM2Source`. */
  inheritAreaM2: z.boolean().optional().default(false),
  /** Roll width (m) for UOM LM-Runs; default 3.2 when omitted on create. */
  runWidth: numberOrNull.optional(),
  defaultAreaM2: numberOrNull.optional(),
  measurement: numberOrNull.optional(),
  priceLevelRows: z.array(priceLevelRowSchema).optional().default([]),
  generalHours: numberOrNull.optional(),
  projectManagerHours: numberOrNull.optional(),
  paintingHours: numberOrNull.optional(),
  plasteringHours: numberOrNull.optional(),
  notes1: z.string().optional().default(""),
  notes2: z.string().optional().default(""),
  tooltip: z.string().optional().default(""),
  promptForMulti: z.boolean().optional().default(false),
});

export const quoteObjectUpdateSchema = z.object({
  objectname: z.string().min(1).optional(),
  product: z.string().optional(),
  objecttype: z.string().optional(),
  category: z.string().optional(),
  areaTagIds: z.array(z.string().min(1)).optional(),
  uom: z.string().optional(),
  inheritM2Source: z.enum([
    "none",
    "apartment_total_m2",
    "apartment_soft_m2",
    "apartment_hard_m2",
    "area_m2",
  ]).optional(),
  /** Legacy boolean (kept for backwards compatibility); prefer `inheritM2Source`. */
  inheritAreaM2: z.boolean().optional(),
  runWidth: numberOrNull.optional(),
  defaultAreaM2: numberOrNull.optional(),
  measurement: numberOrNull.optional(),
  priceLevelRows: z.array(priceLevelRowSchema).optional(),
  generalHours: numberOrNull.optional(),
  projectManagerHours: numberOrNull.optional(),
  paintingHours: numberOrNull.optional(),
  plasteringHours: numberOrNull.optional(),
  notes1: z.string().optional(),
  notes2: z.string().optional(),
  tooltip: z.string().optional(),
  promptForMulti: z.boolean().optional(),
  /** Legacy single-tier fields; ignored when `priceLevelRows` is sent. */
  uomprice: numberOrNull.optional(),
  totalprice: numberOrNull.optional(),
  spec1: z.string().optional(),
  spec2: z.string().optional(),
  spec3: z.string().optional(),
});

/** Accept legacy JSON bodies that still send `description` instead of `product`. */
export function normalizeQuoteObjectBody(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (o.product === undefined && o.description !== undefined) {
    o.product = o.description;
  }
  return o;
}
