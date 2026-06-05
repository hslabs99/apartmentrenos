import {
  FieldValue,
  type DocumentData,
  Timestamp,
} from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ensureProjectAreaObjectsBootstrap } from "@/lib/firestore/collection-bootstrap";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { backfillMissingProjectAreaDocIds } from "@/lib/server/project-area-line-backfill";
import {
  ensureProjectNumericId,
  getProjectAreaKeys,
  getQuoteObjectNumericIdFromDoc,
} from "@/lib/server/resolve-ids";
import {
  customMeasureForNewProjectLine,
  effectiveMeasureForLinePricing,
  effectiveMeasurementForQuoteLine,
  normalizeLoadValue,
  quoteTemplatePricingForPriceLevel,
  resolveProjectLineCustomUom,
} from "@/lib/server/quote-object-doc";
import {
  applyProjectLineLabourHours,
  labourHoursToFirestore,
  loadAllObjectLabourRates,
} from "@/lib/server/labour-hours";
import { TEMPLATE_LABOUR_SILO_KEYS } from "@/lib/labour-silo";
import { loadProjectDimensionsByProjectId } from "@/lib/server/project-dimensions";
import {
  enrichLinesWithTemplateTooltips,
  readTooltipFromQuoteObjectData,
} from "@/lib/server/area-object-tooltip";
import { docToProjectAreaObjectPublic } from "@/lib/server/project-area-object-doc";
import { loadQuoteByObjectIdMap } from "@/lib/server/project-area-seeding";
import { materializeSkuForNewProjectLine } from "@/lib/server/materialize-line-sku";
import { resolveEffectivePriceLevelId } from "@/lib/server/resolve-effective-price-level";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";

export const runtime = "nodejs";

const numberOrNull = z.union([z.number(), z.null()]);

const bundledAppendSlotSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const createSchema = z.object({
  projectAreaDocId: z.string().min(1),
  quoteObjectDocId: z.string().min(1),
  bundledFromLineId: z.string().min(1).optional(),
  bundledAppendSlot: bundledAppendSlotSchema.optional(),
  skuId: z.string().min(1).optional(),
  skuProduct: z.string().optional(),
  supplierOption: z.number().int().optional(),
  pricelevelid: numberOrNull.optional(),
  dateadded: z.union([z.string(), z.null()]).optional(),
  custommeasure: numberOrNull.optional(),
  customuom: z.string().optional(),
  customumprice: numberOrNull.optional(),
  totalprice: numberOrNull.optional(),
  style: z.union([z.string(), z.null()]).optional(),
  colour: z.union([z.string(), z.null()]).optional(),
  notes1: z.string().optional().default(""),
  notes2: z.string().optional().default(""),
  constructionAssistantHours: numberOrNull.optional(),
  leadContractorHours: numberOrNull.optional(),
  electricianHours: numberOrNull.optional(),
  plumberHours: numberOrNull.optional(),
  generalHours: numberOrNull.optional(),
  projectManagerHours: numberOrNull.optional(),
  paintingHours: numberOrNull.optional(),
  plasteringHours: numberOrNull.optional(),
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

function bodyToFirestore(args: {
  dateadded: z.infer<typeof createSchema>["dateadded"];
  custommeasure: number | null;
  customuom: string;
  customumprice: number | null;
  totalprice: number | null;
  style: string | null;
  colour: string | null;
  notes1: string;
  notes2: string;
  projectid: number;
  projectAreaDocId: string;
  areaid: number;
  objectid: number;
  labourHours: Record<string, number | null>;
}): Record<string, unknown> {
  return {
    projectid: args.projectid,
    projectAreaDocId: args.projectAreaDocId,
    objectid: args.objectid,
    areaid: args.areaid,
    linesource: "manual",
    included: true,
    dateadded: parseDateTime(args.dateadded) ?? FieldValue.serverTimestamp(),
    custommeasure: args.custommeasure,
    customuom: args.customuom,
    customumprice: args.customumprice,
    totalprice: args.totalprice,
    ...(args.style ? { style: args.style } : {}),
    ...(args.colour ? { colour: args.colour } : {}),
    notes1: args.notes1,
    notes2: args.notes2,
    ...args.labourHours,
  };
}

export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    await ensureProjectAreaObjectsBootstrap(db);
    const projectDocId = req.nextUrl.searchParams.get("projectDocId");
    const projectidParam = req.nextUrl.searchParams.get("projectid");

    let projectid: number;
    if (projectDocId) {
      projectid = await ensureProjectNumericId(db, projectDocId);
    } else if (projectidParam) {
      projectid = Number(projectidParam);
      if (!Number.isInteger(projectid)) {
        return NextResponse.json(
          { error: "projectid must be an integer" },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "projectDocId or projectid is required" },
        { status: 400 },
      );
    }

    await backfillMissingProjectAreaDocIds(db, projectid);

    const areaidParam = req.nextUrl.searchParams.get("areaid");
    const projectAreaDocIdParam = req.nextUrl.searchParams.get("projectAreaDocId");

    const quoteByObjectId = await loadQuoteByObjectIdMap(db);

    let q = db.collection("projectareaobjects").where("projectid", "==", projectid);

    if (projectAreaDocIdParam) {
      if (isProjectAreasMetaDocument(projectAreaDocIdParam)) {
        return NextResponse.json({ error: "Invalid projectAreaDocId" }, { status: 400 });
      }
      const paSnap = await db.collection("projectareas").doc(projectAreaDocIdParam).get();
      if (!paSnap.exists) {
        return NextResponse.json({ error: "Project area not found" }, { status: 404 });
      }
      const paPid = Number(paSnap.data()?.projectid);
      if (paPid !== projectid) {
        return NextResponse.json({ error: "Project area does not belong to this project" }, { status: 400 });
      }
      q = q.where("projectAreaDocId", "==", projectAreaDocIdParam);
    } else if (areaidParam) {
      const areaid = Number(areaidParam);
      if (!Number.isInteger(areaid)) {
        return NextResponse.json({ error: "areaid must be an integer" }, { status: 400 });
      }
      const paForAreaid = await db
        .collection("projectareas")
        .where("projectid", "==", projectid)
        .where("areaid", "==", areaid)
        .get();
      const paIds = paForAreaid.docs
        .filter((d) => !isProjectAreasMetaDocument(d.id))
        .map((d) => d.id);
      if (paIds.length > 1) {
        return NextResponse.json(
          {
            error:
              "This template area appears more than once on the project. Pass projectAreaDocId to load lines for a specific instance.",
          },
          { status: 400 },
        );
      }
      if (paIds.length === 1) {
        q = q.where("projectAreaDocId", "==", paIds[0]);
      } else {
        q = q.where("areaid", "==", areaid);
      }
    }

    const snap = await q.get();
    let projectAreaObjects: ProjectAreaObjectPublic[] = snap.docs
      .filter((d) => !isProjectAreaObjectsMetaDocument(d.id))
      .map((d) => docToProjectAreaObjectPublic(d.id, d.data(), quoteByObjectId))
      .sort((a, b) => a.objectid - b.objectid);
    projectAreaObjects = await enrichLinesWithTemplateTooltips(db, projectAreaObjects);
    return NextResponse.json({ projectAreaObjects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list project area objects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const db = getAdminFirestore();
    await ensureProjectAreaObjectsBootstrap(db);
    const { projectid, areaid } = await getProjectAreaKeys(db, parsed.data.projectAreaDocId);
    const objectid = await getQuoteObjectNumericIdFromDoc(db, parsed.data.quoteObjectDocId);

    const quoteSnap = await db
      .collection("quote_objects")
      .doc(parsed.data.quoteObjectDocId)
      .get();
    if (!quoteSnap.exists) {
      return NextResponse.json({ error: "Quote object not found" }, { status: 404 });
    }
    const quoteData = quoteSnap.data() as DocumentData;
    const paSnap = await db.collection("projectareas").doc(parsed.data.projectAreaDocId).get();
    const areaM2 = paSnap.exists ? numOrNull(paSnap.data()!.aream2) : undefined;
    const projDims = await loadProjectDimensionsByProjectId(db, projectid);
    const pl = await resolveEffectivePriceLevelId(
      db,
      parsed.data.projectAreaDocId,
      projectid,
    );
    const template = quoteTemplatePricingForPriceLevel(quoteData, pl);

    const d = parsed.data;
    const style = d.style !== undefined && d.style !== null ? String(d.style).trim() : "";
    const colour = d.colour !== undefined && d.colour !== null ? String(d.colour).trim() : "";
    const measureCtx = {
      areaM2,
      apartmentTotalM2: projDims.apartmentTotalM2,
      apartmentHardM2: projDims.apartmentHardM2,
      apartmentSoftM2: projDims.apartmentSoftM2,
    };
    const inheritedMeasure = effectiveMeasurementForQuoteLine(
      quoteData,
      template.measurement,
      measureCtx,
    );
    let custommeasure = customMeasureForNewProjectLine(
      quoteData,
      template.measurement,
      measureCtx,
      d.custommeasure,
    );
    let customuom = resolveProjectLineCustomUom(template.customuom, null, d.customuom);
    let customumprice =
      d.customumprice !== undefined ? d.customumprice : template.customumprice;

    const materializedSku = await materializeSkuForNewProjectLine(db, quoteData, {
      projectAreaDocId: parsed.data.projectAreaDocId,
      projectid,
      effectivePriceLevelId: pl,
      lineStyle: style || null,
      lineColour: colour || null,
    });
    if (materializedSku.skuId) {
      if (materializedSku.supplierPriceExcGst != null && d.customumprice === undefined) {
        customumprice = materializedSku.supplierPriceExcGst;
      }
      if (d.customuom === undefined) {
        customuom = resolveProjectLineCustomUom(template.customuom, materializedSku.uom);
      }
    }

    const measureForPricing = effectiveMeasureForLinePricing(
      quoteData,
      template.measurement,
      measureCtx,
      custommeasure,
    );

    const tooltip = readTooltipFromQuoteObjectData(quoteData);
    let totalprice: number | null;
    if (d.totalprice !== undefined) {
      totalprice = d.totalprice;
    } else if (measureForPricing != null && customumprice != null) {
      totalprice = measureForPricing * customumprice;
    } else if (
      materializedSku.skuId &&
      customumprice != null &&
      measureForPricing == null &&
      custommeasure == null
    ) {
      totalprice = (inheritedMeasure ?? 1) * customumprice;
    } else {
      totalprice = template.totalprice;
    }

    const objectLabourRates = await loadAllObjectLabourRates(db);
    const objectName = String(quoteData.objectname ?? "").trim();
    const templateOverrides: Partial<
      Record<(typeof TEMPLATE_LABOUR_SILO_KEYS)[number], number | null>
    > = {};
    for (const k of TEMPLATE_LABOUR_SILO_KEYS) {
      const bodyKey = k as keyof typeof d;
      if (d[bodyKey] !== undefined) {
        templateOverrides[k] = normalizeLoadValue(d[bodyKey] as number | null);
      }
    }
    const skuProductForLabour = d.skuId?.trim()
      ? (d.skuProduct?.trim() || null)
      : materializedSku.skuProduct?.trim() || null;
    const { hours: labourHours } = applyProjectLineLabourHours({
      objectName,
      skuProduct: skuProductForLabour,
      quoteTemplate: quoteData,
      objectLabourRates,
      custommeasure: measureForPricing,
      lineUom: customuom,
      templateOverrides,
    });

    const isBundled = Boolean(d.bundledFromLineId?.trim());
    const lineDoc: Record<string, unknown> = {
      ...bodyToFirestore({
        dateadded: d.dateadded,
        custommeasure,
        customuom,
        customumprice,
        totalprice,
        style: style ? style : null,
        colour: colour ? colour : null,
        notes1: d.notes1,
        notes2: d.notes2,
        projectid,
        projectAreaDocId: parsed.data.projectAreaDocId,
        areaid,
        objectid,
        labourHours: labourHoursToFirestore(labourHours),
      }),
      linesource: isBundled ? "bundled" : "manual",
      ...(objectName ? { objectname: objectName } : {}),
      tooltip,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (isBundled) {
      lineDoc.bundledFromLineId = d.bundledFromLineId!.trim();
      if (d.bundledAppendSlot != null) lineDoc.bundledAppendSlot = d.bundledAppendSlot;
      if (d.pricelevelid !== undefined) lineDoc.pricelevelid = d.pricelevelid;
    }
    const explicitSkuId = d.skuId?.trim();
    if (explicitSkuId) {
      lineDoc.skuId = explicitSkuId;
      lineDoc.skuProduct = d.skuProduct?.trim() ?? "";
      if (d.supplierOption != null && isValidSupplierOption(d.supplierOption)) {
        lineDoc.supplierOption = d.supplierOption;
      }
    } else if (materializedSku.skuId) {
      lineDoc.skuId = materializedSku.skuId;
      lineDoc.skuProduct = materializedSku.skuProduct ?? "";
    }

    const ref = await db.collection("projectareaobjects").add(lineDoc);
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create project area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
