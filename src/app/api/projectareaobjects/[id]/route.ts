import { FieldValue, type DocumentData, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { enrichLinesWithTemplateTooltips } from "@/lib/server/area-object-tooltip";
import { docToProjectAreaObjectPublic } from "@/lib/server/project-area-object-doc";
import { loadQuoteByObjectIdMap } from "@/lib/server/project-area-seeding";
import { projectAreaLineTierPrices } from "@/lib/server/reprice-project-area-lines";
import { normalizeLoadValue } from "@/lib/server/quote-object-doc";
import {
  loadAllObjectLabourRates,
  recalcLookupLabourHoursOnLine,
} from "@/lib/server/labour-hours";
import {
  LABOUR_SILO_KEYS,
  LOOKUP_LABOUR_SILO_KEYS,
  readLabourLookupManualOverrides,
} from "@/lib/labour-silo";
import { lookupBlindsUnitPrice } from "@/lib/server/blinds-line-price";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";
import {
  findProjectAreaDocIdByKeys,
  resolveEffectivePriceLevelId,
} from "@/lib/server/resolve-effective-price-level";
export const runtime = "nodejs";

const numberOrNull = z.union([z.number(), z.null()]);

const scopeToolBenchSectionSchema = z.object({
  id: z.string().min(1).max(128),
  lengthMm: z.number().nonnegative(),
  widthMm: z.number().nonnegative(),
});

const scopeToolWallMmSchema = z.object({
  width1Mm: z.number().nonnegative(),
  width2Mm: z.number().nonnegative(),
  studHeightMm: z.number().nonnegative(),
});

const labourLookupManualOverridesSchema = z
  .object({
    constructionAssistantHours: z.boolean().optional(),
    leadContractorHours: z.boolean().optional(),
    electricianHours: z.boolean().optional(),
    plumberHours: z.boolean().optional(),
  })
  .nullable();

const updateSchema = z.object({
  dateadded: z.union([z.string(), z.null()]).optional(),
  included: z.boolean().optional(),
  pricelevelid: numberOrNull.optional(),
  style: z.union([z.string(), z.null()]).optional(),
  colour: z.union([z.string(), z.null()]).optional(),
  custommeasure: numberOrNull.optional(),
  scopeToolBenchSections: z.union([z.array(scopeToolBenchSectionSchema), z.null()]).optional(),
  scopeToolWallMm: z.union([scopeToolWallMmSchema, z.null()]).optional(),
  customuom: z.string().optional(),
  customumprice: numberOrNull.optional(),
  totalprice: numberOrNull.optional(),
  notes1: z.string().optional(),
  notes2: z.string().optional(),
  constructionAssistantHours: numberOrNull.optional(),
  leadContractorHours: numberOrNull.optional(),
  electricianHours: numberOrNull.optional(),
  plumberHours: numberOrNull.optional(),
  generalHours: numberOrNull.optional(),
  projectManagerHours: numberOrNull.optional(),
  paintingHours: numberOrNull.optional(),
  plasteringHours: numberOrNull.optional(),
  labourLookupManualOverrides: labourLookupManualOverridesSchema.optional(),
  skuId: z.union([z.string().min(1), z.null()]).optional(),
  skuProduct: z.union([z.string(), z.null()]).optional(),
  supplierOption: numberOrNull.optional(),
  blindType: z.union([z.string(), z.null()]).optional(),
  blindDropMm: numberOrNull.optional(),
  blindWidthMm: numberOrNull.optional(),
  blindColour: z.union([z.string(), z.null()]).optional(),
});

function parseDateTime(value: unknown): Timestamp | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

function numOrNull(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

function calcTotal(
  custommeasure: number | null | undefined,
  customumprice: number | null | undefined,
  totalprice: number | null | undefined,
): number | null {
  if (custommeasure != null && customumprice != null) return custommeasure * customumprice;
  return totalprice ?? null;
}

function integerObjectId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

function normalizedTierPl(v: number | null | undefined): number | null {
  if (v != null && Number.isInteger(v)) return v;
  return null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreaObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = getAdminFirestore();
    const quoteByObjectId = await loadQuoteByObjectIdMap(db);
    const ref = db.collection("projectareaobjects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [enriched] = await enrichLinesWithTemplateTooltips(db, [
      docToProjectAreaObjectPublic(id, snap.data()!, quoteByObjectId),
    ]);
    return NextResponse.json({ projectAreaObject: enriched });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load project area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreaObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot modify collection metadata" }, { status: 403 });
    }
    const raw = await req.json();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    const quoteByObjectId = await loadQuoteByObjectIdMap(db);
    const ref = db.collection("projectareaobjects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const d = parsed.data;
    const existing = snap.data() as DocumentData;
    const custommeasure =
      d.custommeasure !== undefined ? d.custommeasure : numOrNull(existing.custommeasure);
    const customumprice =
      d.customumprice !== undefined ? d.customumprice : numOrNull(existing.customumprice);
    const providedTotal =
      d.totalprice !== undefined ? d.totalprice : numOrNull(existing.totalprice);

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (d.dateadded !== undefined) update.dateadded = parseDateTime(d.dateadded) ?? null;
    if (d.included !== undefined) update.included = d.included;
    if (d.pricelevelid !== undefined) update.pricelevelid = d.pricelevelid;
    if (d.style !== undefined) {
      const t = d.style === null ? "" : String(d.style).trim();
      update.style = t ? t : FieldValue.delete();
    }
    if (d.colour !== undefined) {
      const t = d.colour === null ? "" : String(d.colour).trim();
      update.colour = t ? t : FieldValue.delete();
    }
    if (d.custommeasure !== undefined) update.custommeasure = d.custommeasure;
    if (d.scopeToolBenchSections !== undefined) {
      update.scopeToolBenchSections =
        d.scopeToolBenchSections == null || d.scopeToolBenchSections.length === 0
          ? FieldValue.delete()
          : d.scopeToolBenchSections;
    }
    if (d.scopeToolWallMm !== undefined) {
      update.scopeToolWallMm =
        d.scopeToolWallMm == null ? FieldValue.delete() : d.scopeToolWallMm;
    }
    if (d.customuom !== undefined) update.customuom = d.customuom;
    if (d.customumprice !== undefined) update.customumprice = d.customumprice;
    if (d.notes1 !== undefined) update.notes1 = d.notes1;
    if (d.notes2 !== undefined) update.notes2 = d.notes2;
    for (const k of LABOUR_SILO_KEYS) {
      if (d[k] !== undefined) update[k] = normalizeLoadValue(d[k]);
    }

    const lookupHourTouched = LOOKUP_LABOUR_SILO_KEYS.some((k) => d[k] !== undefined);
    if (d.labourLookupManualOverrides !== undefined) {
      const raw = d.labourLookupManualOverrides;
      const hasAny =
        raw != null &&
        LOOKUP_LABOUR_SILO_KEYS.some((k) => raw[k] === true);
      update.labourLookupManualOverrides = hasAny ? raw : FieldValue.delete();
    } else if (lookupHourTouched) {
      const merged = {
        ...readLabourLookupManualOverrides(existing.labourLookupManualOverrides),
      };
      for (const k of LOOKUP_LABOUR_SILO_KEYS) {
        if (d[k] !== undefined) merged[k] = true;
      }
      const hasAny = LOOKUP_LABOUR_SILO_KEYS.some((k) => merged[k] === true);
      update.labourLookupManualOverrides = hasAny ? merged : FieldValue.delete();
    }

    if (d.skuId !== undefined) {
      const id = d.skuId === null ? "" : String(d.skuId).trim();
      update.skuId = id ? id : FieldValue.delete();
    }
    if (d.skuProduct !== undefined) {
      const p = d.skuProduct === null ? "" : String(d.skuProduct).trim();
      update.skuProduct = p ? p : FieldValue.delete();
    }

    const measureOrUomChanged =
      d.custommeasure !== undefined || d.customuom !== undefined;
    const skuLabourInputsChanged =
      d.skuId !== undefined || d.skuProduct !== undefined;
    if (measureOrUomChanged || skuLabourInputsChanged) {
      const objectid = integerObjectId(existing.objectid);
      const q = objectid !== undefined ? quoteByObjectId.get(objectid) : undefined;
      const objectName = q ? String(q.objectname ?? "").trim() : "";
      const lineUom =
        d.customuom !== undefined
          ? String(d.customuom)
          : String(existing.customuom ?? "");
      const effectiveMeasure =
        d.custommeasure !== undefined
          ? custommeasure ?? null
          : numOrNull(existing.custommeasure) ?? null;
      const effectiveSkuProduct =
        d.skuProduct !== undefined
          ? d.skuProduct === null
            ? null
            : String(d.skuProduct).trim() || null
          : d.skuId !== undefined && !String(d.skuId ?? "").trim()
            ? null
            : String(existing.skuProduct ?? "").trim() || null;
      const objectLabourRates = await loadAllObjectLabourRates(db);
      const effectiveOverrides =
        d.labourLookupManualOverrides !== undefined
          ? readLabourLookupManualOverrides(d.labourLookupManualOverrides)
          : lookupHourTouched
            ? {
                ...readLabourLookupManualOverrides(existing.labourLookupManualOverrides),
                ...Object.fromEntries(
                  LOOKUP_LABOUR_SILO_KEYS.filter((k) => d[k] !== undefined).map((k) => [
                    k,
                    true,
                  ]),
                ),
              }
            : readLabourLookupManualOverrides(existing.labourLookupManualOverrides);
      const { patch: lookupPatch } = recalcLookupLabourHoursOnLine(
        existing,
        objectName,
        objectLabourRates,
        effectiveMeasure,
        lineUom,
        effectiveSkuProduct,
        effectiveOverrides,
      );
      Object.assign(update, lookupPatch);
    }
    if (d.supplierOption !== undefined) {
      if (d.supplierOption != null && isValidSupplierOption(d.supplierOption)) {
        update.supplierOption = d.supplierOption;
      } else {
        update.supplierOption = FieldValue.delete();
      }
    }

    const blindsFieldTouched =
      d.blindType !== undefined ||
      d.blindDropMm !== undefined ||
      d.blindWidthMm !== undefined ||
      d.blindColour !== undefined;

    if (d.blindType !== undefined) {
      const t = d.blindType === null ? "" : String(d.blindType).trim();
      update.blindType = t ? t : FieldValue.delete();
    }
    if (d.blindDropMm !== undefined) update.blindDropMm = d.blindDropMm;
    if (d.blindWidthMm !== undefined) update.blindWidthMm = d.blindWidthMm;
    if (d.blindColour !== undefined) {
      const c = d.blindColour === null ? "" : String(d.blindColour).trim();
      update.blindColour = c ? c : FieldValue.delete();
    }

    const tierOverrideChanged =
      d.pricelevelid !== undefined &&
      normalizedTierPl(numOrNull(existing.pricelevelid)) !==
        normalizedTierPl(d.pricelevelid);

    if (tierOverrideChanged) {
      const projectid = Number(existing.projectid);
      const templateAreaid = Number(existing.areaid);
      const paDocId =
        typeof existing.projectAreaDocId === "string" && existing.projectAreaDocId.trim()
          ? existing.projectAreaDocId.trim()
          : Number.isInteger(projectid) && Number.isInteger(templateAreaid)
            ? await findProjectAreaDocIdByKeys(db, projectid, templateAreaid)
            : null;
      const areaPl =
        paDocId != null
          ? await resolveEffectivePriceLevelId(db, paDocId, projectid)
          : null;
      let areaM2: number | null | undefined;
      if (paDocId != null) {
        const paSnap = await db.collection("projectareas").doc(paDocId).get();
        if (paSnap.exists) areaM2 = numOrNull(paSnap.data()!.aream2);
      }
      const objectid = integerObjectId(existing.objectid);
      const q = objectid !== undefined ? quoteByObjectId.get(objectid) : undefined;
      const mergedLine: DocumentData = {
        ...existing,
        custommeasure,
        pricelevelid: d.pricelevelid,
      };
      const { customumprice: tierUm, totalprice: tierTot } = projectAreaLineTierPrices({
        lineData: mergedLine,
        quoteData: q,
        areaEffectivePriceLevelId: areaPl,
        areaM2,
      });
      update.customumprice = tierUm;
      update.totalprice = tierTot;
    } else if (
      blindsFieldTouched ||
      existing.systemObjectKind === "blinds"
    ) {
      const blindType =
        d.blindType !== undefined
          ? d.blindType === null
            ? ""
            : String(d.blindType).trim()
          : String(existing.blindType ?? "").trim();
      const blindDropMm =
        d.blindDropMm !== undefined ? d.blindDropMm : numOrNull(existing.blindDropMm);
      const blindWidthMm =
        d.blindWidthMm !== undefined ? d.blindWidthMm : numOrNull(existing.blindWidthMm);
      const blindColour =
        d.blindColour !== undefined
          ? d.blindColour === null
            ? ""
            : String(d.blindColour).trim()
          : String(existing.blindColour ?? "").trim();

      if (blindType && blindDropMm != null && blindWidthMm != null) {
        const unitPrice = await lookupBlindsUnitPrice(db, blindType, blindDropMm, blindWidthMm);
        update.customumprice = unitPrice;
        const measure =
          d.custommeasure !== undefined ? d.custommeasure : numOrNull(existing.custommeasure);
        update.totalprice =
          measure != null && unitPrice != null ? measure * unitPrice : null;
        update.skuProduct = blindColour
          ? `${blindType} · ${blindDropMm} · ${blindWidthMm} · ${blindColour}`
          : `${blindType} · ${blindDropMm} · ${blindWidthMm}`;
      } else if (blindsFieldTouched) {
        update.customumprice = null;
        update.totalprice = null;
        update.skuProduct = FieldValue.delete();
      } else {
        update.totalprice = calcTotal(custommeasure, customumprice, providedTotal);
      }
    } else {
      update.totalprice = calcTotal(custommeasure, customumprice, providedTotal);
    }

    await ref.update(update);
    const next = await ref.get();
    const [enriched] = await enrichLinesWithTemplateTooltips(db, [
      docToProjectAreaObjectPublic(id, next.data()!, quoteByObjectId),
    ]);
    return NextResponse.json({ projectAreaObject: enriched });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to update project area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (isProjectAreaObjectsMetaDocument(id)) {
      return NextResponse.json({ error: "Cannot delete collection metadata" }, { status: 403 });
    }
    const db = getAdminFirestore();
    const ref = db.collection("projectareaobjects").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to delete project area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
