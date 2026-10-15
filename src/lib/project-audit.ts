import { checklistInheritedMeasureForRow, checklistMeasureLockedByScopeMetric } from "@/lib/checklist-effective-measure";
import { formatMoney } from "@/lib/client/format-money";
import { lineFinalPrice, lineFinalPriceBreakdown } from "@/lib/client/line-final-price";
import { partitionAreaLines } from "@/lib/client/partition-area-lines";
import {
  isPaintingSiteFeeLine,
  paintingSiteFeeLineBaseExcGst,
} from "@/lib/painting-site-fee";
import { projectLineObjectLabel, quoteObjectForScopeLine } from "@/lib/client/project-line-quote-object";
import { resolveScopeLineSkuUnitPriceExcGst } from "@/lib/client/scope-line-sku-match";
import type { SupplierDiscountByKey } from "@/lib/client/supplier-discount-price";
import {
  lookupLabourUpdatesForLines,
  mergeLookupLabourIntoLines,
} from "@/lib/client/sync-workbench-lookup-labour";
import {
  resolveScopeLineInheritMeasureLocked,
  resolveScopeLineInheritMeasureSource,
} from "@/lib/inherit-m2-source";
import {
  contractLabourRateBySiloProduct,
  labourSiloCostExcGst,
} from "@/lib/labour-rate-lookup";
import { LOOKUP_LABOUR_SILO_KEYS } from "@/lib/labour-silo";
import { projectAreaHeading } from "@/lib/project-area-display-name";
import { compareProjectAreasDisplayOrder } from "@/lib/project-area-display-order";
import { compareProjectAreaLineOrder } from "@/lib/project-area-line-order";
import { scopeMetricValuesMapForInstance } from "@/lib/scope-metrics";
import type { AreaPublic } from "@/types/area";
import type { DataLabourRatePublic } from "@/types/data-labour-rate-public";
import type { DataObjectLabourRatePublic } from "@/types/data-object-labour-rate-public";
import type { DataPaintingElementPublic } from "@/types/data-painting-element-public";
import type { DataSkuPublic } from "@/types/data-sku-public";
import type { DataSkuSupplierPublic } from "@/types/data-sku-supplier-public";
import type { ProjectAreaObjectPublic } from "@/types/project-area-object";
import type { ProjectAreaPublic } from "@/types/project-area";
import type { ProjectPublic } from "@/types/project";
import type { QuoteObjectPublic } from "@/types/quote-object";
import type { ScopePublic } from "@/types/scope";

const ORPHAN_AREA_ID = "__audit_orphan__";

export type ProjectAuditLine = {
  id: string;
  label: string;
  skuLabel: string;
  source: string;
  bundled: boolean;
  included: boolean;
  /** Total price column on the checklist. */
  checklist: number;
  /** Final column on the workbench. */
  workbench: number;
  /** Amount this line adds to the checklist area and project totals. */
  checklistCounted: number;
  /** Amount this line adds to the workbench area Final and project Grand Total. */
  workbenchCounted: number;
  detail: string | null;
  reasons: string[];
};

export type ProjectAuditArea = {
  id: string;
  name: string;
  /** Checklist area "Total Price". */
  checklistTotal: number;
  checklistLinesSum: number;
  /** Workbench area "Final". */
  workbenchTotal: number;
  workbenchLinesSum: number;
  notes: string[];
  lines: ProjectAuditLine[];
  hasMismatch: boolean;
};

export type ProjectAuditFinding = {
  tone: "bad" | "note";
  text: string;
};

export type ProjectAuditCards = {
  lineSubTotal: number;
  tradeTotal: number;
  partsSum: number;
  netTotal: number;
  grandTotal: number;
};

export type ProjectAuditReport = {
  marginPct: number;
  paintingSiteFeeExcGst: number;
  paintingSiteFeeWithMargin: number;
  checklistProjectTotal: number;
  checklistLinesSum: number;
  /** Sum of workbench area Final amounts. The painting site fee is inside General. */
  workbenchAreasSum: number;
  workbenchProjectTotal: number;
  workbenchLinesSum: number;
  /** Sum of workbench line prices. Same as the project total when every line sits on an area. */
  workbenchLinesPlusFee: number;
  cards: ProjectAuditCards;
  areas: ProjectAuditArea[];
  findings: ProjectAuditFinding[];
  lineMismatchCount: number;
  areaMismatchCount: number;
  hasMismatch: boolean;
};

