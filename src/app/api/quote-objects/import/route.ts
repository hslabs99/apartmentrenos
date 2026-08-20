import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import {
  LM_RUNS_UOM,
  normalizeLoadValue,
  priceRowsAndLegacyTopLevel,
} from "@/lib/server/quote-object-doc";
import { renumberAllAndNextIndex } from "@/lib/server/template-sort-order";
import { quoteObjectCreateSchema } from "../quote-object-schemas";

export const runtime = "nodejs";

const importRowSchema = z
  .object({
  objectname: z.string().optional(),
  product: z.string().optional(),
  /** Legacy import payloads */
  description: z.string().optional(),
  objecttype: z.string().optional(),
  category: z.string().optional(),
  areaTags: z.string().optional(),
  uom: z.string().optional(),
  inheritAreaM2: z.union([z.boolean(), z.string()]).optional(),
  runWidth: z.union([z.number(), z.null()]).optional(),
  defaultAreaM2: z.union([z.number(), z.null()]).optional(),
  measurement: z.union([z.number(), z.null()]).optional(),
  generalHours: z.union([z.number(), z.null()]).optional(),
  projectManagerHours: z.union([z.number(), z.null()]).optional(),
  paintingHours: z.union([z.number(), z.null()]).optional(),
  plasteringHours: z.union([z.number(), z.null()]).optional(),
  notes1: z.string().optional(),
  notes2: z.string().optional(),
  tooltip: z.string().optional(),
  priceLevelRows: z
    .array(
      z.object({
        pricelevelid: z.number().int(),
        uomprice: z.union([z.number(), z.null()]).optional(),
        totalprice: z.union([z.number(), z.null()]).optional(),
        spec1: z.string().optional(),
        spec2: z.string().optional(),
        spec3: z.string().optional(),
      }),
    )
    .optional(),
  rowNumber: z.number().int().optional(),
})
  .transform(({ description, product, ...rest }) => ({
    ...rest,
    product: product ?? description ?? "",
  }));

const requestSchema = z.object({
  rows: z.array(importRowSchema).default([]),
});

function parseBoolLoose(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "number") return v !== 0;
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "true" || s === "yes" || s === "1") return true;
  return false;
}

function normalizeObjectType(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || s === "'") return "Unit";
  return "Unit";
}

async function logImportError(db: ReturnType<typeof getAdminFirestore>, details: string) {
  const logid = crypto.randomUUID();
  await db.collection("logs").doc().set({
    logid,
    datetime: FieldValue.serverTimestamp(),
    category: "QuoteObjectImport",
    type: "Error",
    details,
  });
}

