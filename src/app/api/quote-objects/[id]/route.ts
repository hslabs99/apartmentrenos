import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import {
  calcTotal,
  docToQuoteObjectPublic,
  legacyFieldsFromPriceRows,
  normalizeLoadValue,
  numOrNull,
  parsePriceLevelRows,
  priceRowsAndLegacyTopLevel,
} from "@/lib/server/quote-object-doc";
import {
  normalizeQuoteObjectBody,
  quoteObjectUpdateSchema,
} from "../quote-object-schemas";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isQuoteObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("quote_objects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ quoteObject: docToQuoteObjectPublic(id, snap.data()!) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load quote object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isQuoteObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = normalizeQuoteObjectBody(await req.json());
    const parsed = quoteObjectUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const ref = db.collection("quote_objects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = snap.data() as DocumentData;
    const d = parsed.data;
    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    const measurement =
      d.measurement !== undefined ? d.measurement : numOrNull(existing.measurement);

    if (d.priceLevelRows !== undefined) {
      const { firestorePatch } = priceRowsAndLegacyTopLevel(measurement ?? null, d.priceLevelRows);
      Object.assign(update, firestorePatch);
    } else {
      const rows = parsePriceLevelRows(existing.priceLevelRows);
      if (rows.length > 0) {
        if (d.measurement !== undefined) {
          const leg = legacyFieldsFromPriceRows(measurement ?? null, rows);
          update.uomprice = leg.uomprice;
          update.totalprice = leg.totalprice;
          update.spec1 = leg.spec1;
          update.spec2 = leg.spec2;
          update.spec3 = leg.spec3;
        }
      } else {
        const uomprice = d.uomprice !== undefined ? d.uomprice : numOrNull(existing.uomprice);
        const providedTotal =
          d.totalprice !== undefined ? d.totalprice : numOrNull(existing.totalprice);
        if (d.uomprice !== undefined) update.uomprice = d.uomprice;
        update.totalprice = calcTotal(measurement ?? null, uomprice, providedTotal);
        if (d.spec1 !== undefined) update.spec1 = d.spec1;
        if (d.spec2 !== undefined) update.spec2 = d.spec2;
        if (d.spec3 !== undefined) update.spec3 = d.spec3;
      }
    }

    const scalarKeys = [
      "objectname",
      "product",
      "objecttype",
      "category",
      "uom",
      "inheritM2Source",
      "inheritAreaM2",
      "runWidth",
      "defaultAreaM2",
      "measurement",
      "generalHours",
      "projectManagerHours",
      "paintingHours",
      "plasteringHours",
      "notes1",
      "notes2",
      "tooltip",
    ] as const;
    for (const k of scalarKeys) {
      if (d[k] === undefined) continue;
      if (
        k === "generalHours" ||
        k === "projectManagerHours" ||
        k === "paintingHours" ||
        k === "plasteringHours"
      ) {
        update[k] = normalizeLoadValue(d[k] as number | null);
      } else {
        update[k] = d[k];
      }
    }
    // Keep legacy + new field aligned, but only for M2.
    {
      const nextUom =
        d.uom !== undefined ? String(d.uom ?? "").trim() : String(existing.uom ?? "").trim();
      const nextInherit =
        d.inheritM2Source !== undefined
          ? d.inheritM2Source
          : typeof existing.inheritM2Source === "string"
            ? existing.inheritM2Source
            : undefined;
      const nextLegacy =
        d.inheritAreaM2 !== undefined ? d.inheritAreaM2 : existing.inheritAreaM2;

      if (nextUom !== "M2" && nextUom !== "LM-Runs") {
        update.inheritM2Source = "none";
        update.inheritAreaM2 = false;
      } else if (d.inheritM2Source !== undefined) {
        if (nextUom === "M2") update.inheritAreaM2 = d.inheritM2Source === "area_m2";
        else update.inheritAreaM2 = false;
      } else if (d.inheritAreaM2 !== undefined && nextInherit === undefined) {
        update.inheritM2Source = nextLegacy === true ? "area_m2" : "none";
      }
    }
    if (d.areaTagIds !== undefined) update.areaTagIds = d.areaTagIds;

    await ref.update(update);
    const next = await ref.get();
    return NextResponse.json({
      quoteObject: docToQuoteObjectPublic(id, next.data()!),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update quote object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isQuoteObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("quote_objects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete quote object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
