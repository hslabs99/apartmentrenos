import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { allocateNextSequence } from "@/lib/firestore/sequences";
import {
  docToQuoteObjectPublic,
  LM_RUNS_UOM,
  normalizeLoadValue,
  priceRowsAndLegacyTopLevel,
} from "@/lib/server/quote-object-doc";
import { compareTemplateDocs, renumberAllAndNextIndex } from "@/lib/server/template-sort-order";
import type { QuoteObjectPublic } from "@/types/quote-object";
import {
  normalizeQuoteObjectBody,
  quoteObjectCreateSchema,
} from "./quote-object-schemas";

export const runtime = "nodejs";

function bodyToFirestore(parsed: z.infer<typeof quoteObjectCreateSchema>): Record<string, unknown> {
  const measurement = parsed.measurement ?? null;
  const { firestorePatch } = priceRowsAndLegacyTopLevel(measurement, parsed.priceLevelRows ?? []);
  const uom = String(parsed.uom ?? "").trim();
  return {
    objectname: parsed.objectname,
    product: parsed.product,
    objecttype: parsed.objecttype,
    category: parsed.category,
    areaTagIds: parsed.areaTagIds ?? [],
    uom,
    inheritM2Source: uom === "M2" || uom === LM_RUNS_UOM ? parsed.inheritM2Source : "none",
    // Keep legacy field in sync (helps older clients / backfills). Only meaningful for UOM M2.
    inheritAreaM2: uom === "M2" ? parsed.inheritM2Source === "area_m2" : false,
    runWidth:
      uom === LM_RUNS_UOM &&
      typeof parsed.runWidth === "number" &&
      parsed.runWidth > 0
        ? parsed.runWidth
        : null,
    defaultAreaM2:
      uom === LM_RUNS_UOM &&
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
    promptForMulti: parsed.promptForMulti === true,
  };
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection("quote_objects").get();
    const filtered = snap.docs.filter((d) => !isQuoteObjectsMetaDocument(d.id));
    const sortedDocs = [...filtered].sort((a, b) =>
      compareTemplateDocs(a, b, (data) => String(data.objectname ?? "")),
    );
    const quoteObjects: QuoteObjectPublic[] = sortedDocs.map((d) =>
      docToQuoteObjectPublic(d.id, d.data()),
    );
    return NextResponse.json({ quoteObjects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list quote objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = normalizeQuoteObjectBody(await req.json());
    const parsed = quoteObjectCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const objectid = await allocateNextSequence(db, "objectid");
    const sortOrder = await renumberAllAndNextIndex(
      db,
      "quote_objects",
      isQuoteObjectsMetaDocument,
      (data) => String(data.objectname ?? ""),
    );
    const ref = db.collection("quote_objects").doc();
    await ref.set({
      ...bodyToFirestore(parsed.data),
      objectid,
      sortOrder,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, objectid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create quote object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