function bodyToFirestore(parsed: z.infer<typeof quoteObjectCreateSchema>): Record<string, unknown> {
  const measurement = parsed.measurement ?? null;
  const { firestorePatch } = priceRowsAndLegacyTopLevel(measurement, parsed.priceLevelRows ?? []);
  return {
    objectname: parsed.objectname,
    product: parsed.product,
    objecttype: parsed.objecttype,
    category: parsed.category,
    areaTagIds: parsed.areaTagIds ?? [],
    uom: parsed.uom,
    inheritAreaM2: parsed.inheritAreaM2,
    runWidth:
      String(parsed.uom ?? "").trim() === LM_RUNS_UOM &&
      typeof parsed.runWidth === "number" &&
      parsed.runWidth > 0
        ? parsed.runWidth
        : null,
    defaultAreaM2:
      String(parsed.uom ?? "").trim() === LM_RUNS_UOM &&
      typeof parsed.defaultAreaM2 === "number" &&
      parsed.defaultAreaM2 > 0
        ? parsed.defaultAreaM2
        : null,
    measurement,
    ...firestorePatch,
    generalHours: normalizeLoadValue(parsed.generalHours ?? null),
    projectManagerHours: normalizeLoadValue(parsed.projectManagerHours ?? null),
    paintingHours: normalizeLoadValue(parsed.paintingHours ?? null),
    plasteringHours: normalizeLoadValue(parsed.plasteringHours ?? null),
    notes1: parsed.notes1,
    notes2: parsed.notes2,
    tooltip: parsed.tooltip,
    // Intentionally omit promptForMulti so re-import does not reset the Setup checkbox.
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsedReq = requestSchema.safeParse(raw);
    if (!parsedReq.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsedReq.error.flatten() },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();

    // Build area name -> doc id map (exact match, trimmed; case-insensitive for robustness)
    const areasSnap = await db.collection("areas").get();
    const areaNameToId = new Map<string, string>();
    for (const d of areasSnap.docs) {
      const data = d.data();
      const name = String(data.areaname ?? "").trim();
      if (!name) continue;
      areaNameToId.set(name, d.id);
      areaNameToId.set(name.toLowerCase(), d.id);
    }

    const qoSnap = await db.collection("quote_objects").get();
    const existingDocs = qoSnap.docs.filter((d) => !isQuoteObjectsMetaDocument(d.id));
    /** First document id per normalized object name (re-import updates this row). */
    const nameKeyToDocId = new Map<string, string>();
    for (const d of existingDocs) {
      const data = d.data() as DocumentData;
      const key = String(data.objectname ?? "").trim().toLowerCase();
      if (!key) continue;
      if (!nameKeyToDocId.has(key)) nameKeyToDocId.set(key, d.id);
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of parsedReq.data.rows) {
      const objectname = String(row.objectname ?? "").trim();
      if (!objectname) continue; // blank row

      // Resolve area tags -> ids; unknown tags are logged but do not block the row.
      const rawTags = String(row.areaTags ?? "");
      const tags = rawTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const areaTagIds: string[] = [];
      for (const tag of tags) {
        const id = areaNameToId.get(tag) ?? areaNameToId.get(tag.toLowerCase());
        if (!id) {
          const msg = `Area '${tag}' was not valid (row ${row.rowNumber ?? "?"}, ObjectName='${objectname}').`;
          errors.push(msg);
          try {
            await logImportError(db, msg);
          } catch (e) {
            // If logging fails, still continue import.
            console.error(e);
          }
          continue;
        }
        if (!areaTagIds.includes(id)) areaTagIds.push(id);
      }

      const payload = {
        objectname,
        product: String(row.product ?? ""),
        objecttype: normalizeObjectType(row.objecttype),
        category: String(row.category ?? ""),
        areaTagIds,
        uom: String(row.uom ?? ""),
        inheritAreaM2: parseBoolLoose(row.inheritAreaM2),
        runWidth: row.runWidth ?? null,
        defaultAreaM2: row.defaultAreaM2 ?? null,
        measurement: row.measurement ?? null,
        priceLevelRows: row.priceLevelRows ?? [],
        generalHours: row.generalHours ?? null,
        projectManagerHours: row.projectManagerHours ?? null,
        paintingHours: row.paintingHours ?? null,
        plasteringHours: row.plasteringHours ?? null,
        notes1: String(row.notes1 ?? ""),
        notes2: String(row.notes2 ?? ""),
        tooltip: String(row.tooltip ?? ""),
      };

      const validated = quoteObjectCreateSchema.safeParse(payload);
      if (!validated.success) {
        const msg = `Row ${row.rowNumber ?? "?"} failed validation for '${objectname}'.`;
        errors.push(msg);
        try {
          await logImportError(db, msg);
        } catch (e) {
          console.error(e);
        }
        continue;
      }

      const nameKey = objectname.trim().toLowerCase();
      const existingId = nameKeyToDocId.get(nameKey);

      if (existingId) {
        const ref = db.collection("quote_objects").doc(existingId);
        await ref.update({
          ...bodyToFirestore(validated.data),
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated += 1;
      } else {
        const objectid = await allocateNextSequence(db, "objectid");
        const sortOrder = await renumberAllAndNextIndex(
          db,
          "quote_objects",
          isQuoteObjectsMetaDocument,
          (data) => String(data.objectname ?? ""),
        );
        const ref = db.collection("quote_objects").doc();
        await ref.set({
          ...bodyToFirestore(validated.data),
          objectid,
          sortOrder,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        nameKeyToDocId.set(nameKey, ref.id);
        created += 1;
      }
    }

    return NextResponse.json({
      created,
      updated,
      errorCount: errors.length,
      errors,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to import quote objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

