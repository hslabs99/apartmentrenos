import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { PROJECTAREAOBJECTS_COLLECTION_META_ID } from "@/lib/firestore/projectareaobjects-collection";
import { PROJECTAREAS_COLLECTION_META_ID } from "@/lib/firestore/projectareas-collection";
import { PROJECTAREAANSWERS_COLLECTION_META_ID } from "@/lib/firestore/projectareaanswers-collection";
import { PROJECTS_COLLECTION_META_ID } from "@/lib/firestore/projects-collection";
import { SETTINGS_COLLECTION_META_ID } from "@/lib/firestore/settings-collection";
import { AREASQUESTIONS_COLLECTION_META_ID } from "@/lib/firestore/areasquestions-collection";
import { LOOKUPS_COLOURS_COLLECTION_META_ID } from "@/lib/firestore/lookups-colours-collection";
import { DATA_OBJECTS_COLLECTION_META_ID } from "@/lib/firestore/data-objects-collection";
import { DATA_SKUS_COLLECTION_META_ID } from "@/lib/firestore/data-skus-collection";
import { DATA_SKU_SUPPLIERS_COLLECTION_META_ID } from "@/lib/firestore/data-sku-suppliers-collection";
import { IMPORTLOG_COLLECTION_META_ID } from "@/lib/firestore/importlog-collection";
import { CASCADES_COLLECTION_META_ID } from "@/lib/firestore/cascades-collection";
import { DATA_LABOURRATES_COLLECTION_META_ID } from "@/lib/firestore/data-labourrates-collection";
import { DATA_PRODUCTCONTRACTORRATES_COLLECTION_META_ID } from "@/lib/firestore/data-productcontractorrates-collection";
import { DATA_BUILDING_ELEMENTS_COLLECTION_META_ID } from "@/lib/firestore/data-building-elements-collection";
import { DATA_OBJECTLABOURRATES_COLLECTION_META_ID } from "@/lib/firestore/data-objectlabourrates-collection";
import { DATA_SUPPLIER_DISCOUNTS_COLLECTION_META_ID } from "@/lib/firestore/data-supplier-discounts-collection";
import { DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION_META_ID } from "@/lib/firestore/data-supplier-discount-ranges-collection";
import { DATA_BLINDS_COLLECTION_META_ID } from "@/lib/firestore/data-blinds-collection";
import { DATA_BLINDS_TYPES_COLLECTION_META_ID } from "@/lib/firestore/data-blinds-types-collection";
import { DATA_BLINDS_FOOTERS_COLLECTION_META_ID } from "@/lib/firestore/data-blinds-footers-collection";

async function ensureMetaDoc(
  db: Firestore,
  collectionId: string,
  metaDocId: string,
): Promise<void> {
  const ref = db.collection(collectionId).doc(metaDocId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      kind: "collection_bootstrap",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

/** Idempotent: ensures hidden meta doc exists so the collection is visible in Firebase. */
export async function ensureProjectsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "projects", PROJECTS_COLLECTION_META_ID);
}

export async function ensureProjectAreasBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "projectareas", PROJECTAREAS_COLLECTION_META_ID);
}

export async function ensureProjectAreaObjectsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "projectareaobjects", PROJECTAREAOBJECTS_COLLECTION_META_ID);
}

export async function ensureProjectAreaAnswersBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "projectareaanswers", PROJECTAREAANSWERS_COLLECTION_META_ID);
}

export async function ensureSettingsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "settings", SETTINGS_COLLECTION_META_ID);
}

export async function ensureAreasQuestionsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "areasquestions", AREASQUESTIONS_COLLECTION_META_ID);
}

export async function ensureDataSkusBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "data_skus", DATA_SKUS_COLLECTION_META_ID);
}

export async function ensureDataObjectsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "data_objects", DATA_OBJECTS_COLLECTION_META_ID);
}

export async function ensureLookupsColoursBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "lookups_colours", LOOKUPS_COLOURS_COLLECTION_META_ID);
}

export async function ensureDataSkuSuppliersBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "data_sku_suppliers", DATA_SKU_SUPPLIERS_COLLECTION_META_ID);
}

export async function ensureImportlogBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "importlog", IMPORTLOG_COLLECTION_META_ID);
}

export async function ensureCascadesBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "cascades", CASCADES_COLLECTION_META_ID);
}

export async function ensureDataLabourratesBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "data_labourrates", DATA_LABOURRATES_COLLECTION_META_ID);
}

export async function ensureDataProductcontractorratesBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(
    db,
    "data_productcontractorrates",
    DATA_PRODUCTCONTRACTORRATES_COLLECTION_META_ID,
  );
}

export async function ensureDataBuildingElementsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(
    db,
    "data_building_elements",
    DATA_BUILDING_ELEMENTS_COLLECTION_META_ID,
  );
}

export async function ensureDataObjectlabourratesBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(
    db,
    "data_objectlabourrates",
    DATA_OBJECTLABOURRATES_COLLECTION_META_ID,
  );
}

export async function ensureDataSupplierDiscountsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(
    db,
    "data_supplier_discounts",
    DATA_SUPPLIER_DISCOUNTS_COLLECTION_META_ID,
  );
}

export async function ensureDataSupplierDiscountRangesBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(
    db,
    "data_supplier_discount_ranges",
    DATA_SUPPLIER_DISCOUNT_RANGES_COLLECTION_META_ID,
  );
}

export async function ensureDataBlindsBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "data_blinds", DATA_BLINDS_COLLECTION_META_ID);
}

export async function ensureDataBlindsTypesBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "data_blinds_types", DATA_BLINDS_TYPES_COLLECTION_META_ID);
}

export async function ensureDataBlindsFootersBootstrap(db: Firestore): Promise<void> {
  await ensureMetaDoc(db, "data_blinds_footers", DATA_BLINDS_FOOTERS_COLLECTION_META_ID);
}
