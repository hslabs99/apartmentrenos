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
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import {
  effectiveInheritMeasureSource,
  scopeAnswerInheritMeasureLockedForQuoteObjectDocId,
  scopeAnswerInheritMeasureSourceForQuoteObjectDocId,
} from "@/lib/inherit-m2-source";
import { matchesScopeInstance } from "@/lib/scope-instance";
import { scopeMetricValuesMapForInstance } from "@/lib/scope-metrics";
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
  loadAllContractLabourRates,
  loadAllObjectLabourRates,
} from "@/lib/server/labour-hours";
import { labourLineCatalogFields } from "@/lib/server/labour-checklist-line";
import { TEMPLATE_LABOUR_SILO_KEYS } from "@/lib/labour-silo";
import { loadProjectDimensionsByProjectId } from "@/lib/server/project-dimensions";
import {
  enrichLinesWithTemplateTooltips,
  readTooltipFromQuoteObjectData,
} from "@/lib/server/area-object-tooltip";
import { docToProjectAreaObjectPublic } from "@/lib/server/project-area-object-doc";
import {
  compareProjectAreaLineOrder,
  insertProjectAreaLineAfter,
} from "@/lib/server/project-area-line-sort";
import { loadQuoteByObjectIdMap } from "@/lib/server/project-area-seeding";
import { materializeSkuForNewProjectLine } from "@/lib/server/materialize-line-sku";
import { resolveEffectivePriceLevelId } from "@/lib/server/resolve-effective-price-level";
import { parseScopeMetricValuesFromFirestore } from "@/lib/server/scope-metric-values";
import {
  firestoreAnswersToPublic,
  firestoreScopeMetricsToPublic,
} from "@/lib/server/scope-doc";
import { loadSkuCalcM2Fields } from "@/lib/server/sku-calc-m2-fields";
import { isValidSupplierOption } from "@/lib/sku/supplier-option";
import type { ProjectAreaScopeAnswerPublic } from "@/types/project-area";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { InheritMeasureSource } from "@/types/scope-metric";

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
  manualSupplier: z.string().optional(),
  manualSupplierSku: z.union([z.string(), z.null()]).optional(),
  constructionAssistantHours: numberOrNull.optional(),
  leadContractorHours: numberOrNull.optional(),
  electricianHours: numberOrNull.optional(),
  plumberHours: numberOrNull.optional(),
  generalHours: numberOrNull.optional(),
  projectManagerHours: numberOrNull.optional(),
  paintingHours: numberOrNull.optional(),
  plasteringHours: numberOrNull.optional(),
  /** When set, line is created inside this scope section (checklist) instead of area-level manual. */
  scopeDocId: z.string().min(1).optional(),
  scopeInstanceId: z.union([z.string().min(1), z.null()]).optional(),
  answerid: z.union([z.string().uuid(), z.null()]).optional(),
  /** Workbench: place the new line directly below this line doc id within the area. */
  insertAfterLineDocId: z.string().min(1).optional(),
  /** `manual2` = workbench blank line from SKU dropdown (no catalog SKU resolution). */
  linesource: z.enum(["manual", "manual2"]).optional(),
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
      .sort(compareProjectAreaLineOrder);
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
    const objectName = String(quoteData.objectname ?? "").trim();
    const d = parsed.data;

    if (d.linesource === "manual2") {
      const trimmedProduct = d.skuProduct?.trim() ?? "";
      const trimmedSupplier = d.manualSupplier?.trim() ?? "";
      if (!trimmedProduct) {
        return NextResponse.json({ error: "Product name is required for Manual2 lines" }, { status: 400 });
      }
      if (!trimmedSupplier) {
        return NextResponse.json({ error: "Supplier is required for Manual2 lines" }, { status: 400 });
      }
      if (d.custommeasure == null || d.custommeasure <= 0) {
        return NextResponse.json({ error: "Measure is required for Manual2 lines" }, { status: 400 });
      }
      if (!d.customuom?.trim()) {
        return NextResponse.json({ error: "UOM is required for Manual2 lines" }, { status: 400 });
      }
      if (d.customumprice == null || d.customumprice < 0) {
        return NextResponse.json({ error: "Unit price is required for Manual2 lines" }, { status: 400 });
      }

      const style = d.style !== undefined && d.style !== null ? String(d.style).trim() : "";
      const colour = d.colour !== undefined && d.colour !== null ? String(d.colour).trim() : "";
      const customuom = d.customuom.trim();
      const custommeasure = d.custommeasure;
      const customumprice = d.customumprice;
      const totalprice =
        d.totalprice ??
        (custommeasure != null && customumprice != null ? custommeasure * customumprice : null);

      const objectLabourRates = await loadAllObjectLabourRates(db);
      const { hours: labourHours } = applyProjectLineLabourHours({
        objectName,
        skuProduct: null,
        quoteTemplate: quoteData,
        objectLabourRates,
        custommeasure,
        lineUom: customuom,
      });

      const lineDoc: Record<string, unknown> = {
        projectid,
        projectAreaDocId: parsed.data.projectAreaDocId,
        areaid,
        objectid,
        linesource: "manual2",
        included: true,
        dateadded: parseDateTime(d.dateadded) ?? FieldValue.serverTimestamp(),
        custommeasure,
        customuom,
        customumprice,
        totalprice,
        ...(style ? { style } : {}),
        ...(colour ? { colour } : {}),
        notes1: d.notes1 ?? "",
        notes2: d.notes2 ?? "",
        skuProduct: trimmedProduct,
        manualSupplier: trimmedSupplier,
        ...(d.manualSupplierSku?.trim() ? { manualSupplierSku: d.manualSupplierSku.trim() } : {}),
        ...(objectName ? { objectname: objectName } : {}),
        tooltip: readTooltipFromQuoteObjectData(quoteData),
        ...(d.pricelevelid !== undefined ? { pricelevelid: d.pricelevelid } : {}),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...labourHoursToFirestore(labourHours),
      };

      const insertAfter = d.insertAfterLineDocId?.trim();
      if (insertAfter) {
        lineDoc.insertedAfterLineId = insertAfter;
      }

      const ref = await db.collection("projectareaobjects").add(lineDoc);
      if (insertAfter) {
        try {
          await insertProjectAreaLineAfter(
            db,
            parsed.data.projectAreaDocId,
            projectid,
            ref.id,
            insertAfter,
          );
        } catch (reorderErr) {
          console.error("manual2 line reorder failed:", reorderErr);
        }
      }
      return NextResponse.json({ id: ref.id });
    }

    const paSnap = await db.collection("projectareas").doc(parsed.data.projectAreaDocId).get();
    const areaM2 = paSnap.exists ? numOrNull(paSnap.data()!.aream2) : undefined;
    const projDims = await loadProjectDimensionsByProjectId(db, projectid);
    const pl = await resolveEffectivePriceLevelId(
      db,
      parsed.data.projectAreaDocId,
      projectid,
    );
    const template = quoteTemplatePricingForPriceLevel(quoteData, pl);

    const style = d.style !== undefined && d.style !== null ? String(d.style).trim() : "";
    const colour = d.colour !== undefined && d.colour !== null ? String(d.colour).trim() : "";
    const explicitSkuProductEarly = d.skuProduct?.trim() ?? "";
    const isWorkbenchManualBlank =
      !d.scopeDocId?.trim() &&
      !d.bundledFromLineId?.trim() &&
      explicitSkuProductEarly.length > 0 &&
      (d.customumprice !== undefined || Boolean(d.manualSupplier?.trim()));
    const measureCtx = {
      areaM2,
      apartmentTotalM2: projDims.apartmentTotalM2,
      apartmentHardM2: projDims.apartmentHardM2,
      apartmentSoftM2: projDims.apartmentSoftM2,
    };
    let scopeInheritMeasureSource: InheritMeasureSource | undefined;
    let scopeInheritMeasureLocked: boolean | undefined;
    let scopeMetricsForLine: ReturnType<typeof firestoreScopeMetricsToPublic> = [];
    let scopeMetricValueMap: Map<string, number | null> | undefined;
    let scopeDocId: string | undefined;
    let scopeInstanceId: string | null | undefined;
    let scopeAnswerId: string | null | undefined;
    let scopeNumericId: number | null | undefined;

    if (d.scopeDocId?.trim()) {
      scopeDocId = d.scopeDocId.trim();
      const scopeSnap = await db.collection("scopes").doc(scopeDocId).get();
      if (!scopeSnap.exists || isScopesMetaDocument(scopeSnap.id)) {
        return NextResponse.json({ error: "Scope not found" }, { status: 404 });
      }
      const scopeData = scopeSnap.data() as DocumentData;
      scopeNumericId = numOrNull(scopeData.scopeid) ?? undefined;
      scopeMetricsForLine = firestoreScopeMetricsToPublic(scopeData.scopeMetrics);
      const scopeAnswers = firestoreAnswersToPublic(scopeData.answers);
      scopeInstanceId =
        d.scopeInstanceId === undefined
          ? undefined
          : d.scopeInstanceId === null
            ? null
            : d.scopeInstanceId.trim() || null;

      const paScopeAnswers = Array.isArray(paSnap.data()?.scopeAnswers)
        ? (paSnap.data()!.scopeAnswers as ProjectAreaScopeAnswerPublic[])
        : [];
      const savedForScope = paScopeAnswers.find(
        (e) =>
          e.scopeDocId === scopeDocId &&
          matchesScopeInstance(e.scopeInstanceId, scopeInstanceId),
      );
      scopeAnswerId =
        d.answerid !== undefined
          ? d.answerid
          : savedForScope?.answerid ?? null;

      if (scopeAnswerId) {
        const answer = scopeAnswers.find((a) => a.answerid === scopeAnswerId);
        if (answer) {
          scopeInheritMeasureSource = scopeAnswerInheritMeasureSourceForQuoteObjectDocId(
            answer,
            parsed.data.quoteObjectDocId,
          );
          scopeInheritMeasureLocked = scopeAnswerInheritMeasureLockedForQuoteObjectDocId(
            answer,
            parsed.data.quoteObjectDocId,
          );
        }
      }

      const scopeMetricValues = parseScopeMetricValuesFromFirestore(
        paSnap.data()?.scopeMetricValues,
      );
      scopeMetricValueMap = scopeMetricValuesMapForInstance(
        scopeMetricValues,
        scopeDocId,
        scopeInstanceId,
      );
    }

    const effectiveInherit = effectiveInheritMeasureSource(
      {
        uom: String(quoteData.uom ?? ""),
        inheritM2Source: quoteData.inheritM2Source,
        inheritAreaM2: quoteData.inheritAreaM2,
      },
      scopeInheritMeasureSource,
    );

    let customuom = resolveProjectLineCustomUom(template.customuom, null, d.customuom);
    let customumprice =
      d.customumprice !== undefined ? d.customumprice : template.customumprice;

    const materializedSku = await (async () => {
      const contractLabourRates = await loadAllContractLabourRates(db);
      const labourCatalog = labourLineCatalogFields(quoteData, contractLabourRates);
      if (labourCatalog) {
        return {
          skuId: null,
          skuProduct: labourCatalog.skuProduct,
          uom: labourCatalog.customuom,
          supplierPriceExcGst: labourCatalog.customumprice,
        };
      }
      return materializeSkuForNewProjectLine(db, quoteData, {
        projectAreaDocId: parsed.data.projectAreaDocId,
        projectid,
        effectivePriceLevelId: pl,
        lineStyle: style || null,
        lineColour: colour || null,
      });
    })();
    if (materializedSku.skuId && !isWorkbenchManualBlank) {
      if (materializedSku.supplierPriceExcGst != null && d.customumprice === undefined) {
        customumprice = materializedSku.supplierPriceExcGst;
      }
      if (d.customuom === undefined) {
        customuom = resolveProjectLineCustomUom(template.customuom, materializedSku.uom);
      }
    }

    const skuIdForMeasure =
      d.skuId?.trim() || (!isWorkbenchManualBlank ? materializedSku.skuId : null) || null;
    const skuCalcM2ForMeasure = await loadSkuCalcM2Fields(db, skuIdForMeasure);
    const inheritedMeasure = effectiveMeasurementForQuoteLine(
      quoteData,
      template.measurement,
      measureCtx,
      effectiveInherit,
      scopeMetricValueMap,
      scopeMetricsForLine,
      skuCalcM2ForMeasure,
    );
    let custommeasure = customMeasureForNewProjectLine(
      quoteData,
      template.measurement,
      measureCtx,
      d.custommeasure,
      effectiveInherit,
      scopeMetricValueMap,
      scopeMetricsForLine,
      skuCalcM2ForMeasure,
      scopeInheritMeasureLocked,
    );
    const measureForPricing = effectiveMeasureForLinePricing(
      quoteData,
      template.measurement,
      measureCtx,
      custommeasure,
      effectiveInherit,
      scopeMetricValueMap,
      scopeMetricsForLine,
      skuCalcM2ForMeasure,
      scopeInheritMeasureLocked,
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
    const templateOverrides: Partial<
      Record<(typeof TEMPLATE_LABOUR_SILO_KEYS)[number], number | null>
    > = {};
    for (const k of TEMPLATE_LABOUR_SILO_KEYS) {
      const bodyKey = k as keyof typeof d;
      if (d[bodyKey] !== undefined) {
        templateOverrides[k] = normalizeLoadValue(d[bodyKey] as number | null);
      }
    }
    const skuProductForLabour = isWorkbenchManualBlank
      ? d.skuId?.trim()
        ? d.skuProduct?.trim() || null
        : null
      : d.skuId?.trim()
        ? d.skuProduct?.trim() || null
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
    const isScopeLine = Boolean(scopeDocId);
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
      linesource: isBundled ? "bundled" : isScopeLine ? "scope" : "manual",
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
    if (isScopeLine && scopeDocId) {
      lineDoc.scopeDocId = scopeDocId;
      const inst = scopeInstanceId?.trim();
      if (inst) lineDoc.scopeInstanceId = inst;
      if (scopeAnswerId) lineDoc.answerid = scopeAnswerId;
      if (scopeNumericId != null) lineDoc.scopeid = scopeNumericId;
    }
    const explicitSkuId = d.skuId?.trim();
    const manualSupplier = d.manualSupplier?.trim();
    const manualSupplierSku = d.manualSupplierSku?.trim();
    const explicitSkuProduct = explicitSkuProductEarly;
    /** Workbench blank-line modal: user-entered product/cost/supplier — do not auto-materialize catalog SKU. */
    if (manualSupplier) lineDoc.manualSupplier = manualSupplier;
    if (manualSupplierSku) lineDoc.manualSupplierSku = manualSupplierSku;
    if (d.pricelevelid !== undefined && !isBundled) {
      lineDoc.pricelevelid = d.pricelevelid;
    }
    if (explicitSkuId) {
      lineDoc.skuId = explicitSkuId;
      lineDoc.skuProduct = explicitSkuProduct;
      if (d.supplierOption != null && isValidSupplierOption(d.supplierOption)) {
        lineDoc.supplierOption = d.supplierOption;
      }
    } else if (isWorkbenchManualBlank) {
      lineDoc.skuProduct = explicitSkuProduct;
    } else if (materializedSku.skuId) {
      lineDoc.skuId = materializedSku.skuId;
      lineDoc.skuProduct = materializedSku.skuProduct ?? "";
    } else if (materializedSku.skuProduct) {
      lineDoc.skuProduct = materializedSku.skuProduct;
    } else if (explicitSkuProduct) {
      lineDoc.skuProduct = explicitSkuProduct;
    }

    const insertAfter = d.insertAfterLineDocId?.trim();
    if (insertAfter) {
      lineDoc.insertedAfterLineId = insertAfter;
    }

    const ref = await db.collection("projectareaobjects").add(lineDoc);
    if (insertAfter) {
      try {
        await insertProjectAreaLineAfter(
          db,
          parsed.data.projectAreaDocId,
          projectid,
          ref.id,
          insertAfter,
        );
      } catch (reorderErr) {
        console.error("line reorder failed:", reorderErr);
      }
    }
    return NextResponse.json({ id: ref.id });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to create project area object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
