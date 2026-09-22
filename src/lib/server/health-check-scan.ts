import type { DocumentData, Firestore, QuerySnapshot } from "firebase-admin/firestore";
import { DATA_SKUS_COLLECTION, isDataSkusMetaDocument } from "@/lib/firestore/data-skus-collection";
import { isAreaObjectsMetaDocument } from "@/lib/firestore/areaobjects-collection";
import { isAreasMetaDocument } from "@/lib/firestore/areas-collection";
import { isProjectAreaObjectsMetaDocument } from "@/lib/firestore/projectareaobjects-collection";
import { isProjectAreasMetaDocument } from "@/lib/firestore/projectareas-collection";
import { isProjectsMetaDocument } from "@/lib/firestore/projects-collection";
import { isQuoteObjectsMetaDocument } from "@/lib/firestore/quote-objects-collection";
import { isScopesMetaDocument } from "@/lib/firestore/scopes-collection";
import { parseProductFromDoc } from "@/lib/legacy-product-field";
import {
  emptyHealthCheckReport,
  integerObjectId,
  normalizeQuoteObjectName,
  projectChecklistHref,
  projectChecklistLineHref,
  projectLineHasOrphanSku,
  scopeHref,
  scopeMissingObjectFindings,
  setupAreasHref,
  shouldSkipProjectLineForHealthCheck,
  type QuoteObjectCatalogIndex,
} from "@/lib/health-check/orphan-refs";
import { normalizeSkuPart } from "@/lib/sku/normalize-sku-part";
import { buildProductIdentityKey } from "@/lib/sku/product-key";
import { isProjectArchivedFlag } from "@/lib/project-archived";
import { isProjectTemplateFlag } from "@/lib/project-template";
import { parseProjectStatus } from "@/lib/project-status";
import { loadScopeAreaContext } from "@/lib/server/scope-area-load-context";
import { scopeDocToPublic } from "@/lib/server/scope-doc";
import type {
  HealthCheckAreaObjectIssue,
  HealthCheckDeepProgress,
  HealthCheckProjectIssue,
  HealthCheckProjectLineIssue,
  HealthCheckReport,
  HealthCheckScopeIssue,
} from "@/types/health-check";

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function integerId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isInteger(n)) return n;
  }
  return undefined;
}

type ProjectScanRow = {
  docId: string;
  projectid: number | null;
  projectname: string;
  template: boolean;
};

function shouldScanProject(data: DocumentData): boolean {
  if (isProjectArchivedFlag(data.archived)) return false;
  const template = isProjectTemplateFlag(data.template);
  if (template) return true;
  return parseProjectStatus(data.status) === "Live";
}

function loadQuoteCatalog(qoSnap: QuerySnapshot): {
  catalog: QuoteObjectCatalogIndex;
  count: number;
} {
  const ids = new Set<string>();
  const namesLower = new Set<string>();
  const numericIds = new Set<number>();
  const nameById = new Map<string, string>();
  let count = 0;
  for (const d of qoSnap.docs) {
    if (isQuoteObjectsMetaDocument(d.id)) continue;
    count += 1;
    ids.add(d.id);
    const data = d.data();
    const objectname = String(data.objectname ?? "").trim();
    if (objectname) nameById.set(d.id, objectname);
    const name = normalizeQuoteObjectName(objectname);
    if (name) namesLower.add(name);
    const oid = integerObjectId(data.objectid);
    if (oid !== undefined) numericIds.add(oid);
  }
  return { catalog: { ids, namesLower, numericIds, nameById }, count };
}

function loadSkuCatalog(skuSnap: QuerySnapshot): {
  ids: Set<string>;
  identities: Set<string>;
  productNames: Set<string>;
  count: number;
} {
  const ids = new Set<string>();
  const identities = new Set<string>();
  const productNames = new Set<string>();
  let count = 0;
  for (const d of skuSnap.docs) {
    if (isDataSkusMetaDocument(d.id)) continue;
    count += 1;
    ids.add(d.id);
    const data = d.data();
    const skuId = String(data.skuId ?? "").trim();
    if (skuId) ids.add(skuId);
    if (data.isCurrent === false) continue;
    const product = parseProductFromDoc(data);
    const productType = String(data.productType ?? "").trim();
    const identity = buildProductIdentityKey(productType, product);
    if (identity) identities.add(identity);
    const name = normalizeSkuPart(product);
    if (name) productNames.add(name);
  }
  return { ids, identities, productNames, count };
}

