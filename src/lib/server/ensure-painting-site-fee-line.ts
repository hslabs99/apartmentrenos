import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import {
  DATA_PAINTING_ELEMENTS_COLLECTION,
  isDataPaintingElementsMetaDocument,
} from "@/lib/firestore/data-painting-elements-collection";
import { DATA_SKUS_COLLECTION, isDataSkusMetaDocument } from "@/lib/firestore/data-skus-collection";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { buildPaintingElementIndex } from "@/lib/client/painting-element-index";
import { mapSkuUomToQuoteUom } from "@/lib/map-sku-uom-to-quote-uom";
import {
  isPaintingSiteFeeLine,
  PAINTING_SITE_FEE_KIND,
  PAINTING_SITE_FEE_PRODUCT,
  paintingSiteFeeExcGst,
  paintingSiteFeeRate,
  projectHasPaintConsumption,
} from "@/lib/painting-site-fee";
import { emptyLabourHours } from "@/lib/labour-silo";
import { dataPaintingElementDocToPublic } from "@/lib/server/data-painting-element-doc";
import { dataSkuDocToPublic } from "@/lib/server/data-sku-doc";
import { labourHoursToFirestore, loadAllContractLabourRates } from "@/lib/server/labour-hours";
import { nextProjectAreaLineSortOrder } from "@/lib/server/project-area-line-sort";
import { docToProjectAreaObjectPublic } from "@/lib/server/project-area-object-doc";
import { addProjectAreaWithSeed } from "@/lib/server/project-area-seeding";
import { ensureProjectNumericId } from "@/lib/server/resolve-ids";

export type EnsurePaintingSiteFeeResult = {
  created: boolean;
  lineId: string | null;
  reason: "exists" | "created" | "no-paint" | "no-rate" | "no-general-template";
};

function isGeneralName(name: string): boolean {
  return name.trim().toLowerCase() === "general";
}

/**
 * When a project has paint consumption, store the Painting Site Fee labour rate
 * as a line on General so checklist, workbench, and area totals all include it.
 * Opening the project again does not add a second line.
 */
export async function ensurePaintingSiteFeeLine(
  db: Firestore,
  projectDocId: string,
): Promise<EnsurePaintingSiteFeeResult> {
  const projectid = await ensureProjectNumericId(db, projectDocId);
  const lineSnap = await db
    .collection("projectareaobjects")
    .where("projectid", "==", projectid)
    .get();
  const lineDocs = lineSnap.docs.filter((d) => !isProjectAreaObjectsMetaDocument(d.id));
  const existing = lineDocs.find((d) =>
    isPaintingSiteFeeLine({
      systemObjectKind:
        d.data().systemObjectKind === PAINTING_SITE_FEE_KIND ? PAINTING_SITE_FEE_KIND : null,
    }),
  );
  if (existing) {
    return { created: false, lineId: existing.id, reason: "exists" };
  }

  const [skuSnap, paintSnap, contractLabourRates] = await Promise.all([
    db.collection(DATA_SKUS_COLLECTION).get(),
    db.collection(DATA_PAINTING_ELEMENTS_COLLECTION).get(),
    loadAllContractLabourRates(db),
  ]);
  const feeRate = paintingSiteFeeRate(contractLabourRates);
  const feeExcGst = paintingSiteFeeExcGst(contractLabourRates);
  if (!feeRate || feeExcGst == null || feeExcGst <= 0) {
    return { created: false, lineId: null, reason: "no-rate" };
  }

  const catalogSkus = skuSnap.docs
    .filter((d) => !isDataSkusMetaDocument(d.id))
    .map((d) => dataSkuDocToPublic(d.id, d.data()));
  const paintingElements = paintSnap.docs
    .filter((d) => !isDataPaintingElementsMetaDocument(d.id))
    .map((d) => dataPaintingElementDocToPublic(d.id, d.data()));
  const objects = lineDocs.map((d) => docToProjectAreaObjectPublic(d.id, d.data()));
  const hasPaint = projectHasPaintConsumption({
    objects,
    catalogSkus,
    paintingElementBySkuName: buildPaintingElementIndex(paintingElements),
    suppliersBySkuId: {},
  });
  if (!hasPaint) {
    return { created: false, lineId: null, reason: "no-paint" };
  }

  const [areaSnap, projectAreaSnap] = await Promise.all([
    db.collection("areas").get(),
    db.collection("projectareas").where("projectid", "==", projectid).get(),
  ]);
  const generalTemplate = areaSnap.docs.find((d) => {
    if (isAreasMetaDocument(d.id)) return false;
    return isGeneralName(String(d.data().areaname ?? ""));
  });
  if (!generalTemplate) {
    return { created: false, lineId: null, reason: "no-general-template" };
  }
  const generalAreaId = Number(generalTemplate.data().areaid);
  const generalProjectAreas = projectAreaSnap.docs
    .filter((d) => !isProjectAreasMetaDocument(d.id))
    .filter((d) => Number(d.data().areaid) === generalAreaId)
    .sort((a, b) => {
      const ao = a.data().sortOrder;
      const bo = b.data().sortOrder;
      const aHas = typeof ao === "number" && Number.isFinite(ao);
      const bHas = typeof bo === "number" && Number.isFinite(bo);
      if (aHas && bHas && ao !== bo) return ao - bo;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.id.localeCompare(b.id);
    });

  let projectAreaDocId = generalProjectAreas[0]?.id ?? null;
  if (!projectAreaDocId) {
    const seeded = await addProjectAreaWithSeed(db, projectDocId, generalTemplate.id, {
      areanotes1: "",
      areanotes2: "",
      aream2: null,
      ceilingheightm: null,
      areafinish: "",
      pricelevelid: null,
      style: null,
      colour: null,
    });
    projectAreaDocId = seeded.id;
  }

  const again = await db.collection("projectareaobjects").doc(`psf_${projectDocId}`).get();
  if (again.exists) {
    return { created: false, lineId: again.id, reason: "exists" };
  }

  const uom = mapSkuUomToQuoteUom(feeRate.uom ?? "Unit");
  const areaSnapForLine = await db.collection("projectareas").doc(projectAreaDocId).get();
  const lineAreaId = Number(areaSnapForLine.data()?.areaid);
  if (!Number.isInteger(lineAreaId)) {
    return { created: false, lineId: null, reason: "no-general-template" };
  }
  const lineSortOrder = await nextProjectAreaLineSortOrder(db, projectAreaDocId, projectid);
  const ref = db.collection("projectareaobjects").doc(`psf_${projectDocId}`);
  try {
    await ref.create({
      projectid,
      projectAreaDocId,
      objectid: 0,
      areaid: lineAreaId,
      lineSortOrder,
      linesource: "manual",
      systemObjectKind: PAINTING_SITE_FEE_KIND,
      objectname: PAINTING_SITE_FEE_PRODUCT,
      skuId: null,
      skuProduct: PAINTING_SITE_FEE_PRODUCT,
      included: true,
      dateadded: FieldValue.serverTimestamp(),
      custommeasure: 1,
      customuom: uom,
      customumprice: feeExcGst,
      totalprice: feeExcGst,
      notes1: "",
      notes2: "",
      tooltip: "",
      ...labourHoursToFirestore(emptyLabourHours()),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code === 6) {
      return { created: false, lineId: ref.id, reason: "exists" };
    }
    throw e;
  }

  return { created: true, lineId: ref.id, reason: "created" };
}