export type ProjectAuditInput = {
  project: ProjectPublic;
  marginPct: number;
  lmRunsRollWidthFallback: number;
  areas: AreaPublic[];
  projectAreas: ProjectAreaPublic[];
  lines: ProjectAreaObjectPublic[];
  quoteObjects: QuoteObjectPublic[];
  scopes: ScopePublic[];
  catalogSkus: DataSkuPublic[];
  suppliersBySkuId: Record<string, DataSkuSupplierPublic[]>;
  supplierDiscountByKey: SupplierDiscountByKey;
  contractLabourRates: DataLabourRatePublic[];
  objectLabourRates: DataObjectLabourRatePublic[];
  paintingElements: DataPaintingElementPublic[];
};

type ScopePriceContext = {
  effectiveMeasure: number | null;
  unitPrice: number | null;
  preferEffective: boolean;
};

function sumMoney(values: number[]): number {
  return values.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100;
}

function sameMoney(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

function gap(a: number, b: number): number {
  return (Math.round(a * 100) - Math.round(b * 100)) / 100;
}

function signedMoney(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (rounded > 0) return `+${formatMoney(rounded)}`;
  return formatMoney(rounded);
}

function sourceLabel(row: ProjectAreaObjectPublic): string {
  const s = row.linesource;
  if (s === "scope") return "Scope";
  if (s === "manual2") return "Manual2";
  if (s === "manual") return "Manual";
  if (s === "bundled") return "Bundled";
  return "Default";
}

function skuLabel(row: ProjectAreaObjectPublic): string {
  const product = row.skuProduct?.trim() ?? "";
  if (product) return product;
  const id = row.skuId?.trim() ?? "";
  return id || "—";
}

function areaKeyForLine(
  row: ProjectAreaObjectPublic,
  projectAreas: ProjectAreaPublic[],
): string {
  const key = row.projectAreaDocId?.trim() ?? "";
  if (key) return key;
  const sole = projectAreas.filter((pa) => pa.areaid === row.areaid);
  if (sole.length === 1) return sole[0]!.id;
  return ORPHAN_AREA_ID;
}

function orderedAreaLines(rows: ProjectAreaObjectPublic[]): {
  line: ProjectAreaObjectPublic;
  bundled: boolean;
}[] {
  const sorted = [...rows].sort(compareProjectAreaLineOrder);
  const { topLevel, bundledByParentId } = partitionAreaLines(sorted);
  const out: { line: ProjectAreaObjectPublic; bundled: boolean }[] = [];
  const emitted = new Set<string>();
  for (const line of topLevel) {
    out.push({ line, bundled: false });
    emitted.add(line.id);
    for (const child of bundledByParentId.get(line.id) ?? []) {
      out.push({ line: child, bundled: true });
      emitted.add(child.id);
    }
  }
  for (const line of sorted) {
    if (!emitted.has(line.id)) {
      out.push({ line, bundled: line.linesource === "bundled" });
    }
  }
  return out;
}

function scopeContext(
  row: ProjectAreaObjectPublic,
  pa: ProjectAreaPublic | undefined,
  input: ProjectAuditInput,
): ScopePriceContext | null {
  if (row.linesource !== "scope" || !pa) return null;
  const scope = row.scopeDocId?.trim()
    ? input.scopes.find((s) => s.id === row.scopeDocId?.trim())
    : undefined;
  const qObj = quoteObjectForScopeLine(row, scope, input.quoteObjects);
  const inheritSource = resolveScopeLineInheritMeasureSource(row, scope, input.quoteObjects);
  const inheritLocked = resolveScopeLineInheritMeasureLocked(row, scope, input.quoteObjects);
  const metricMap = scopeMetricValuesMapForInstance(
    pa.scopeMetricValues,
    row.scopeDocId?.trim() ?? "",
    row.scopeInstanceId,
  );
  const effectiveMeasure = checklistInheritedMeasureForRow(
    row,
    qObj,
    pa,
    input.project,
    inheritSource,
    {
      scopeMetrics: scope?.scopeMetrics,
      scopeMetricValues: metricMap,
      catalogSkus: input.catalogSkus,
      inheritMeasureLocked: inheritLocked,
      lmRunsRollWidthFallback: input.lmRunsRollWidthFallback,
    },
  );
  return {
    effectiveMeasure,
    unitPrice: resolveScopeLineSkuUnitPriceExcGst(
      row,
      input.suppliersBySkuId,
      input.supplierDiscountByKey,
    ),
    preferEffective: checklistMeasureLockedByScopeMetric(inheritSource, inheritLocked),
  };
}

function priceLine(
  row: ProjectAreaObjectPublic,
  marginPct: number,
  rates: DataLabourRatePublic[],
  args: {
    effectiveMeasure?: number | null;
    unitPrice?: number | null;
    preferEffective?: boolean;
  },
): number {
  return (
    lineFinalPrice(
      row,
      marginPct,
      args.effectiveMeasure,
      args.unitPrice,
      args.preferEffective,
      rates,
    ) ?? 0
  );
}

function checklistArgs(ctx: ScopePriceContext | null) {
  if (!ctx) return {};
  return {
    effectiveMeasure: ctx.effectiveMeasure,
    unitPrice: ctx.unitPrice,
    preferEffective: ctx.preferEffective,
  };
}

function workbenchUnitPrice(
  row: ProjectAreaObjectPublic,
  ctx: ScopePriceContext | null,
  input: ProjectAuditInput,
): number | null {
  if (ctx) return ctx.unitPrice;
  if (row.linesource === "bundled" || row.linesource === "scope") return null;
  return resolveScopeLineSkuUnitPriceExcGst(
    row,
    input.suppliersBySkuId,
    input.supplierDiscountByKey,
  );
}

function labourHoursDiffer(
  stored: ProjectAreaObjectPublic,
  adjusted: ProjectAreaObjectPublic,
): boolean {
  return LOOKUP_LABOUR_SILO_KEYS.some((key) => {
    const a = stored[key];
    const b = adjusted[key];
    const an = typeof a === "number" && Number.isFinite(a) ? a : null;
    const bn = typeof b === "number" && Number.isFinite(b) ? b : null;
    return an !== bn;
  });
}

function lineDetail(
  row: ProjectAreaObjectPublic,
  ctx: ScopePriceContext | null,
  unitPrice: number | null,
): string | null {
  const bits: string[] = [];
  if (typeof row.totalprice === "number" && Number.isFinite(row.totalprice)) {
    bits.push(`Saved line total ${formatMoney(row.totalprice)}`);
  }
  if (typeof row.custommeasure === "number" && Number.isFinite(row.custommeasure)) {
    bits.push(`Saved measure ${row.custommeasure}`);
  }
  if (ctx?.effectiveMeasure != null && Number.isFinite(ctx.effectiveMeasure)) {
    bits.push(`Inherited measure ${ctx.effectiveMeasure}`);
  }
  if (typeof row.customumprice === "number" && Number.isFinite(row.customumprice)) {
    bits.push(`Saved unit price ${formatMoney(row.customumprice)}`);
  } else if (unitPrice != null) {
    bits.push(`Supplier unit price ${formatMoney(unitPrice)}`);
  }
  if (ctx?.preferEffective) bits.push("Scope measure is locked");
  return bits.length > 0 ? bits.join(" · ") : null;
}

function lineReasons(args: {
  row: ProjectAreaObjectPublic;
  ctx: ScopePriceContext | null;
  checklist: number;
  workbench: number;
  checklistCounted: number;
  workbenchCounted: number;
  labourAdjusted: boolean;
  supplierUnitPrice: number | null;
}): string[] {
  const reasons: string[] = [];
  const {
    row,
    ctx,
    checklist,
    workbench,
    checklistCounted,
    workbenchCounted,
    labourAdjusted,
    supplierUnitPrice,
  } = args;
  if (row.included === false) return reasons;

  const checklistOffTotal = !sameMoney(checklist, checklistCounted);
  const workbenchOffTotal = !sameMoney(workbench, workbenchCounted);
  const screensDiffer = !sameMoney(checklist, workbench);
  const totalsDiffer = !sameMoney(checklistCounted, workbenchCounted);

  if (checklistOffTotal && workbenchOffTotal && sameMoney(checklist, workbench)) {
    if (row.linesource === "scope" && ctx?.preferEffective) {
      reasons.push(
        "Both screens show the locked scope measure. The area and project totals use the saved line total instead.",
      );
    } else if (
      row.linesource === "scope" &&
      row.totalprice == null &&
      ctx?.effectiveMeasure != null &&
      row.custommeasure !== ctx.effectiveMeasure
    ) {
      reasons.push(
        "Both screens price this line from an inherited measure. The area and project totals only count a saved line total or saved measure × unit price.",
      );
    } else if (
      row.linesource === "scope" &&
      row.totalprice == null &&
      row.customumprice == null &&
      supplierUnitPrice != null
    ) {
      reasons.push(
        "Both screens fill the unit price from the supplier list. The area and project totals do not.",
      );
    } else {
      reasons.push(
        "The price on the line is not the amount this line adds to the area and project totals.",
      );
    }
  } else {
    if (checklistOffTotal) {
      reasons.push(
        "The checklist line price is not the amount this line adds to the checklist total.",
      );
    }
    if (workbenchOffTotal) {
      reasons.push(
        "The workbench line price is not the amount this line adds to the workbench total.",
      );
    }
  }

  if (screensDiffer || totalsDiffer) {
    if (labourAdjusted) {
      reasons.push(
        "Opening the workbench rewrites labour hours from the object labour rates. The checklist keeps the hours saved on the line.",
      );
    } else if (
      row.linesource !== "scope" &&
      row.linesource !== "bundled" &&
      row.totalprice == null &&
      row.customumprice == null &&
      supplierUnitPrice != null
    ) {
      reasons.push(
        "The workbench fills a missing unit price from the supplier list. The checklist leaves that price blank until it is saved on the line.",
      );
    } else if (screensDiffer) {
      reasons.push("Checklist and workbench show different prices for this line.");
    } else if (totalsDiffer) {
      reasons.push("This line adds a different amount to the checklist total than to the workbench total.");
    }
  }

  return reasons;
}

function siloTradeTotal(
  rows: ProjectAreaObjectPublic[],
  rates: DataLabourRatePublic[],
  paintingExcGst: number,
): number {
  let sum = paintingExcGst > 0 ? paintingExcGst : 0;
  for (const key of LOOKUP_LABOUR_SILO_KEYS) {
    let hours = 0;
    for (const row of rows) {
      if (row.included === false) continue;
      const v = row[key];
      if (typeof v === "number" && Number.isFinite(v)) hours += v;
    }
    const cost = labourSiloCostExcGst(
      hours > 0 ? hours : null,
      contractLabourRateBySiloProduct(rates, key),
    );
    if (cost != null && Number.isFinite(cost) && cost > 0) sum += cost;
  }
  return Math.round(sum * 100) / 100;
}

function materialSum(rows: ProjectAreaObjectPublic[], rates: DataLabourRatePublic[]): number {
  const raw = rows.reduce((sum, row) => {
    if (row.included === false || isPaintingSiteFeeLine(row)) return sum;
    const material = lineFinalPriceBreakdown(
      row,
      0,
      undefined,
      undefined,
      undefined,
      rates,
    )?.materialExcGst;
    return sum + (material ?? 0);
  }, 0);
  return Math.round(raw * 100) / 100;
}

/**
 * Checklist vs workbench totals for one project.
 * Checklist numbers match Check List Total Price (saved line totals × margin).
 * Workbench numbers match area Final and project Grand Total. The painting site
 * fee is a General-area line, so it is already inside those totals.
 * Line columns match the price each screen shows on the row.
 */
export function buildProjectAudit(input: ProjectAuditInput): ProjectAuditReport {
  const { marginPct, contractLabourRates: rates } = input;
  const labourUpdates = lookupLabourUpdatesForLines(
    input.lines,
    input.quoteObjects,
    input.objectLabourRates,
    input.catalogSkus,
  );
  const workbenchLines = mergeLookupLabourIntoLines(input.lines, labourUpdates);
  const workbenchById = new Map(workbenchLines.map((row) => [row.id, row]));
  const adjustedIds = new Set(labourUpdates.map((u) => u.id));

  const areaById = new Map(input.projectAreas.map((pa) => [pa.id, pa]));
  const grouped = new Map<string, ProjectAreaObjectPublic[]>();
  for (const row of input.lines) {
    const key = areaKeyForLine(row, input.projectAreas);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const sortedAreas = [...input.projectAreas].sort(compareProjectAreasDisplayOrder);
  const areaOrder: { id: string; name: string }[] = sortedAreas.map((pa) => ({
    id: pa.id,
    name: projectAreaHeading(pa, input.areas),
  }));
  for (const id of grouped.keys()) {
    if (id === ORPHAN_AREA_ID || areaById.has(id)) continue;
    areaOrder.push({ id, name: "Area missing from this project" });
  }
  if (grouped.has(ORPHAN_AREA_ID)) {
    areaOrder.push({ id: ORPHAN_AREA_ID, name: "Lines not on an area" });
  }

  const areas: ProjectAuditArea[] = areaOrder.map(({ id, name }) => {
    const pa = areaById.get(id);
    const rows = grouped.get(id) ?? [];
    const ordered = orderedAreaLines(rows);
    const parentIdsWithPricedChildren = new Set<string>();
    const lines: ProjectAuditLine[] = ordered.map(({ line, bundled }) => {
      const wbLine = workbenchById.get(line.id) ?? line;
      const ctx = scopeContext(line, pa, input);
      const supplierUnitPrice = workbenchUnitPrice(line, ctx, input);
      const wbArgs =
        line.linesource === "scope"
          ? checklistArgs(ctx)
          : line.linesource === "bundled"
            ? {}
            : {
                effectiveMeasure: null as number | null,
                unitPrice: supplierUnitPrice,
                preferEffective: false,
              };
      const checklist = priceLine(line, marginPct, rates, checklistArgs(ctx));
      const workbench = priceLine(wbLine, marginPct, rates, wbArgs);
      const checklistCounted = priceLine(line, marginPct, rates, {});
      const workbenchCounted = priceLine(wbLine, marginPct, rates, {});
      const labourAdjusted =
        adjustedIds.has(line.id) && labourHoursDiffer(line, wbLine);
      const reasons = lineReasons({
        row: line,
        ctx,
        checklist,
        workbench,
        checklistCounted,
        workbenchCounted,
        labourAdjusted,
        supplierUnitPrice,
      });
      if (bundled && checklistCounted !== 0) {
        const parentId = line.bundledFromLineId?.trim();
        if (parentId) parentIdsWithPricedChildren.add(parentId);
      }
      return {
        id: line.id,
        label: projectLineObjectLabel(line, input.quoteObjects, input.catalogSkus),
        skuLabel: skuLabel(line),
        source: sourceLabel(line),
        bundled,
        included: line.included !== false,
        checklist,
        workbench,
        checklistCounted,
        workbenchCounted,
        detail: reasons.length > 0 ? lineDetail(line, ctx, supplierUnitPrice) : null,
        reasons,
      };
    });

    const notes: string[] = [];
    const doubleCounted = lines.some(
      (line) =>
        !line.bundled &&
        line.checklistCounted !== 0 &&
        parentIdsWithPricedChildren.has(line.id),
    );
    if (doubleCounted) {
      notes.push(
        "Some bundled lines have their own price, and the parent line does too. Both are included in the totals.",
      );
    }
    if (id === ORPHAN_AREA_ID || (id !== ORPHAN_AREA_ID && !areaById.has(id))) {
      notes.push("These lines are in the project total and missing from every area total.");
    }

    const checklistTotal = sumMoney(lines.map((line) => line.checklistCounted));
    const checklistLinesSum = sumMoney(lines.map((line) => line.checklist));
    const workbenchTotal = sumMoney(lines.map((line) => line.workbenchCounted));
    const workbenchLinesSum = sumMoney(lines.map((line) => line.workbench));
    const detached = id === ORPHAN_AREA_ID || !areaById.has(id);
    const hasMismatch =
      detached ||
      !sameMoney(checklistTotal, checklistLinesSum) ||
      !sameMoney(workbenchTotal, workbenchLinesSum) ||
      !sameMoney(checklistTotal, workbenchTotal) ||
      lines.some((line) => line.reasons.length > 0);

    return {
      id,
      name,
      checklistTotal,
      checklistLinesSum,
      workbenchTotal,
      workbenchLinesSum,
      notes,
      lines,
      hasMismatch,
    };
  });

  const checklistProjectTotal = sumMoney(areas.map((area) => area.checklistTotal));
  const checklistLinesSum = sumMoney(areas.map((area) => area.checklistLinesSum));
  const workbenchLinesSum = sumMoney(areas.map((area) => area.workbenchLinesSum));
  const workbenchCountedSum = sumMoney(areas.map((area) => area.workbenchTotal));

  const paintingSiteFee = sumMoney(
    input.lines.map((row) =>
      isPaintingSiteFeeLine(row) ? paintingSiteFeeLineBaseExcGst(row) : 0,
    ),
  );
  const paintingWithMargin = sumMoney(
    input.lines.map((row) =>
      isPaintingSiteFeeLine(row) ? priceLine(row, marginPct, rates, {}) : 0,
    ),
  );
  const workbenchProjectTotal = workbenchCountedSum;
  const workbenchLinesPlusFee = workbenchLinesSum;

  const lineSubTotal = materialSum(workbenchLines, rates);
  const tradeTotal = siloTradeTotal(workbenchLines, rates, paintingSiteFee);
  const netFromLines = sumMoney(workbenchLines.map((row) => priceLine(row, 0, rates, {})));
  const cards: ProjectAuditCards = {
    lineSubTotal,
    tradeTotal,
    partsSum: sumMoney([lineSubTotal, tradeTotal]),
    netTotal: netFromLines,
    grandTotal: workbenchProjectTotal,
  };

  const findings: ProjectAuditFinding[] = [];
  if (!sameMoney(checklistProjectTotal, checklistLinesSum)) {
    findings.push({
      tone: "bad",
      text: `Checklist project total is ${formatMoney(checklistProjectTotal)}. Adding the checklist line prices gives ${formatMoney(checklistLinesSum)} (${signedMoney(gap(checklistLinesSum, checklistProjectTotal))}).`,
    });
  }
  if (!sameMoney(workbenchProjectTotal, workbenchLinesPlusFee)) {
    findings.push({
      tone: "bad",
      text: `Workbench grand total is ${formatMoney(workbenchProjectTotal)}. Adding the workbench line prices gives ${formatMoney(workbenchLinesPlusFee)} (${signedMoney(gap(workbenchLinesPlusFee, workbenchProjectTotal))}).`,
    });
  }
  if (!sameMoney(checklistProjectTotal, workbenchProjectTotal)) {
    const projectGap = gap(workbenchProjectTotal, checklistProjectTotal);
    findings.push({
      tone: "bad",
      text: `Checklist project total is ${formatMoney(checklistProjectTotal)}. Workbench grand total is ${formatMoney(workbenchProjectTotal)} (${signedMoney(projectGap)}).`,
    });
  }
  if (!sameMoney(cards.partsSum, cards.netTotal)) {
    const cardGap = gap(cards.partsSum, cards.netTotal);
    const oneCent = Math.abs(Math.round(cardGap * 100)) === 1;
    findings.push({
      tone: oneCent ? "note" : "bad",
      text: oneCent
        ? `Workbench Line sub total plus Trade total is ${formatMoney(cards.partsSum)}, one cent off the Total card (${formatMoney(cards.netTotal)}). Trade totals round labour once per trade for the whole project, while each line rounds its own labour first.`
        : `On the workbench summary, Line sub total (${formatMoney(cards.lineSubTotal)}) plus Trade total (${formatMoney(cards.tradeTotal)}) is ${formatMoney(cards.partsSum)}. The Total card is ${formatMoney(cards.netTotal)} (${signedMoney(cardGap)}).`,
    });
  }
  const outsideAreas = areas.filter(
    (area) => area.id === ORPHAN_AREA_ID || !areaById.has(area.id),
  );
  const outsideCount = outsideAreas.reduce((sum, area) => sum + area.lines.length, 0);
  if (outsideCount > 0) {
    findings.push({
      tone: "bad",
      text: `${outsideCount} line${outsideCount === 1 ? " is" : "s are"} in the project total and not on an area total, so the areas do not add up to the project.`,
    });
  }
  const areaMismatchCount = areas.filter((area) => area.hasMismatch).length;
  const lineMismatchCount = areas.reduce(
    (sum, area) => sum + area.lines.filter((line) => line.reasons.length > 0).length,
    0,
  );
  if (findings.length === 0 && areaMismatchCount === 0) {
    findings.push({
      tone: "note",
      text: "Checklist and workbench totals match, and each total equals the sum of its lines.",
    });
  } else if (areaMismatchCount > 0) {
    findings.push({
      tone: "note",
      text: `${areaMismatchCount} area${areaMismatchCount === 1 ? "" : "s"} and ${lineMismatchCount} line${lineMismatchCount === 1 ? "" : "s"} do not agree. Open an area below to see which price is which.`,
    });
  }

  return {
    marginPct,
    paintingSiteFeeExcGst: paintingSiteFee,
    paintingSiteFeeWithMargin: paintingWithMargin,
    checklistProjectTotal,
    checklistLinesSum,
    workbenchAreasSum: workbenchCountedSum,
    workbenchProjectTotal,
    workbenchLinesSum,
    workbenchLinesPlusFee,
    cards,
    areas,
    findings,
    lineMismatchCount,
    areaMismatchCount,
    hasMismatch: findings.some((f) => f.tone === "bad") || areaMismatchCount > 0,
  };
}