async function scanCatalog(
  db: Firestore,
): Promise<{
  report: HealthCheckReport;
  catalog: QuoteObjectCatalogIndex;
}> {
  const [qoSnap, aoSnap, areasSnap, scopesSnap, ctx] = await Promise.all([
    db.collection("quote_objects").get(),
    db.collection("areaobjects").get(),
    db.collection("areas").get(),
    db.collection("scopes").get(),
    loadScopeAreaContext(db),
  ]);

  const { catalog, count: quoteObjectCount } = loadQuoteCatalog(qoSnap);

  const areaNameById = new Map<number, string>();
  for (const d of areasSnap.docs) {
    if (isAreasMetaDocument(d.id)) continue;
    const aid = integerId(d.data().areaid);
    if (aid === undefined) continue;
    areaNameById.set(aid, String(d.data().areaname ?? "").trim() || `Area #${aid}`);
  }

  const scopes: HealthCheckScopeIssue[] = [];
  let scopesScanned = 0;
  for (const d of scopesSnap.docs) {
    if (isScopesMetaDocument(d.id)) continue;
    scopesScanned += 1;
    const pub = scopeDocToPublic(
      d.id,
      d.data(),
      ctx.docIdByAreaid,
      ctx.nameByAreaid,
      ctx.areasOrdered,
    );
    const answers = scopeMissingObjectFindings(pub, catalog);
    if (answers.length === 0) continue;
    scopes.push({
      scopeDocId: pub.id,
      scopeid: pub.scopeid ?? null,
      question: (pub.question ?? "").trim() || `Scope ${pub.scopeid ?? pub.id}`,
      areaNames: (pub.areaNamesDisplay || pub.areaname || "").trim(),
      answers,
      href: scopeHref(pub.id),
    });
  }
  scopes.sort((a, b) => a.question.localeCompare(b.question, undefined, { sensitivity: "base" }));

  const areaObjects: HealthCheckAreaObjectIssue[] = [];
  let areaObjectsScanned = 0;
  for (const d of aoSnap.docs) {
    if (isAreaObjectsMetaDocument(d.id)) continue;
    areaObjectsScanned += 1;
    const data = d.data();
    const objectid = integerObjectId(data.objectid);
    if (objectid === undefined) continue;
    if (catalog.numericIds.has(objectid)) continue;
    const areaid = integerId(data.areaid) ?? 0;
    areaObjects.push({
      areaObjectDocId: d.id,
      areaid,
      areaName: areaNameById.get(areaid) ?? (areaid ? `Area #${areaid}` : "Unknown area"),
      objectid,
      href: setupAreasHref(),
    });
  }
  areaObjects.sort((a, b) => {
    const byArea = a.areaName.localeCompare(b.areaName, undefined, { sensitivity: "base" });
    if (byArea !== 0) return byArea;
    return a.objectid - b.objectid;
  });

  return {
    catalog,
    report: {
      ...emptyHealthCheckReport({
        deepScan: false,
        quoteObjectCount,
        scopesScanned,
        areaObjectsScanned,
      }),
      scopes,
      areaObjects,
    },
  };
}

export async function runHealthCheckFast(db: Firestore): Promise<HealthCheckReport> {
  const { report } = await scanCatalog(db);
  return report;
}

export async function runHealthCheckDeep(
  db: Firestore,
  push: (event: HealthCheckDeepProgress) => void,
): Promise<void> {
  const emit = (event: HealthCheckDeepProgress) => {
    push({ ...event, percent: clampPercent(event.percent) });
  };

  emit({ phase: "catalog", message: "Checking scopes and area objects…", percent: 4 });
  const { report: catalogReport, catalog } = await scanCatalog(db);

  emit({ phase: "skus", message: "Loading SKU catalog…", percent: 12 });
  const skuSnap = await db.collection(DATA_SKUS_COLLECTION).get();
  const { ids: skuIds, identities: skuIdentities, productNames: skuProductNames, count: skuCount } =
    loadSkuCatalog(skuSnap);

  emit({ phase: "projects", message: "Loading live projects and templates…", percent: 22 });
  const [projSnap, paSnap] = await Promise.all([
    db.collection("projects").get(),
    db.collection("projectareas").get(),
  ]);

  const projectsByNumericId = new Map<number, ProjectScanRow>();
  const scannedProjects: ProjectScanRow[] = [];
  const areaNameById = new Map<number, string>();
  for (const d of (await db.collection("areas").get()).docs) {
    if (isAreasMetaDocument(d.id)) continue;
    const aid = integerId(d.data().areaid);
    if (aid === undefined) continue;
    areaNameById.set(aid, String(d.data().areaname ?? "").trim() || `Area #${aid}`);
  }

  for (const d of projSnap.docs) {
    if (isProjectsMetaDocument(d.id)) continue;
    const data = d.data();
    if (!shouldScanProject(data)) continue;
    const row: ProjectScanRow = {
      docId: d.id,
      projectid: integerId(data.projectid) ?? null,
      projectname: String(data.projectname ?? "").trim() || "Untitled project",
      template: isProjectTemplateFlag(data.template),
    };
    scannedProjects.push(row);
    if (row.projectid != null) projectsByNumericId.set(row.projectid, row);
  }

  const projectAreaLabel = new Map<string, string>();
  const projectAreaLabelByKeys = new Map<string, string>();
  for (const d of paSnap.docs) {
    if (isProjectAreasMetaDocument(d.id)) continue;
    const data = d.data();
    const projectid = integerId(data.projectid);
    const areaid = integerId(data.areaid);
    if (projectid === undefined || !projectsByNumericId.has(projectid)) continue;
    const display = String(data.displayName ?? "").trim();
    const templateName = areaid !== undefined ? areaNameById.get(areaid) ?? "" : "";
    const label = display || templateName || (areaid != null ? `Area #${areaid}` : "Area");
    projectAreaLabel.set(d.id, label);
    if (areaid !== undefined) {
      projectAreaLabelByKeys.set(`${projectid}:${areaid}`, label);
    }
  }

  emit({
    phase: "lines",
    message: `Scanning lines on ${scannedProjects.length} project${scannedProjects.length === 1 ? "" : "s"}…`,
    percent: 32,
  });
  const lineSnap = await db.collection("projectareaobjects").get();
  const lineDocs = lineSnap.docs.filter((d) => !isProjectAreaObjectsMetaDocument(d.id));

  const byProject = new Map<string, HealthCheckProjectIssue>();
  let linesScanned = 0;
  const totalLines = lineDocs.length;
  let lastEmit = 0;

  for (let i = 0; i < lineDocs.length; i++) {
    const d = lineDocs[i]!;
    const data = d.data();
    const projectid = integerId(data.projectid);
    if (projectid === undefined) continue;
    const project = projectsByNumericId.get(projectid);
    if (!project) continue;
    linesScanned += 1;

    if (
      shouldSkipProjectLineForHealthCheck({
        linesource: typeof data.linesource === "string" ? data.linesource : null,
        systemObjectKind: typeof data.systemObjectKind === "string" ? data.systemObjectKind : null,
      })
    ) {
      continue;
    }

    const pad = typeof data.projectAreaDocId === "string" ? data.projectAreaDocId.trim() : "";
    const areaid = integerId(data.areaid);
    const areaName =
      (pad && projectAreaLabel.get(pad)) ||
      (areaid !== undefined ? projectAreaLabelByKeys.get(`${projectid}:${areaid}`) : "") ||
      (areaid !== undefined ? areaNameById.get(areaid) : "") ||
      "Area";
    const objectname =
      (typeof data.objectname === "string" && data.objectname.trim()) || `Object #${data.objectid ?? "?"}`;
    const objectid = integerObjectId(data.objectid);
    const skuId = typeof data.skuId === "string" && data.skuId.trim() ? data.skuId.trim() : null;
    const skuProduct =
      typeof data.skuProduct === "string" && data.skuProduct.trim() ? data.skuProduct.trim() : null;
    const snapshotObjectname =
      typeof data.objectname === "string" && data.objectname.trim() ? data.objectname.trim() : null;

    const missingObject = objectid !== undefined && !catalog.numericIds.has(objectid);
    const missingSku = projectLineHasOrphanSku(
      {
        skuId,
        skuProduct,
        objectname: snapshotObjectname,
        linesource: typeof data.linesource === "string" ? data.linesource : null,
        systemObjectKind: typeof data.systemObjectKind === "string" ? data.systemObjectKind : null,
      },
      skuIds,
      skuIdentities,
      skuProductNames,
    );
    if (!missingObject && !missingSku) continue;

    let issue = byProject.get(project.docId);
    if (!issue) {
      issue = {
        projectDocId: project.docId,
        projectid: project.projectid,
        projectname: project.projectname,
        template: project.template,
        href: projectChecklistHref(project.docId),
        missingObjects: [],
        missingSkus: [],
      };
      byProject.set(project.docId, issue);
    }

    const base: Omit<HealthCheckProjectLineIssue, "kind"> = {
      lineId: d.id,
      objectid: objectid ?? 0,
      objectname,
      skuId,
      skuProduct,
      areaName,
      href: projectChecklistLineHref(project.docId, d.id),
    };
    if (missingObject) {
      issue.missingObjects.push({ ...base, kind: "object" });
    }
    if (missingSku) {
      issue.missingSkus.push({ ...base, kind: "sku" });
    }

    if (i - lastEmit >= 250 || i === lineDocs.length - 1) {
      lastEmit = i;
      const scannedFrac = totalLines > 0 ? i / totalLines : 1;
      emit({
        phase: "scanning",
        message: `Checked ${i + 1} of ${totalLines} line${totalLines === 1 ? "" : "s"}…`,
        percent: 32 + scannedFrac * 62,
      });
    }
  }

  const projects = [...byProject.values()].sort((a, b) => {
    if (a.template !== b.template) return a.template ? 1 : -1;
    return a.projectname.localeCompare(b.projectname, undefined, { sensitivity: "base" });
  });

  const report: HealthCheckReport = {
    ...catalogReport,
    generatedAt: new Date().toISOString(),
    deepScan: true,
    skuCount,
    projectsScanned: scannedProjects.length,
    linesScanned,
    projects,
  };

  emit({
    phase: "done",
    message: "Deep scan complete.",
    percent: 100,
    report,
  });
}
